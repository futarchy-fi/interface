import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  buildOneStepMarketPlan,
  createMarketWizardDefaults,
  deriveTwapTiming,
  KNOWN_ORGANIZATIONS,
  GNOSIS_CHAIN_ID,
  REALITY_OPENING_BUFFER_SECONDS,
} from '../../../features/marketCreation/marketCreationWorkflow';
import { validateMetadata } from '../../../features/marketCreation/validateMetadata';
import { evaluateFloor, ZERO_TRADE_NOTICE, FLOOR_TRADE_USD, FLOOR_MAX_IMPACT } from '../../../features/marketCreation/liquidityFloor';
import useCreateProposal, { simulateProposal } from '../../debug/hooks/useCreateProposal';
import RootLayout from '../../layout/RootLayout';
import PageLayout from '../../layout/PageLayout';

const panelClass = 'border border-futarchyGray6 dark:border-futarchyGray7 bg-white dark:bg-futarchyGray2 rounded-lg';
const inputClass = 'w-full px-3 py-2 bg-futarchyGray2 dark:bg-futarchyGray3 border border-futarchyGray6 dark:border-futarchyGray7 rounded-md text-sm text-futarchyGray12 dark:text-white focus:outline-none focus:ring-2 focus:ring-futarchyBlue9';
const labelClass = 'text-xs font-semibold uppercase tracking-wide text-futarchyGray10 dark:text-futarchyGray11';

