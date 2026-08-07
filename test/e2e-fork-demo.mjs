// End-to-end demonstration of the self-serve client journey on a Gnosis fork:
//   create proposal → org metadata write → conditional pools → invert-flag
//   verification (and correction) — the exact call paths the wizard UI uses,
//   executed by a NON-KELVIN client wallet. Zero transactions from Kelvin's
//   proposer EOA (0x645A…); the org owner appears once only to grant editor()
//   to the client (the ratified mixed-mode onboarding step).
//
// Run: node test/e2e-fork-demo.mjs            (spawns its own anvil fork)
//      ANVIL_RPC=http://127.0.0.1:8546 node test/e2e-fork-demo.mjs  (reuse one)
//
// This is the goal's success-criterion mechanics on a fork; the browser-level
// twin of this flow is the auto-qa harness scenario that follows PR #94.
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import {
  createMarketWizardDefaults,
  buildMetadataDraft,
  deriveTwapTiming,
  REALITY_OPENING_BUFFER_SECONDS,
  TWAP_BUFFER_SECONDS,
} from '../src/features/marketCreation/marketCreationWorkflow.js';
import { buildProposalParams, FUTARCHY_FACTORY_ABI } from '../src/features/marketCreation/proposalCalldata.js';
import { buildProposalMetadataArgs, buildInvertContext, buildInvertPatch } from '../src/features/marketCreation/orgMetadataWrite.js';
import { validateMetadata, mergeMetadataForUpdate } from '../src/features/marketCreation/validateMetadata.js';

const FORK_URL = process.env.FORK_URL || 'https://rpc.gnosischain.com';
const KELVIN_EOA = '0x645a0b04e0891eb8b4a1a15dd547e3e29b17c157'; // must sign NOTHING
const ORG = '0xaAB097ead5c2Db1Ca7b1E5034224A2118EDAbe36'; // Kleros DAO org
const ORG_OWNER = '0xeb2aec308e7b3340dea2e89d40187d2637c6c649';
const FACTORY = '0xa6cB18FCDC17a2B44E5cAd2d80a6D5942d30a345';
const NFPM = '0x91fd594c46d8b01e62dbdebed2401dde01817834'; // Algebra position manager
const ALGEBRA_FACTORY = '0xA0864cCA6E114013AB0e27cbd5B6f4c8947da766';

const FULL = process.argv.includes('--full') || process.env.FULL === '1';
const ROUTER = '0x7495a583ba85875d59407781b4958ED6e0E1228f'; // FutarchyRouter (adapter)
const ROUTER_ABI = [
  'function splitPosition(address proposal, address collateralToken, uint256 amount)',
  'function redeemProposal(address proposal, uint256 amount1, uint256 amount2)',
];
const ERC20_ABI = [
  'function approve(address,uint256) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address,uint256) returns (bool)',
  'function decimals() view returns (uint8)',
];
const FACTORY_RESOLUTION_ABI = [
  'function realityProxy() view returns (address)',
  'function realitio() view returns (address)',
  'function conditionalTokens() view returns (address)',
];
const REALITY_PROXY_ABI = ['function resolve(address proposal)'];
const CTF_ABI = ['function payoutNumerators(bytes32, uint256) view returns (uint256)'];
const REALITY_ABI = [
  'function submitAnswer(bytes32 question_id, bytes32 answer, uint256 max_previous) payable',
  'function resultFor(bytes32) view returns (bytes32)',
  'function isFinalized(bytes32) view returns (bool)',
];
const NFPM_MINT_ABI = [
  'function mint((address token0, address token1, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
];

const ORG_ABI = [
  'function setEditor(address _editor)',
  'function editor() view returns (address)',
  'function owner() view returns (address)',
  'function createAndAddProposalMetadata(address,string,string,string,string,string)',
  'function getProposals(uint256,uint256) view returns (address[])',
];
const PROPOSAL_ABI = [
  'function wrappedOutcome(uint256) view returns (address, bytes)',
];
const METADATA_ABI = [
  'function metadata() view returns (string)',
  'function metadataURI() view returns (string)',
  'function updateExtendedMetadata(string,string)',
  'function editor() view returns (address)',
  'function owner() view returns (address)',
];
const NFPM_ABI = [
  'function createAndInitializePoolIfNecessary(address token0, address token1, uint160 sqrtPriceX96) payable returns (address pool)',
];
const ALGEBRA_FACTORY_ABI = ['function poolByPair(address,address) view returns (address)'];
const POOL_ABI = ['function token0() view returns (address)'];

