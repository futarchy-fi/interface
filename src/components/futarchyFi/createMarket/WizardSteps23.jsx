// Wizard steps 2–3: metadata write via the org editor key, pool creation from
// the proposal's conditional tokens, then the invert-flag verification pass
// against real on-chain token0 — the gate that makes the KIP-88/90 inverted
// price bug unrepresentable. Spec: hub docs/specs/2026-08-06-selfserve-wizard-increment-C.md
import React, { useEffect, useMemo, useState } from 'react';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { CONTRACT_ABIS } from '../marketPage/constants/contracts';
import {
  buildMetadataDraft,
  deriveTwapTiming,
  GNOSIS_CHAIN_ID,
} from '../../../features/marketCreation/marketCreationWorkflow';
import { validateMetadata, mergeMetadataForUpdate } from '../../../features/marketCreation/validateMetadata';
import {
  buildProposalMetadataArgs,
  buildInvertContext,
  buildInvertPatch,
} from '../../../features/marketCreation/orgMetadataWrite';
import { fetchProposalFromChain } from '../../../adapters/subgraphConfigAdapter';
import { useCreatePool } from '../../../hooks/useCreatePool';

const panelClass = 'border border-futarchyGray6 dark:border-futarchyGray7 bg-white dark:bg-futarchyGray2 rounded-lg';
const inputClass = 'w-full px-3 py-2 bg-futarchyGray2 dark:bg-futarchyGray3 border border-futarchyGray6 dark:border-futarchyGray7 rounded-md text-sm text-futarchyGray12 dark:text-white focus:outline-none focus:ring-2 focus:ring-futarchyBlue9';
const btnClass = 'inline-flex h-9 items-center rounded-md bg-futarchyBlue9 px-4 text-sm font-medium text-white disabled:opacity-50';
const ADDR = /^0x[a-fA-F0-9]{40}$/;

