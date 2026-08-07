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

  console.log('\nPASS — full client journey on fork:');
  console.log(`  proposal ${proposalAddress}`);
  console.log(`  metadata ${metadataAddress} (TWAP ${onChain.twapStartTimestamp} +120h, ends close−48h)`);
  console.log(`  pools YES ${yesPool} / NO ${noPool}, invert flags verified`);
  console.log(`  ${signedBy.length} txs total, 0 from Kelvin's EOA, owner only for setEditor`);
} finally {
  if (proc) proc.kill();
}