function formatDate(timestamp) {
  if (!timestamp) return 'Not set';
  return new Date(Number(timestamp) * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

function formatLiquidityMode(mode) {
  return mode === 'flm' ? 'Liquidity manager' : String(mode || '').toUpperCase();
}

function StageList({ stages }) {
  return (
    <ol className="divide-y divide-futarchyGray5 dark:divide-futarchyGray7">
      {stages.map((stage) => (
        <li key={stage.id} className="grid gap-2 md:grid-cols-[48px_220px_1fr] px-4 py-3">
          <div className="text-sm font-semibold text-futarchyBlue9">{String(stage.order).padStart(2, '0')}</div>
          <div>
            <div className="text-sm font-semibold text-futarchyGray12 dark:text-white">{stage.title}</div>
            {stage.dependsOn?.length ? (
              <div className="mt-1 text-xs text-futarchyGray10">After: {stage.dependsOn.join(', ')}</div>
            ) : null}
          </div>
          <div>
            <p className="text-sm text-futarchyGray11 dark:text-futarchyGray11">{stage.summary}</p>
            {stage.requiredEvidence?.length ? (
              <p className="mt-1 text-xs text-futarchyGray9">
                Evidence: {stage.requiredEvidence.join(', ')}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ActionList({ actions }) {
  return (
    <ol className="divide-y divide-futarchyGray5 dark:divide-futarchyGray7">
      {actions.map((action) => (
        <li key={action.id} className="grid gap-2 px-4 py-3 md:grid-cols-[48px_270px_1fr]">
          <div className="text-sm font-semibold text-futarchyBlue9">{String(action.order).padStart(2, '0')}</div>
          <div>
            <div className="break-words font-mono text-xs font-semibold text-futarchyGray12 dark:text-white">
              {action.contract}.{action.method}
            </div>
            <div className="mt-1 text-xs uppercase text-futarchyGray9">Stage: {action.stageId}</div>
            {action.dependsOn?.length ? (
              <div className="mt-1 break-words text-xs text-futarchyGray10">After: {action.dependsOn.join(', ')}</div>
            ) : null}
          </div>
          <div>
            <p className="text-sm text-futarchyGray11 dark:text-futarchyGray11">{action.summary}</p>
            {action.produces?.length ? (
              <p className="mt-1 text-xs text-futarchyGray9">Produces: {action.produces.join(', ')}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function MetadataPreview({ metadata }) {
  return (
    <pre className="max-h-[420px] overflow-auto rounded-md bg-futarchyGray2 dark:bg-futarchyDarkGray3 border border-futarchyGray6 dark:border-futarchyGray7 p-4 text-xs text-futarchyGray12 dark:text-futarchyGray11">
      {JSON.stringify(metadata, null, 2)}
    </pre>
  );
}

const badge = (ok) => ok
  ? 'text-emerald-600 dark:text-emerald-400'
  : 'text-amber-600 dark:text-amber-400';

// R1 floor gate + metadata validation + R3 honesty. Pre-creation, the floor is
// evaluated against the planned bootstrap seed (the honest lower bound): a
// pinhead seed correctly reads as DRAFT, which is the whole point — a wizard
// that mints dead markets would be worse than no wizard.
function ReadinessPanel({ metadataDraft, bootstrap }) {
  // Pool data doesn't exist at step 1 — invert checks defer with a warning.
  // nowUnix arms the window-starts-in-the-past gate against stale drafts.
  const validation = useMemo(
    () => validateMetadata(metadataDraft, { nowUnix: Math.floor(Date.now() / 1000) }),
    [metadataDraft]
  );
  // Treat the currency seed (~sDAI ≈ $1) as the input reserve; company seed as output.
  const floor = useMemo(() => evaluateFloor({
    reserveInTokens: Number(bootstrap?.currencyToken || 0),
    reserveOutTokens: Number(bootstrap?.companyToken || 0),
    inputUsdPrice: 1,
  }), [bootstrap]);

  return (
    <section className={`${panelClass} p-4`}>
      <h2 className="text-lg font-semibold text-futarchyGray12 dark:text-white">Readiness gate</h2>
      <p className="mt-1 text-sm text-futarchyGray11">
        A market goes live only when its metadata is valid and a ${FLOOR_TRADE_USD} trade moves
        price under {(FLOOR_MAX_IMPACT * 100)}%. Below the floor it stays a draft.
      </p>

      <div className="mt-4 rounded-md border border-futarchyGray6 dark:border-futarchyGray7 p-3">
        <div className="flex items-center justify-between">
          <span className={labelClass}>Liquidity floor</span>
          <span className={`text-sm font-semibold ${badge(floor.passes)}`}>
            {floor.state}
          </span>
        </div>
        <p className="mt-1 text-xs text-futarchyGray10">{floor.reason} (from the planned seed).</p>
      </div>

      <div className="mt-3 rounded-md border border-futarchyGray6 dark:border-futarchyGray7 p-3">
        <div className="flex items-center justify-between">
          <span className={labelClass}>Metadata</span>
          <span className={`text-sm font-semibold ${badge(validation.ok)}`}>
            {validation.ok ? 'Valid' : `${validation.errors.length} issue${validation.errors.length === 1 ? '' : 's'}`}
          </span>
        </div>
        {validation.errors.map((e, i) => (
          <p key={i} className="mt-1 text-xs text-amber-600 dark:text-amber-400">• {e}</p>
        ))}
        {validation.warnings.map((w, i) => (
          <p key={i} className="mt-1 text-xs text-futarchyGray10">• {w}</p>
        ))}
      </div>

      <p className="mt-3 text-xs text-futarchyGray9 italic">{ZERO_TRADE_NOTICE}</p>
    </section>
  );
}

// Real, wallet-connected proposal creation. Simulate-first (no broadcast) so the
// flow is demoable end-to-end without minting a market; Broadcast sends the tx.
function ExecutePanel({ form, organization }) {
  const { isConnected, isSubmitting, status, transactionHash, proposalAddress, createProposal } = useCreateProposal();
  const [mode, setMode] = useState('simulate');
  const [simResult, setSimResult] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Epoch seconds end-to-end: an ISO string re-parsed as local time shifted the
  // on-chain openingTime by the operator's UTC offset.
  const closeValid = Number.isFinite(form.closeTimestamp);
  const formData = closeValid ? {
    chainId: GNOSIS_CHAIN_ID,
    marketName: form.proposalCode,
    companyToken: organization.companyToken.address,
    currencyToken: organization.currencyToken.address,
    category: 'crypto',
    language: 'en',
    minBond: form.minBondWei,
    openingTimeUnix: form.closeTimestamp + REALITY_OPENING_BUFFER_SECONDS,
  } : null;

  const onRun = async () => {
    if (!formData) return;
    setSimResult(null);
    if (mode === 'broadcast') {
      await createProposal(formData);
      return;
    }
    setIsSimulating(true);
    try {
      const result = await simulateProposal(formData);
      setSimResult({ ok: result.ok, msg: result.message });
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <section className={`${panelClass} p-4`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-futarchyGray12 dark:text-white">Create proposal</h2>
        <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
      </div>
      <p className="mt-1 text-sm text-futarchyGray11">
        The permissionless, proven first step. Simulate runs a static call against Gnosis with no
        broadcast; Broadcast sends the real transaction from your wallet. Pools, liquidity manager,
        Snapshot, and arbitrage follow as the staged plan below.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border border-futarchyGray6 dark:border-futarchyGray7 p-0.5">
          {['simulate', 'broadcast'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 text-sm rounded ${mode === m
                ? 'bg-futarchyBlue9 text-white'
                : 'text-futarchyGray11'}`}
            >
              {m === 'simulate' ? 'Simulate' : 'Sign & broadcast'}
            </button>
          ))}
        </div>
        <button
          onClick={onRun}
          disabled={!closeValid || isSubmitting || isSimulating || (mode === 'broadcast' && !isConnected)}
          className="inline-flex h-9 items-center rounded-md bg-futarchyBlue9 px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {(isSubmitting || isSimulating) ? 'Working…' : mode === 'simulate' ? 'Simulate createProposal' : 'Create proposal'}
        </button>
        {!closeValid && (
          <span className="text-xs text-amber-600 dark:text-amber-400">Pick a valid close date.</span>
        )}
        {closeValid && mode === 'broadcast' && !isConnected && (
          <span className="text-xs text-amber-600 dark:text-amber-400">Connect a wallet to broadcast.</span>
        )}
      </div>

      {simResult && (
        <p className={`mt-3 text-sm ${simResult.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
          {simResult.msg}
        </p>
      )}
      {status && (
        <p className="mt-3 text-sm text-futarchyGray11">{status.message}</p>
      )}
      {transactionHash && (
        <p className="mt-1 text-xs font-mono text-futarchyBlue9 break-all">tx: {transactionHash}</p>
      )}
      {proposalAddress && (
        <p className="mt-1 text-xs font-mono text-emerald-600 dark:text-emerald-400 break-all">proposal: {proposalAddress}</p>
      )}
    </section>
  );
}

export default function CreateMarketFlow() {
  const [organizationId, setOrganizationId] = useState('kleros');
  // Defaults are Date.now()-derived, and wallet panels use wagmi hooks — both
  // must stay out of the static export. form stays null until client mount, so
  // the exported HTML carries the page frame but no build-time timestamps
  // (which caused React 18 hydration mismatches and days-stale dates).
  const [form, setForm] = useState(null);
  useEffect(() => {
    setForm(createMarketWizardDefaults({ organizationId: 'kleros' }));
  }, []);

  const selectedOrganization = KNOWN_ORGANIZATIONS[organizationId];
  const marketPlan = useMemo(
    () => (form ? buildOneStepMarketPlan({ ...form, organizationId }) : null),
    [form, organizationId]
  );

  const updateOrganization = (nextOrganizationId) => {
    setOrganizationId(nextOrganizationId);
    setForm(createMarketWizardDefaults({ organizationId: nextOrganizationId }));
  };

  const updateField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const updateCloseDate = (value) => {
    const nextTimestamp = Math.floor(new Date(value).getTime() / 1000);
    setForm((previous) => {
      if (!value || !Number.isFinite(nextTimestamp)) {
        // Cleared/invalid input: never store NaN — ExecutePanel disables on null.
        return { ...previous, closeDateTimeLocal: value, closeTimestamp: null };
      }
      return {
        ...previous,
        closeDateTimeLocal: value,
        closeTimestamp: nextTimestamp,
        ...deriveTwapTiming(nextTimestamp, previous.twapDurationHours),
      };
    });
  };

  return (
    <RootLayout headerConfig="app" footerConfig="main">
      <PageLayout contentClassName="max-w-7xl">
        <div className="py-8">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-futarchyGray12 dark:text-white">Create Market</h1>
              <p className="mt-2 max-w-3xl text-sm text-futarchyGray11 dark:text-futarchyGray11">
                A single operational flow for organization setup, proposal metadata, market creation,
                liquidity manager setup, Snapshot linking, candle readiness, arbitrage setup, and publishing.
              </p>
            </div>
            <Link
              href="/companies"
              className="inline-flex h-10 items-center justify-center rounded-md border border-futarchyGray6 px-4 text-sm font-medium text-futarchyGray12 dark:border-futarchyGray7 dark:text-white"
            >
              Companies
            </Link>
          </div>

          {!form ? (
            // Static-export frame: real wizard markup (headings, copy) but no
            // timestamps — the interactive panels mount client-side.
            <div className="grid gap-6 lg:grid-cols-2">
              {['Create proposal', 'Readiness gate', 'Market Defaults', 'One-Step Execution Plan'].map((title) => (
                <section key={title} className={`${panelClass} p-4`}>
                  <h2 className="text-lg font-semibold text-futarchyGray12 dark:text-white">{title}</h2>
                  <p className="mt-1 text-sm text-futarchyGray11">Loading…</p>
                </section>
              ))}
            </div>
          ) : (
          <>
          <div className="grid gap-6 lg:grid-cols-2 mb-6">
            <ExecutePanel form={form} organization={selectedOrganization} />
            <ReadinessPanel
              metadataDraft={marketPlan.metadataDraft}
              bootstrap={form.initialLiquidityBudget}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <section className={`${panelClass} p-4`}>
              <h2 className="text-lg font-semibold text-futarchyGray12 dark:text-white">Market Defaults</h2>

              <div className="mt-5 space-y-4">
                <div>
                  <label className={labelClass} htmlFor="organization">Organization</label>
                  <select
                    id="organization"
                    className={`${inputClass} mt-1`}
                    value={organizationId}
                    onChange={(event) => updateOrganization(event.target.value)}
                  >
                    {Object.values(KNOWN_ORGANIZATIONS).map((org) => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass} htmlFor="proposalCode">Proposal Code</label>
                  <input
                    id="proposalCode"
                    className={`${inputClass} mt-1`}
                    value={form.proposalCode}
                    onChange={(event) => updateField('proposalCode', event.target.value)}
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="displayTitle0">Display Title</label>
                  <input
                    id="displayTitle0"
                    className={`${inputClass} mt-1`}
                    value={form.displayTitle0}
                    onChange={(event) => updateField('displayTitle0', event.target.value)}
                  />
                  <input
                    aria-label="Display title event"
                    className={`${inputClass} mt-2`}
                    value={form.displayTitle1}
                    onChange={(event) => updateField('displayTitle1', event.target.value)}
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="question">Resolution Question</label>
                  <textarea
                    id="question"
                    className={`${inputClass} mt-1 min-h-[88px]`}
                    value={form.question}
                    onChange={(event) => updateField('question', event.target.value)}
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="snapshotId">Snapshot Proposal Hash</label>
                  <input
                    id="snapshotId"
                    className={`${inputClass} mt-1 font-mono`}
                    placeholder="0x..."
                    value={form.snapshotId}
                    onChange={(event) => updateField('snapshotId', event.target.value)}
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="closeDate">Vote Close Time</label>
                  <input
                    id="closeDate"
                    type="datetime-local"
                    className={`${inputClass} mt-1`}
                    value={form.closeDateTimeLocal}
                    onChange={(event) => updateCloseDate(event.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className={labelClass}>Company Token</div>
                    <div className="mt-1 rounded-md border border-futarchyGray6 p-3 text-sm dark:border-futarchyGray7">
                      <div className="font-semibold text-futarchyGray12 dark:text-white">{selectedOrganization.companyToken.symbol}</div>
                      <div className="mt-1 break-all font-mono text-xs text-futarchyGray10">{selectedOrganization.companyToken.address}</div>
                    </div>
                  </div>
                  <div>
                    <div className={labelClass}>Currency Token</div>
                    <div className="mt-1 rounded-md border border-futarchyGray6 p-3 text-sm dark:border-futarchyGray7">
                      <div className="font-semibold text-futarchyGray12 dark:text-white">{selectedOrganization.currencyToken.symbol}</div>
                      <div className="mt-1 break-all font-mono text-xs text-futarchyGray10">{selectedOrganization.currencyToken.address}</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className={`${panelClass}`}>
              <div className="border-b border-futarchyGray6 px-4 py-3 dark:border-futarchyGray7">
                <h2 className="text-lg font-semibold text-futarchyGray12 dark:text-white">One-Step Execution Plan</h2>
                <div className="mt-2 grid gap-2 text-xs text-futarchyGray10 md:grid-cols-3">
                  <span>Org: {marketPlan.values.organizationName}</span>
                  <span>Close: {formatDate(marketPlan.values.closeTimestamp)}</span>
                  <span>Liquidity: {formatLiquidityMode(marketPlan.values.initialLiquidityMode)}</span>
                </div>
              </div>
              <StageList stages={marketPlan.stages} />
              <div className="border-t border-futarchyGray6 px-4 py-3 dark:border-futarchyGray7">
                <h3 className="text-sm font-semibold text-futarchyGray12 dark:text-white">Contract Actions</h3>
              </div>
              <ActionList actions={marketPlan.contractActions} />
            </section>
          </div>

          <section className={`${panelClass} mt-6 p-4`}>
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-futarchyGray12 dark:text-white">Generated Metadata Draft</h2>
                <p className="mt-1 text-sm text-futarchyGray11">
                  This is the registry metadata shape the one-step flow will pass into the market
                  creation and proposal metadata writes.
                </p>
              </div>
              <Link
                href={`/milestones?company_id=${selectedOrganization.organizationAddress}`}
                className="inline-flex h-9 items-center justify-center rounded-md border border-futarchyGray6 px-3 text-sm text-futarchyGray12 dark:border-futarchyGray7 dark:text-white"
              >
                Open organization
              </Link>
            </div>
            <MetadataPreview metadata={marketPlan.metadataDraft} />
          </section>
          </>
          )}
        </div>
      </PageLayout>
    </RootLayout>
  );
}