const TOKEN0_ABI = [
  { name: 'token0', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
];

function StatusLine({ tone = 'info', children }) {
  const cls = tone === 'ok'
    ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-futarchyGray11';
  return <p className={`mt-2 text-sm ${cls}`}>{children}</p>;
}

// ---------------------------------------------------------------------------
// Step 2 — metadata write via the org editor key
// ---------------------------------------------------------------------------
export function MetadataWritePanel({ proposalAddress, form, organization, organizationId, metadataAddress, onMetadataContract }) {
  const { address: account, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: GNOSIS_CHAIN_ID });
  const { writeContractAsync } = useWriteContract();
  const [roles, setRoles] = useState(null); // { owner, editor } | null
  const [phase, setPhase] = useState('idle'); // idle|simulating|simulated|writing|done|error
  const [message, setMessage] = useState('');

  useEffect(() => {
    let live = true;
    if (!publicClient) return undefined;
    (async () => {
      const read = (fn) => publicClient.readContract({
        address: organization.organizationAddress,
        abi: CONTRACT_ABIS.ORGANIZATION,
        functionName: fn,
      }).catch(() => null);
      const [owner, editor] = await Promise.all([read('owner'), read('editor')]);
      if (live) setRoles({ owner, editor });
    })();
    return () => { live = false; };
  }, [publicClient, organization.organizationAddress]);

  const canWrite = Boolean(account && roles
    && [roles.owner, roles.editor].some((a) => a && a.toLowerCase() === account.toLowerCase()));

  // Recomputed at click time — never from a page-load-stale draft. The
  // validator's past-start gate then only fires when the CLOSE DATE itself is
  // too near (needs >= 7 days out for the 5d window + 48h buffer).
  const buildDraft = () => {
    const draft = {
      ...buildMetadataDraft({ ...form, organizationId, proposalAddress }),
      ...deriveTwapTiming(form.closeTimestamp),
      invertTwapPoolYes: false, // verified and corrected against real token0 in step 3
      invertTwapPoolNo: false,
    };
    return { draft, validation: validateMetadata(draft, { nowUnix: Math.floor(Date.now() / 1000) }) };
  };

  const writeRequest = (draft) => ({
    address: organization.organizationAddress,
    abi: CONTRACT_ABIS.ORGANIZATION,
    functionName: 'createAndAddProposalMetadata',
    args: buildProposalMetadataArgs({
      proposalAddress,
      question: form.question,
      event: form.displayTitle1,
      description: form.description,
      metadata: draft,
    }),
    chainId: GNOSIS_CHAIN_ID,
    account,
  });

  const onSimulate = async () => {
    const { draft, validation } = buildDraft();
    if (!validation.ok) {
      setPhase('error');
      setMessage(`Metadata invalid: ${validation.errors.join('; ')}`);
      return;
    }
    setPhase('simulating');
    try {
      await publicClient.simulateContract(writeRequest(draft));
      setPhase('simulated');
      setMessage('Simulation OK — the org write would succeed from this wallet.');
    } catch (e) {
      setPhase('error');
      setMessage(`Would revert: ${e.shortMessage || e.message}`);
    }
  };

  const onBroadcast = async () => {
    const { draft, validation } = buildDraft();
    if (!validation.ok) {
      setPhase('error');
      setMessage(`Metadata invalid: ${validation.errors.join('; ')}`);
      return;
    }
    setPhase('writing');
    try {
      const hash = await writeContractAsync(writeRequest(draft));
      setMessage(`Submitted ${hash} — waiting for confirmation…`);
      await publicClient.waitForTransactionReceipt({ hash });
      // The org appends a new metadata contract; the last list entry is ours.
      const list = await publicClient.readContract({
        address: organization.organizationAddress,
        abi: CONTRACT_ABIS.ORGANIZATION,
        functionName: 'getProposals',
        args: [0n, 1000n],
      });
      const created = list?.[list.length - 1];
      setPhase('done');
      setMessage(`Metadata written${created ? ` — contract ${created}` : ''}.`);
      if (created) onMetadataContract(created);
    } catch (e) {
      setPhase('error');
      setMessage(e.shortMessage || e.message);
    }
  };

  return (
    <section className={`${panelClass} p-4`}>
      <h2 className="text-lg font-semibold text-futarchyGray12 dark:text-white">Step 2 — Write proposal metadata</h2>
      <p className="mt-1 text-sm text-futarchyGray11">
        Registers the market's metadata (TWAP window recomputed now, Snapshot id, ticker) on the
        organization contract. Requires the org owner or editor key.
      </p>
      {roles && !canWrite && (
        <StatusLine tone="warn">
          This wallet is not the org owner{roles.owner ? ` (${roles.owner})` : ''} or editor
          {roles.editor ? ` (${roles.editor})` : ''} — ask the org owner to grant editor().
        </StatusLine>
      )}
      {metadataAddress ? (
        <StatusLine tone="ok">Done — metadata contract {metadataAddress}</StatusLine>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button className={btnClass} disabled={!isConnected || phase === 'simulating' || phase === 'writing'} onClick={onSimulate}>
            Simulate write
          </button>
          <button className={btnClass} disabled={!isConnected || !canWrite || phase === 'writing'} onClick={onBroadcast}>
            Sign & write metadata
          </button>
        </div>
      )}
      {message && <StatusLine tone={phase === 'error' ? 'warn' : phase === 'done' || phase === 'simulated' ? 'ok' : 'info'}>{message}</StatusLine>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — pools + invert verification
// ---------------------------------------------------------------------------
function PoolCreator({ label, token0, token1, initialPrice, existingPool, onCreated }) {
  const { createPool, status, poolAddress, isCreating } = useCreatePool();
  useEffect(() => { if (poolAddress) onCreated(poolAddress); }, [poolAddress, onCreated]);

  if (existingPool) {
    return <StatusLine tone="ok">{label} pool exists — {existingPool}</StatusLine>;
  }
  return (
    <div className="mt-2">
      <button
        className={btnClass}
        disabled={isCreating || !(initialPrice > 0)}
        onClick={() => createPool({ token0, token1, initialPrice: Number(initialPrice), targetChainId: GNOSIS_CHAIN_ID })}
      >
        {isCreating ? 'Creating…' : `Create ${label} pool`}
      </button>
      {status?.message && <StatusLine tone={status.type === 'error' ? 'warn' : 'info'}>{status.message}</StatusLine>}
    </div>
  );
}

export function PoolsPanel({ proposalAddress, organization, metadataAddress }) {
  const { address: account, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: GNOSIS_CHAIN_ID });
  const { writeContractAsync } = useWriteContract();
  const [chainInfo, setChainInfo] = useState(null); // fetchProposalFromChain result
  const [initialPrice, setInitialPrice] = useState('');
  const [pools, setPools] = useState({ yes: null, no: null });
  const [verify, setVerify] = useState(null); // { ok, patch, merged, message } | null
  const [fixing, setFixing] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const info = await fetchProposalFromChain(proposalAddress, GNOSIS_CHAIN_ID);
      if (!live || !info) return;
      setChainInfo(info);
      const yes = info.pools.find((p) => p.outcomeSide === 'YES')?.id || null;
      const no = info.pools.find((p) => p.outcomeSide === 'NO')?.id || null;
      setPools({ yes, no });
    })();
    return () => { live = false; };
  }, [proposalAddress]);

  // Prefill the initial price from the org's spot ticker (last candle close).
  // Editable: a wrong initial price is the seeded-1000x-off bug — the operator
  // must eyeball it against the real spot price before creating pools.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { default: fetchSpotCandles } = await import('../../../spotPriceUtils/spotClient');
        const candles = await fetchSpotCandles(organization.spotPrice.ticker);
        const last = candles?.[candles.length - 1]; // spotClient returns {time, value}
        if (live && last?.value > 0) setInitialPrice(String(last.value));
      } catch { /* leave blank — operator fills in */ }
    })();
    return () => { live = false; };
  }, [organization.spotPrice.ticker]);

  const tokens = useMemo(() => {
    if (!chainInfo) return null;
    const bySymbolPrefix = (prefix, base) =>
      chainInfo.outcomeTokens.find((t) => t.symbol?.toUpperCase().startsWith(`${prefix}_${base.toUpperCase()}`))?.id;
    return {
      yesCompany: chainInfo.outcomeTokens[0]?.id,
      noCompany: chainInfo.outcomeTokens[1]?.id,
      yesCurrency: chainInfo.outcomeTokens[2]?.id,
      noCurrency: chainInfo.outcomeTokens[3]?.id,
      // symbol-based cross-check; wrappedOutcome index order is the authority
      _check: bySymbolPrefix('YES', chainInfo.companyToken.symbol),
    };
  }, [chainInfo]);

  const runVerification = async () => {
    setVerify(null);
    try {
      const [yesToken0, noToken0, rawMetadata, metadataURI] = await Promise.all([
        publicClient.readContract({ address: pools.yes, abi: TOKEN0_ABI, functionName: 'token0' }),
        publicClient.readContract({ address: pools.no, abi: TOKEN0_ABI, functionName: 'token0' }),
        publicClient.readContract({ address: metadataAddress, abi: CONTRACT_ABIS.PROPOSAL, functionName: 'metadata' }),
        publicClient.readContract({ address: metadataAddress, abi: CONTRACT_ABIS.PROPOSAL, functionName: 'metadataURI' }).catch(() => ''),
      ]);
      const original = JSON.parse(rawMetadata || '{}');
      const ctx = buildInvertContext({
        yesCompanyToken: tokens.yesCompany,
        noCompanyToken: tokens.noCompany,
        yesPoolToken0: yesToken0,
        noPoolToken0: noToken0,
      });
      const result = validateMetadata(original, ctx);
      const patch = buildInvertPatch(original, result.corrected);
      if (!patch) {
        setVerify({ ok: true, message: 'Invert flags verified against on-chain token0 — correct.' });
      } else {
        const merged = mergeMetadataForUpdate(rawMetadata, patch);
        setVerify({
          ok: false,
          patch,
          merged,
          metadataURI,
          message: `Flags wrong on-chain (${Object.entries(patch).map(([k, v]) => `${k}→${v}`).join(', ')}) — one transaction fixes them.`,
        });
      }
    } catch (e) {
      setVerify({ ok: false, message: `Verification failed: ${e.shortMessage || e.message}` });
    }
  };

  const fixFlags = async () => {
    setFixing(true);
    try {
      const hash = await writeContractAsync({
        address: metadataAddress,
        abi: CONTRACT_ABIS.PROPOSAL,
        functionName: 'updateExtendedMetadata',
        args: [JSON.stringify(verify.merged), verify.metadataURI || ''],
        chainId: GNOSIS_CHAIN_ID,
        account,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await runVerification();
    } catch (e) {
      setVerify((v) => ({ ...v, message: e.shortMessage || e.message }));
    } finally {
      setFixing(false);
    }
  };

  const bothPools = Boolean(pools.yes && pools.no);

  return (
    <section className={`${panelClass} p-4`}>
      <h2 className="text-lg font-semibold text-futarchyGray12 dark:text-white">Step 3 — Conditional pools + invert verification</h2>
      {!chainInfo ? (
        <StatusLine>Reading conditional tokens from the proposal…</StatusLine>
      ) : (
        <>
          <div className="mt-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-futarchyGray10" htmlFor="initialPrice">
              Initial price ({chainInfo.currencyToken.symbol} per {chainInfo.companyToken.symbol})
            </label>
            <input
              id="initialPrice"
              className={`${inputClass} mt-1 max-w-xs`}
              value={initialPrice}
              onChange={(e) => setInitialPrice(e.target.value)}
              placeholder="spot price"
            />
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              Must match the real spot price — a wrong initial price permanently distorts quotes.
            </p>
          </div>
          <PoolCreator
            label="YES"
            token0={tokens.yesCompany}
            token1={tokens.yesCurrency}
            initialPrice={initialPrice}
            existingPool={pools.yes}
            onCreated={(addr) => setPools((p) => ({ ...p, yes: addr }))}
          />
          <PoolCreator
            label="NO"
            token0={tokens.noCompany}
            token1={tokens.noCurrency}
            initialPrice={initialPrice}
            existingPool={pools.no}
            onCreated={(addr) => setPools((p) => ({ ...p, no: addr }))}
          />

          <div className="mt-4 border-t border-futarchyGray6 dark:border-futarchyGray7 pt-3">
            <button className={btnClass} disabled={!bothPools || !metadataAddress || !isConnected} onClick={runVerification}>
              Verify invert flags
            </button>
            {!metadataAddress && <StatusLine tone="warn">Write metadata (step 2) first.</StatusLine>}
            {verify && (
              <StatusLine tone={verify.ok ? 'ok' : 'warn'}>{verify.message}</StatusLine>
            )}
            {verify && verify.patch && (
              <button className={`${btnClass} mt-2`} disabled={fixing} onClick={fixFlags}>
                {fixing ? 'Fixing…' : 'Fix flags (updateExtendedMetadata)'}
              </button>
            )}
            <p className="mt-3 text-xs text-futarchyGray9 italic">
              After seeding liquidity, make one small trigger trade so charts and pool liquidity
              read correctly from the first candle.
            </p>
          </div>
        </>
      )}
    </section>
  );
}

export default function WizardSteps23({ proposalAddress, form, organization, organizationId }) {
  const [metadataAddress, setMetadataAddress] = useState(null);
  if (!ADDR.test(proposalAddress || '')) return null;
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <MetadataWritePanel
        proposalAddress={proposalAddress}
        form={form}
        organization={organization}
        organizationId={organizationId}
        metadataAddress={metadataAddress}
        onMetadataContract={setMetadataAddress}
      />
      <PoolsPanel
        proposalAddress={proposalAddress}
        organization={organization}
        metadataAddress={metadataAddress}
      />
    </div>
  );
}