// Same math as useCreatePool (not importable in node: that file pulls wagmi).
function priceToSqrtPriceX96(price) {
  return BigInt(Math.floor(Math.sqrt(price) * Number(2n ** 96n)));
}
function ammOrder(a, b, price) {
  return a.toLowerCase() < b.toLowerCase()
    ? { token0: a, token1: b, sqrtPrice: priceToSqrtPriceX96(price) }
    : { token0: b, token1: a, sqrtPrice: priceToSqrtPriceX96(1 / price) };
}

async function startAnvil() {
  if (process.env.ANVIL_RPC) return { url: process.env.ANVIL_RPC, proc: null };
  const proc = spawn('anvil', ['--fork-url', FORK_URL, '--port', '8547', '--silent'], { stdio: 'ignore' });
  const url = 'http://127.0.0.1:8547';
  const probe = new ethers.providers.JsonRpcProvider(url);
  for (let i = 0; i < 60; i++) {
    try { await probe.getBlockNumber(); return { url, proc }; }
    catch { await new Promise((r) => setTimeout(r, 1000)); }
  }
  throw new Error('anvil did not become ready');
}

const { url, proc } = await startAnvil();
const provider = new ethers.providers.JsonRpcProvider(url);
const signedBy = [];
const track = async (txPromise, label) => {
  const tx = await txPromise;
  const receipt = await tx.wait();
  signedBy.push({ label, from: receipt.from.toLowerCase() });
  console.log(`  ✓ ${label} (from ${receipt.from}, gas ${receipt.gasUsed})`);
  return receipt;
};

