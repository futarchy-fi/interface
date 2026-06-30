import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(here, '../../src/features/marketCreation/marketCreationWorkflow.js');
const source = await readFile(sourcePath, 'utf8');
const workflow = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`);

const {
  buildMetadataDraft,
  buildOneStepMarketPlan,
  buildPermissionlessStackPlan,
  createMarketWizardDefaults,
  KNOWN_ORGANIZATIONS,
  MARKET_CREATION_STAGES,
  PERMISSIONLESS_STACK_STAGES,
  validateOneStepMarketPlan,
} = workflow;

const NOW = 1_782_777_600;

test('Kleros defaults use KIP, PNK, sDAI, and FLM liquidity', () => {
  const defaults = createMarketWizardDefaults({ organizationId: 'kleros', nowSeconds: NOW });

  assert.equal(defaults.organizationName, 'Kleros DAO');
  assert.equal(defaults.proposalCode, 'KIP-90');
  assert.equal(defaults.companyToken.symbol, 'PNK');
  assert.equal(defaults.currencyToken.symbol, 'sDAI');
  assert.equal(defaults.initialLiquidityMode, 'flm');
  assert.equal(defaults.snapshotLinkAfterLiquidity, true);
});

test('Gnosis defaults use GIP, GNO, sDAI, and Gnosis Snapshot space', () => {
  const defaults = createMarketWizardDefaults({ organizationId: 'gnosis', nowSeconds: NOW });

  assert.equal(defaults.organizationName, 'Gnosis DAO');
  assert.equal(defaults.proposalCode, 'GIP-151');
  assert.equal(defaults.companyToken.symbol, 'GNO');
  assert.equal(defaults.currencyToken.symbol, 'sDAI');
  assert.equal(KNOWN_ORGANIZATIONS.gnosis.snapshotSpace, 'gnosis.eth');
});

test('one-step market plan covers the operational stages in required order', () => {
  const plan = buildOneStepMarketPlan({ organizationId: 'kleros', nowSeconds: NOW });
  const stageIds = plan.stages.map((stage) => stage.id);

  assert.deepEqual(stageIds, MARKET_CREATION_STAGES.map((stage) => stage.id));
  assert.ok(stageIds.indexOf('liquidity') < stageIds.indexOf('snapshot'));
  assert.ok(stageIds.includes('metadata'));
  assert.ok(stageIds.includes('indexing'));
  assert.ok(stageIds.includes('arbitrage'));
  assert.ok(stageIds.includes('publish'));
});

test('metadata draft includes registry fields needed by market pages and proposal routing', () => {
  const draft = buildMetadataDraft({
    organizationId: 'kleros',
    nowSeconds: NOW,
    snapshotId: '0xba2749a4f1283da9d1ca925d9f17bf712fa06a23e6a07d759c54340277820932',
  });

  assert.equal(draft.chain, 100);
  assert.equal(draft.snapshot_id, '0xba2749a4f1283da9d1ca925d9f17bf712fa06a23e6a07d759c54340277820932');
  assert.equal(draft.resolution_status, 'unresolved');
  assert.equal(draft.visibility, 'public');
  assert.equal(draft.companyTokens.base.tokenSymbol, 'PNK');
  assert.equal(draft.currencyTokens.base.tokenSymbol, 'sDAI');
  assert.equal(draft.flm.mode, 'flm');
});

test('permissionless stack plan includes org listing, owner proposals, and default FLM', () => {
  const plan = buildPermissionlessStackPlan();
  const stageIds = plan.stages.map((stage) => stage.id);

  assert.deepEqual(stageIds, PERMISSIONLESS_STACK_STAGES.map((stage) => stage.id));
  assert.ok(stageIds.includes('create-organization'));
  assert.ok(stageIds.includes('list-organization'));
  assert.ok(stageIds.includes('default-flm'));
  assert.ok(stageIds.includes('owner-proposal'));
  assert.equal(plan.values.chainId, 10200);
});

test('validation rejects flows that would link Snapshot before liquidity', () => {
  const validPlan = buildOneStepMarketPlan({ organizationId: 'gnosis', nowSeconds: NOW });
  assert.equal(validateOneStepMarketPlan(validPlan, { nowSeconds: NOW }).ok, true);

  const invalidPlan = buildOneStepMarketPlan({
    organizationId: 'gnosis',
    nowSeconds: NOW,
    snapshotLinkAfterLiquidity: false,
  });
  assert.deepEqual(validateOneStepMarketPlan(invalidPlan).errors, ['snapshotLinkAfterLiquidity']);
});