try {
  // The non-Kelvin client: anvil's default funded account #0.
  const client = provider.getSigner(0);
  const clientAddr = await client.getAddress();
  console.log(`client org-manager wallet: ${clientAddr}`);

  // ── One-time org onboarding (mixed-mode): owner grants editor() to client ──
  await provider.send('anvil_impersonateAccount', [ORG_OWNER]);
  await provider.send('anvil_setBalance', [ORG_OWNER, '0x8AC7230489E80000']);
  const orgAsOwner = new ethers.Contract(ORG, ORG_ABI, provider.getSigner(ORG_OWNER));
  await track(orgAsOwner.setEditor(clientAddr), 'org.setEditor(client) — one-time onboarding grant');
  await provider.send('anvil_stopImpersonatingAccount', [ORG_OWNER]);

  // ── Step 1: createProposal, wizard defaults + shared calldata builder ──
  const now = (await provider.getBlock('latest')).timestamp;
  const form = createMarketWizardDefaults({ organizationId: 'kleros', nowSeconds: now });
  const formData = {
    chainId: 100,
    marketName: `${form.proposalCode}-E2E-DEMO`,
    companyToken: form.companyToken.address,
    currencyToken: form.currencyToken.address,
    category: 'crypto',
    language: 'en',
    minBond: form.minBondWei,
    openingTimeUnix: form.closeTimestamp + REALITY_OPENING_BUFFER_SECONDS,
  };
  const params = buildProposalParams(formData);
  const factory = new ethers.Contract(FACTORY, FUTARCHY_FACTORY_ABI, client);
  const proposalAddress = await factory.callStatic.createProposal(params);
  await track(factory.createProposal(params), `factory.createProposal → ${proposalAddress}`);

  // ── Step 2: metadata write by the client (as org editor) ──
  const timing = deriveTwapTiming(form.closeTimestamp);
  const draft = {
    ...buildMetadataDraft({ ...form, organizationId: 'kleros', proposalAddress, nowSeconds: now }),
    ...timing,
    invertTwapPoolYes: false,
    invertTwapPoolNo: false,
  };
  const validation = validateMetadata(draft, { nowUnix: now });
  assert.ok(validation.errors.every((e) => !e.includes('starts in the past')), 'fresh draft must pass the past-start gate');
  const orgAsClient = new ethers.Contract(ORG, ORG_ABI, client);
  await track(
    orgAsClient.createAndAddProposalMetadata(...buildProposalMetadataArgs({
      proposalAddress, question: form.question, event: form.displayTitle1,
      description: form.description, metadata: draft,
    })),
    'org.createAndAddProposalMetadata (client as editor)'
  );
  const proposals = await orgAsClient.getProposals(0, 1000);
  const metadataAddress = proposals[proposals.length - 1];
  console.log(`  metadata contract: ${metadataAddress}`);

  // ── Step 3: conditional pools + invert verification ──
  const proposal = new ethers.Contract(proposalAddress, PROPOSAL_ABI, provider);
  const [yesCompany] = await proposal.wrappedOutcome(0);
  const [noCompany] = await proposal.wrappedOutcome(1);
  const [yesCurrency] = await proposal.wrappedOutcome(2);
  const [noCurrency] = await proposal.wrappedOutcome(3);

  const spotPrice = 0.02; // demo anchor (sDAI per PNK); the UI prefills real spot
  const nfpm = new ethers.Contract(NFPM, NFPM_ABI, client);
  for (const [label, a, b] of [['YES', yesCompany, yesCurrency], ['NO', noCompany, noCurrency]]) {
    const o = ammOrder(a, b, spotPrice);
    await track(
      nfpm.createAndInitializePoolIfNecessary(o.token0, o.token1, o.sqrtPrice, { gasLimit: 16000000 }),
      `create ${label} pool`
    );
  }
  const algebraFactory = new ethers.Contract(ALGEBRA_FACTORY, ALGEBRA_FACTORY_ABI, provider);
  const yesPool = await algebraFactory.poolByPair(yesCompany, yesCurrency);
  const noPool = await algebraFactory.poolByPair(noCompany, noCurrency);
  const yesToken0 = await new ethers.Contract(yesPool, POOL_ABI, provider).token0();
  const noToken0 = await new ethers.Contract(noPool, POOL_ABI, provider).token0();

  const metadataContract = new ethers.Contract(metadataAddress, METADATA_ABI, provider);
  const raw = await metadataContract.metadata();
  const onChain = JSON.parse(raw);
  const ctx = buildInvertContext({
    yesCompanyToken: yesCompany, noCompanyToken: noCompany,
    yesPoolToken0: yesToken0, noPoolToken0: noToken0,
  });
  let result = validateMetadata(onChain, ctx);
  const patch = buildInvertPatch(onChain, result.corrected);
  if (patch) {
    console.log(`  invert flags wrong on-chain (${JSON.stringify(patch)}) — client fixes with one tx`);
    const merged = mergeMetadataForUpdate(raw, patch);
    const uri = await metadataContract.metadataURI().catch(() => '');
    await track(
      metadataContract.connect(client).updateExtendedMetadata(JSON.stringify(merged), uri),
      'metadata.updateExtendedMetadata (flags-only correction)'
    );
    result = validateMetadata(mergeMetadataForUpdate(await metadataContract.metadata(), {}), ctx);
  }

  // ── Assertions: the goal's success-criterion mechanics ──
  assert.equal(result.errors.filter((e) => e.includes('invert')).length, 0, 'invert flags verified against on-chain token0');
  assert.equal(Number(onChain.twapDurationHours), 120, '0xAlex window: 120h');
  assert.equal(Number(onChain.twapStartTimestamp) + 120 * 3600, Number(onChain.closeTimestamp) - TWAP_BUFFER_SECONDS, 'window ends 48h before close');
  assert.ok(Number(onChain.twapStartTimestamp) >= now - 60, 'window starts at creation, not before');
  const kelvinTxs = signedBy.filter((t) => t.from === KELVIN_EOA);
  assert.equal(kelvinTxs.length, 0, 'zero Kelvin-signed transactions');
  const ownerTxs = signedBy.filter((t) => t.from === ORG_OWNER.toLowerCase());
  assert.equal(ownerTxs.length, 1, 'org owner appears exactly once (the onboarding grant)');

  console.log('\nPASS (create → metadata → pools → invert-verified):');
  console.log(`  proposal ${proposalAddress}`);
  console.log(`  metadata ${metadataAddress} (TWAP ${onChain.twapStartTimestamp} +120h, ends close−48h)`);
  console.log(`  pools YES ${yesPool} / NO ${noPool}, invert flags verified`);
  console.log(`  ${signedBy.length} txs total, 0 from Kelvin's EOA, owner only for setEditor`);

  if (FULL) {
    const { evaluateFloor } = await import('../src/features/marketCreation/liquidityFloor.js');
    const wei = (n) => ethers.utils.parseEther(String(n));

    // ── LIVE: fund the client from fork whales, split, seed both pools ──
    // Demo amounts only — the PRODUCT's liquidity defaults stay a deferred
    // Kelvin decision (§5a); a throwaway fork demo decides nothing.
    const fundFromWhale = async (token, amount, label) => {
      const holders = await (await fetch(`https://gnosis.blockscout.com/api/v2/tokens/${token}/holders`)).json();
      const erc20 = new ethers.Contract(token, ERC20_ABI, provider);
      for (const h of holders.items || []) {
        const whale = h.address?.hash || h.address;
        if (!whale || whale.toLowerCase() === ROUTER.toLowerCase()) continue;
        try {
          if ((await erc20.balanceOf(whale)).lt(amount)) continue;
          await provider.send('anvil_impersonateAccount', [whale]);
          await provider.send('anvil_setBalance', [whale, '0x8AC7230489E80000']);
          const ok = await erc20.connect(provider.getSigner(whale)).transfer(clientAddr, amount)
            .then((tx) => tx.wait()).then(() => true).catch(() => false);
          await provider.send('anvil_stopImpersonatingAccount', [whale]);
          if (ok) { console.log(`  funded ${label} from whale ${whale}`); return true; }
        } catch { /* try next holder */ }
      }
      throw new Error(`no usable ${label} whale on fork`);
    };
    const COMPANY = form.companyToken.address; // PNK
    const CURRENCY = form.currencyToken.address; // sDAI
    const currencyAmount = wei(12000); // ~$12k → floor comfortably passes
    const companyAmount = wei(Math.round(12000 / spotPrice)); // matching value at spot
    await fundFromWhale(CURRENCY, currencyAmount, 'sDAI');
    await fundFromWhale(COMPANY, companyAmount, 'PNK');

    const router = new ethers.Contract(ROUTER, ROUTER_ABI, client);
    for (const [token, amount, label] of [[CURRENCY, currencyAmount, 'sDAI'], [COMPANY, companyAmount, 'PNK']]) {
      await track(new ethers.Contract(token, ERC20_ABI, client).approve(ROUTER, amount), `approve router (${label})`);
      await track(router.splitPosition(proposalAddress, token, amount, { gasLimit: 3000000 }), `router.splitPosition ${label} → YES/NO`);
    }

    // LP both conditional pools full-range; keep 10% of outcome tokens unpooled
    // so redemption after resolution is visible in the wallet.
    const nfpmMint = new ethers.Contract(NFPM, NFPM_MINT_ABI, client);
    const seedPool = async (label, companyTok, currencyTok) => {
      const coBal = (await new ethers.Contract(companyTok, ERC20_ABI, provider).balanceOf(clientAddr)).mul(90).div(100);
      const cuBal = (await new ethers.Contract(currencyTok, ERC20_ABI, provider).balanceOf(clientAddr)).mul(90).div(100);
      await track(new ethers.Contract(companyTok, ERC20_ABI, client).approve(NFPM, coBal), `approve NFPM (${label} company)`);
      await track(new ethers.Contract(currencyTok, ERC20_ABI, client).approve(NFPM, cuBal), `approve NFPM (${label} currency)`);
      const [t0, t1] = companyTok.toLowerCase() < currencyTok.toLowerCase() ? [companyTok, currencyTok] : [currencyTok, companyTok];
      const [a0, a1] = t0 === companyTok ? [coBal, cuBal] : [cuBal, coBal];
      await track(nfpmMint.mint({
        token0: t0, token1: t1, tickLower: -887220, tickUpper: 887220,
        amount0Desired: a0, amount1Desired: a1, amount0Min: 0, amount1Min: 0,
        recipient: clientAddr, deadline: now + 86400 * 30,
      }, { gasLimit: 16000000 }), `seed ${label} pool liquidity`);
    };
    await seedPool('YES', yesCompany, yesCurrency);
    await seedPool('NO', noCompany, noCurrency);

    // Floor gate on the REAL seeded reserves → LIVE.
    const yesCurrencyReserve = Number(ethers.utils.formatEther(
      await new ethers.Contract(yesCurrency, ERC20_ABI, provider).balanceOf(yesPool)));
    const floor = evaluateFloor({
      reserveInTokens: yesCurrencyReserve,
      reserveOutTokens: yesCurrencyReserve / spotPrice,
      inputUsdPrice: 1,
    });
    assert.equal(floor.state, 'LIVE', `floor gate must pass with seeded reserves (${floor.reason})`);
    console.log(`  LIVE — YES pool holds ~$${Math.round(yesCurrencyReserve)} currency; ${floor.reason}`);

    // ── RESOLVED: warp past openingTime, answer on Reality, resolve, redeem ──
    // futarchyProposalParams() struct shape varies across factory versions —
    // decode raw: word0 = conditionId, word6 = questionId (verified against
    // this factory's live return layout; both sanity-asserted nonzero).
    const rawParams = await provider.call({ to: proposalAddress, data: '0x66b32916' });
    const word = (i) => '0x' + rawParams.slice(2 + i * 64, 2 + (i + 1) * 64);
    const params2 = { conditionId: word(0), questionId: word(6) };
    assert.notEqual(params2.conditionId, ethers.constants.HashZero, 'conditionId decoded');
    assert.notEqual(params2.questionId, ethers.constants.HashZero, 'questionId decoded');
    const factoryRes = new ethers.Contract(FACTORY, FACTORY_RESOLUTION_ABI, provider);
    const [realityProxyAddr, realityAddr, ctfAddr] = await Promise.all([
      factoryRes.realityProxy(), factoryRes.realitio(), factoryRes.conditionalTokens(),
    ]);
    const openingTime = formData.openingTimeUnix;
    await provider.send('evm_setNextBlockTimestamp', [openingTime + 60]);
    await provider.send('evm_mine', []);
    const reality = new ethers.Contract(realityAddr, REALITY_ABI, client);
    const YES_ANSWER = ethers.utils.hexZeroPad('0x01', 32); // outcome index 1 = proposal accepted
    await track(
      reality.submitAnswer(params2.questionId, YES_ANSWER, 0, { value: wei(1) }),
      'reality.submitAnswer (1 xDAI bond) — client-posted'
    );
    await provider.send('evm_increaseTime', [Math.ceil(3.5 * 86400) + 60]);
    await provider.send('evm_mine', []);
    assert.equal(await reality.isFinalized(params2.questionId), true, 'Reality answer finalized after timeout');
    await track(
      new ethers.Contract(realityProxyAddr, REALITY_PROXY_ABI, client).resolve(proposalAddress, { gasLimit: 2000000 }),
      'realityProxy.resolve(proposal) — permissionless'
    );

    // Which side won? Read the CTF payout vector, then redeem that side's
    // unpooled outcome tokens back to collateral.
    const ctf = new ethers.Contract(ctfAddr, CTF_ABI, provider);
    const payout0 = await ctf.payoutNumerators(params2.conditionId, 0);
    const winner = payout0.gt(0)
      ? { label: 'outcome0', company: yesCompany, currency: yesCurrency }
      : { label: 'outcome1', company: noCompany, currency: noCurrency };
    console.log(`  resolved — winning side: ${winner.label}`);
    const balOf = (t) => new ethers.Contract(t, ERC20_ABI, provider).balanceOf(clientAddr);
    const approveMax = (t, label) => track(
      new ethers.Contract(t, ERC20_ABI, client).approve(ROUTER, ethers.constants.MaxUint256), `approve router redeem (${label})`);
    const currencyBefore = await balOf(CURRENCY);
    const [winCoBal, winCuBal] = [await balOf(winner.company), await balOf(winner.currency)];
    await approveMax(winner.company, 'winning company');
    await approveMax(winner.currency, 'winning currency');
    await track(router.redeemProposal(proposalAddress, winCoBal, winCuBal, { gasLimit: 3000000 }), 'router.redeemProposal (winning side → collateral)');
    const currencyAfter = await balOf(CURRENCY);
    assert.ok(currencyAfter.gt(currencyBefore), 'redemption returned collateral to the client');

    const kelvinFullTxs = signedBy.filter((t) => t.from === KELVIN_EOA);
    assert.equal(kelvinFullTxs.length, 0, 'zero Kelvin-signed transactions through LIVE → resolved');
    console.log('\nPASS FULL — create → metadata → pools → LIVE → resolved → redeemed:');
    console.log(`  answer finalized on Reality ${realityAddr}, proposal resolved permissionlessly`);
    console.log(`  client redeemed ${ethers.utils.formatEther(currencyAfter.sub(currencyBefore))} sDAI of winning outcome tokens`);
    console.log(`  ${signedBy.length} txs total — 0 from Kelvin's EOA, org owner only the setEditor grant`);
  }
} finally {
  if (proc) proc.kill();
}
