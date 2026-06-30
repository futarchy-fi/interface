const DAY_SECONDS = 24 * 60 * 60;

export const CHIADO_CHAIN_ID = 10200;
export const GNOSIS_CHAIN_ID = 100;

export const KNOWN_ORGANIZATIONS = {
  gnosis: {
    id: 'gnosis',
    name: 'Gnosis DAO',
    proposalPrefix: 'GIP',
    snapshotSpace: 'gnosis.eth',
    organizationAddress: '0x3Fd2e8E71f75eED4b5c507706c413E33e0661bBf',
    companyToken: {
      symbol: 'GNO',
      address: '0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb',
      decimals: 18,
    },
    currencyToken: {
      symbol: 'sDAI',
      address: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
      decimals: 18,
    },
    spotPrice: {
      ticker: '0x8189c4c96826d016a99986394103dfa9ae41e7ee::0x89c80a4540a00b5270347e02e2e144c71da2eced-hour-500-xdai',
      stableRate: '0x89c80a4540a00b5270347e02e2e144c71da2eced',
    },
  },
  kleros: {
    id: 'kleros',
    name: 'Kleros DAO',
    proposalPrefix: 'KIP',
    snapshotSpace: 'kleros.eth',
    organizationAddress: '0xaAB097ead5c2Db1Ca7b1E5034224A2118EDAbe36',
    companyToken: {
      symbol: 'PNK',
      address: '0x37b60f4e9a31a64ccc0024dce7d0fd07eaa0f7b3',
      decimals: 18,
    },
    currencyToken: {
      symbol: 'sDAI',
      address: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
      decimals: 18,
    },
    spotPrice: {
      ticker: 'composite::0x2613cb099c12cecb1bd290fd0ef6833949374165+0x4c3b00293070073d71455f20fa9e5868cffd8678::0x89c80a4540a00b5270347e02e2e144c71da2eced-hour-500-xdai',
      stableRate: '0x89c80a4540a00b5270347e02e2e144c71da2eced',
    },
  },
};

export const PERMISSIONLESS_TESTNET_DEFAULTS = {
  chainId: CHIADO_CHAIN_ID,
  chainName: 'Gnosis Chiado',
  mode: 'permissionless',
  contracts: {
    aggregatorFactory: '',
    permissionlessAggregator: '',
    organizationImplementation: '',
    proposalImplementation: '',
    futarchyFactory: '',
    liquidityManagerFactory: '',
    snapshotLinkRegistry: '',
    candleIndexer: '',
    arbitrageFactory: '',
  },
};

export const MARKET_CREATION_STAGES = [
  {
    id: 'organization',
    title: 'Organization',
    summary: 'Select an existing organization or create a permissionless testnet organization.',
    requiredEvidence: ['organizationAddress', 'organizationOwner'],
  },
  {
    id: 'metadata',
    title: 'Metadata',
    summary: 'Build proposal metadata, registry metadata, Snapshot reference, and display titles.',
    requiredEvidence: ['metadataJson', 'closeTimestamp', 'snapshotId'],
  },
  {
    id: 'market',
    title: 'Futarchy Market',
    summary: 'Create the market with company/currency tokens, Reality bond, opening time, and resolver defaults.',
    requiredEvidence: ['proposalAddress', 'factoryTxHash'],
  },
  {
    id: 'liquidity',
    title: 'Liquidity and FLM',
    summary: 'Create or reuse the organization FLM, add initial liquidity, and set the official proposal.',
    requiredEvidence: ['flmAddress', 'liquidityTxHash', 'officialProposalSet'],
  },
  {
    id: 'snapshot',
    title: 'Snapshot Link',
    summary: 'Link Snapshot only after liquidity exists, so Snapshot users never land on an empty market.',
    requiredEvidence: ['snapshotLinkRegistryTxHash'],
    dependsOn: ['liquidity'],
  },
  {
    id: 'indexing',
    title: 'Candles and Indexing',
    summary: 'Kickstart pools and verify registry/candle indexers can read the market.',
    requiredEvidence: ['registryIndexed', 'candlesIndexed'],
    dependsOn: ['market', 'liquidity'],
  },
  {
    id: 'arbitrage',
    title: 'Arbitrage',
    summary: 'Deploy or configure arbitrage contracts and bots that keep YES/NO pricing checked.',
    requiredEvidence: ['arbitrageContract', 'botConfig'],
    dependsOn: ['market', 'liquidity'],
  },
  {
    id: 'publish',
    title: 'Publish',
    summary: 'Expose the market and FLM links on the company page after all checks pass.',
    requiredEvidence: ['companyPageLink', 'marketUrl', 'flmUrl'],
    dependsOn: ['snapshot', 'indexing'],
  },
];

export const PERMISSIONLESS_STACK_STAGES = [
  {
    id: 'deploy-stack',
    title: 'Deploy permissionless stack',
    summary: 'Deploy metadata implementations, public aggregator, market factory, Snapshot linker, indexer hooks, and FLM factory on Chiado.',
  },
  {
    id: 'default-flm',
    title: 'Create default FLM bundle',
    summary: 'Create the proposal source, pool adapters, and default FLM bundle that will be attached to the organization.',
    dependsOn: ['deploy-stack'],
  },
  {
    id: 'create-organization',
    title: 'Create organization',
    summary: 'Any wallet can create organization metadata with default FLM wiring; the creator becomes organization owner.',
    dependsOn: ['default-flm'],
  },
  {
    id: 'list-organization',
    title: 'List organization',
    summary: 'Every created organization is added to the permissionless aggregator and appears in listings.',
    dependsOn: ['create-organization'],
  },
  {
    id: 'owner-proposal',
    title: 'Owner creates proposal',
    summary: 'The organization owner can create proposals and point the FLM at the official proposal.',
    dependsOn: ['list-organization'],
  },
];

export const CONTRACT_SOURCES = {
  registry: {
    repository: 'futarchy-fi/futarchy',
    contracts: [
      'FutarchyAggregatorFactory',
      'FutarchyAggregatorsMetadata',
      'FutarchyOrganizationMetadata',
      'FutarchyProposalMetadata',
    ],
  },
  liquidityManager: {
    repository: 'futarchy-fi/futarchy-liquidity-manager',
    contracts: [
      'FutarchyLiquidityManagerFactory',
      'FutarchyOfficialProposalSource',
      'FutarchyLiquidityManager',
    ],
  },
};

export const PERMISSIONLESS_STACK_CONTRACT_ACTIONS = [
  {
    id: 'deploy-permissionless-registry',
    stageId: 'deploy-stack',
    chainId: CHIADO_CHAIN_ID,
    source: 'futarchy/script/deploy/DeployPermissionlessRegistry.s.sol',
    contract: 'DeployPermissionlessRegistry',
    method: 'run',
    summary: 'Deploy aggregator, organization, and proposal metadata implementations plus their factories.',
    produces: ['aggregatorFactory', 'permissionlessAggregator', 'organizationImplementation', 'proposalImplementation'],
  },
  {
    id: 'create-default-flm-bundle',
    stageId: 'default-flm',
    chainId: CHIADO_CHAIN_ID,
    source: 'futarchy-liquidity-manager/src/factories/FutarchyLiquidityManagerFactory.sol',
    contract: 'FutarchyLiquidityManagerFactory',
    method: 'createLiquidityManager',
    summary: 'Deploy proposal source, spot adapter, conditional adapter, and default organization FLM.',
    produces: ['proposalSource', 'spotAdapter', 'conditionalAdapter', 'manager'],
    inputs: ['CreateParams.owner', 'CreateParams.proposalManager', 'CreateParams.companyToken', 'CreateParams.officialProposer'],
    dependsOn: ['deploy-permissionless-registry'],
  },
  {
    id: 'create-and-list-organization',
    stageId: 'create-organization',
    chainId: CHIADO_CHAIN_ID,
    source: 'futarchy/src/registry/FutarchyAggregatorsMetadata.sol',
    contract: 'FutarchyAggregatorsMetadata',
    method: 'createAndAddOrganizationMetadataWithDefaultLiquidityManager',
    summary: 'Create organization metadata, attach the FLM/proposal source, and add it to the aggregator in one call.',
    produces: ['organizationMetadata'],
    inputs: ['companyName', 'description', 'metadata', 'metadataURI', 'manager', 'proposalSource', 'liquidityManagerMetadataURI'],
    dependsOn: ['create-default-flm-bundle'],
  },
  {
    id: 'read-listed-organizations',
    stageId: 'list-organization',
    chainId: CHIADO_CHAIN_ID,
    source: 'futarchy/src/registry/FutarchyAggregatorsMetadata.sol',
    contract: 'FutarchyAggregatorsMetadata',
    method: 'getOrganizations',
    summary: 'Read the aggregator list that backs the companies page.',
    produces: ['listedOrganization'],
    dependsOn: ['create-and-list-organization'],
  },
  {
    id: 'owner-create-proposal-metadata',
    stageId: 'owner-proposal',
    chainId: CHIADO_CHAIN_ID,
    source: 'futarchy/src/registry/FutarchyOrganizationMetadata.sol',
    contract: 'FutarchyOrganizationMetadata',
    method: 'createAndAddProposalMetadata',
    summary: 'Organization owner or editor writes proposal metadata after the futarchy proposal exists.',
    produces: ['proposalMetadata'],
    inputs: ['proposalAddress', 'displayNameQuestion', 'displayNameEvent', 'description', 'metadata', 'metadataURI'],
    dependsOn: ['read-listed-organizations'],
  },
  {
    id: 'owner-set-official-proposal',
    stageId: 'owner-proposal',
    chainId: CHIADO_CHAIN_ID,
    source: 'futarchy-liquidity-manager/src/sources/FutarchyOfficialProposalSource.sol',
    contract: 'FutarchyOfficialProposalSource',
    method: 'setOfficialProposal',
    summary: 'Point the default FLM proposal source at the active proposal once the proposal address is known.',
    produces: ['officialProposal'],
    inputs: ['proposalId', 'proposalAddress', 'creator'],
    dependsOn: ['owner-create-proposal-metadata', 'create-default-flm-bundle'],
  },
];

export const ONE_STEP_MARKET_CONTRACT_ACTIONS = [
  {
    id: 'publish-metadata-json',
    stageId: 'metadata',
    chainId: GNOSIS_CHAIN_ID,
    source: 'interface/src/features/marketCreation/marketCreationWorkflow.js',
    contract: 'MetadataPublisher',
    method: 'publishProposalJson',
    summary: 'Build and publish the registry metadata JSON, including Snapshot visibility fields.',
    produces: ['metadataJson', 'metadataURI'],
  },
  {
    id: 'create-futarchy-proposal',
    stageId: 'market',
    chainId: GNOSIS_CHAIN_ID,
    source: 'futarchy/src/interfaces/IFutarchyFactory.sol',
    contract: 'IFutarchyFactory',
    method: 'createProposal',
    summary: 'Create the futarchy proposal market using company token, currency token, bond, and opening time.',
    produces: ['proposalAddress'],
    inputs: ['CreateProposalParams.marketName', 'collateralToken1', 'collateralToken2', 'minBond', 'openingTime'],
    dependsOn: ['publish-metadata-json'],
  },
  {
    id: 'create-proposal-metadata',
    stageId: 'metadata',
    chainId: GNOSIS_CHAIN_ID,
    source: 'futarchy/src/registry/FutarchyOrganizationMetadata.sol',
    contract: 'FutarchyOrganizationMetadata',
    method: 'createAndAddProposalMetadata',
    summary: 'Store proposal metadata on the organization after the proposal address exists.',
    produces: ['proposalMetadata'],
    inputs: ['proposalAddress', 'displayNameQuestion', 'displayNameEvent', 'description', 'metadata', 'metadataURI'],
    dependsOn: ['create-futarchy-proposal', 'publish-metadata-json'],
  },
  {
    id: 'create-flm-bundle',
    stageId: 'liquidity',
    chainId: GNOSIS_CHAIN_ID,
    source: 'futarchy-liquidity-manager/src/factories/FutarchyLiquidityManagerFactory.sol',
    contract: 'FutarchyLiquidityManagerFactory',
    method: 'createLiquidityManager',
    summary: 'Create or reuse the organization FLM bundle for this token pair.',
    produces: ['proposalSource', 'spotAdapter', 'conditionalAdapter', 'manager'],
    inputs: ['CreateParams.organization', 'CreateParams.owner', 'CreateParams.companyToken', 'CreateParams.officialProposer'],
    dependsOn: ['create-futarchy-proposal'],
  },
  {
    id: 'store-default-flm',
    stageId: 'liquidity',
    chainId: GNOSIS_CHAIN_ID,
    source: 'futarchy/src/registry/FutarchyOrganizationMetadata.sol',
    contract: 'FutarchyOrganizationMetadata',
    method: 'setDefaultLiquidityManager',
    summary: 'Store the FLM and proposal source as the organization default used by market pages.',
    produces: ['defaultLiquidityManager'],
    inputs: ['manager', 'proposalSource', 'liquidityManagerMetadataURI'],
    dependsOn: ['create-flm-bundle'],
  },
  {
    id: 'set-official-proposal',
    stageId: 'liquidity',
    chainId: GNOSIS_CHAIN_ID,
    source: 'futarchy-liquidity-manager/src/sources/FutarchyOfficialProposalSource.sol',
    contract: 'FutarchyOfficialProposalSource',
    method: 'setOfficialProposal',
    summary: 'Point the FLM proposal source at the newly created proposal before public Snapshot routing.',
    produces: ['officialProposal'],
    inputs: ['proposalId', 'proposalAddress', 'creator'],
    dependsOn: ['create-futarchy-proposal', 'create-flm-bundle'],
  },
  {
    id: 'bootstrap-flm-liquidity',
    stageId: 'liquidity',
    chainId: GNOSIS_CHAIN_ID,
    source: 'futarchy-liquidity-manager/src/core/FutarchyLiquidityManager.sol',
    contract: 'FutarchyLiquidityManager',
    method: 'initializeFromBootstrap',
    summary: 'Seed spot liquidity through the FLM before Snapshot sends users to the market.',
    produces: ['flmAddress', 'liquidityTxHash'],
    inputs: ['companyAmount', 'spotAddData'],
    dependsOn: ['store-default-flm', 'set-official-proposal'],
  },
  {
    id: 'link-snapshot-proposal',
    stageId: 'snapshot',
    chainId: GNOSIS_CHAIN_ID,
    source: 'snapshot metadata/link registry',
    contract: 'SnapshotLinkRegistry',
    method: 'linkSnapshotProposal',
    summary: 'Link Snapshot after liquidity is present and proposal metadata has been written.',
    produces: ['snapshotLinkRegistryTxHash'],
    inputs: ['snapshotSpace', 'snapshotId', 'proposalAddress'],
    dependsOn: ['bootstrap-flm-liquidity', 'create-proposal-metadata'],
  },
  {
    id: 'verify-registry-and-candles',
    stageId: 'indexing',
    chainId: GNOSIS_CHAIN_ID,
    source: 'interface indexers',
    contract: 'CandleIndexer',
    method: 'backfillMarket',
    summary: 'Verify organization/proposal metadata, market candles, and spot price feeds before publish.',
    produces: ['registryIndexed', 'candlesIndexed'],
    dependsOn: ['bootstrap-flm-liquidity', 'create-proposal-metadata'],
  },
  {
    id: 'configure-arbitrage',
    stageId: 'arbitrage',
    chainId: GNOSIS_CHAIN_ID,
    source: 'arbitrage service',
    contract: 'FutarchyArbitrageFactory',
    method: 'configureMarket',
    summary: 'Configure arb contracts and bot parameters for the YES/NO and spot pools.',
    produces: ['arbitrageContract', 'botConfig'],
    dependsOn: ['bootstrap-flm-liquidity'],
  },
  {
    id: 'publish-company-market',
    stageId: 'publish',
    chainId: GNOSIS_CHAIN_ID,
    source: 'interface company pages',
    contract: 'CompanyMarketRegistry',
    method: 'publish',
    summary: 'Expose the market on the company page once Snapshot, candles, metadata, and liquidity are ready.',
    produces: ['companyPageLink', 'marketUrl', 'flmUrl'],
    dependsOn: ['link-snapshot-proposal', 'verify-registry-and-candles', 'configure-arbitrage'],
  },
];

export function addDaysUnix(nowSeconds, days) {
  return nowSeconds + days * DAY_SECONDS;
}

export function toDateTimeLocal(timestampSeconds) {
  return new Date(timestampSeconds * 1000).toISOString().slice(0, 16);
}

export function getOrganizationDefaults(organizationId = 'gnosis') {
  return KNOWN_ORGANIZATIONS[organizationId] || KNOWN_ORGANIZATIONS.gnosis;
}

export function createMarketWizardDefaults({
  organizationId = 'gnosis',
  nowSeconds = Math.floor(Date.now() / 1000),
} = {}) {
  const organization = getOrganizationDefaults(organizationId);
  const proposalNumber = organization.id === 'kleros' ? '90' : '151';
  const closeTimestamp = addDaysUnix(nowSeconds, 7);
  const twapStartTimestamp = closeTimestamp - (48 * 60 * 60);

  return {
    mode: 'existing-org',
    organizationId: organization.id,
    organizationAddress: organization.organizationAddress,
    organizationName: organization.name,
    proposalNumber,
    proposalCode: `${organization.proposalPrefix}-${proposalNumber}`,
    displayTitle0: `What will the impact on ${organization.companyToken.symbol} price be`,
    displayTitle1: `if ${organization.proposalPrefix}-${proposalNumber} is passed?`,
    question: `Will ${organization.proposalPrefix}-${proposalNumber} be passed by ${organization.name}?`,
    description: `Resolves Yes if ${organization.proposalPrefix}-${proposalNumber} is passed by ${organization.name}; otherwise resolves No.`,
    snapshotSpace: organization.snapshotSpace,
    snapshotId: '',
    companyToken: organization.companyToken,
    currencyToken: organization.currencyToken,
    closeTimestamp,
    closeDateTimeLocal: toDateTimeLocal(closeTimestamp),
    startCandleUnix: twapStartTimestamp - (60 * 60),
    twapStartTimestamp,
    twapDurationHours: 24,
    minBondWei: '1000000000000000000',
    eventProbability: 0.5,
    initialLiquidityMode: 'flm',
    initialLiquidityBudget: {
      companyToken: '0.001',
      currencyToken: '0.001',
    },
    spotPrice: organization.spotPrice,
    snapshotLinkAfterLiquidity: true,
    kickstartCandles: true,
    deployArbitrage: true,
  };
}

export function buildMetadataDraft(input = {}) {
  const organization = getOrganizationDefaults(input.organizationId);
  const defaults = createMarketWizardDefaults({
    organizationId: organization.id,
    nowSeconds: input.nowSeconds || Math.floor(Date.now() / 1000),
  });
  const merged = { ...defaults, ...input };

  return {
    chain: GNOSIS_CHAIN_ID,
    proposalAddress: merged.proposalAddress || '',
    organizationAddress: merged.organizationAddress,
    snapshot_id: merged.snapshotId,
    closeTimestamp: Number(merged.closeTimestamp),
    startCandleUnix: Number(merged.startCandleUnix),
    twapStartTimestamp: Number(merged.twapStartTimestamp),
    twapDurationHours: Number(merged.twapDurationHours),
    coingecko_ticker: merged.spotPrice?.ticker,
    currency_stable_rate: merged.spotPrice?.stableRate,
    currency_stable_symbol: 'xDAI',
    visibility: 'public',
    resolution_status: 'unresolved',
    eventProbability: Number(merged.eventProbability),
    display_title_0: merged.displayTitle0,
    display_title_1: merged.displayTitle1,
    companyTokens: {
      base: {
        tokenName: merged.companyToken.symbol,
        tokenSymbol: merged.companyToken.symbol,
        wrappedCollateralTokenAddress: merged.companyToken.address,
      },
    },
    currencyTokens: {
      base: {
        tokenName: merged.currencyToken.symbol,
        tokenSymbol: merged.currencyToken.symbol,
        wrappedCollateralTokenAddress: merged.currencyToken.address,
      },
    },
    flm: {
      mode: merged.initialLiquidityMode,
      address: merged.flmAddress || '',
      proposalSource: merged.proposalSource || '',
      officialProposalAfterMarketCreation: true,
    },
    snapshot: {
      space: merged.snapshotSpace,
      proposalId: merged.snapshotId,
      linkAfterLiquidity: true,
      visibilityMetadata: {
        includeOnSnapshotWebsite: true,
        linkedBy: 'SnapshotLinkRegistry.linkSnapshotProposal',
      },
    },
    registry: {
      organizationAddress: merged.organizationAddress,
      proposalCode: merged.proposalCode,
      proposalMetadataMethod: 'FutarchyOrganizationMetadata.createAndAddProposalMetadata',
      defaultLiquidityManagerMethod: 'FutarchyOrganizationMetadata.setDefaultLiquidityManager',
    },
  };
}

export function buildContractActionPlan(actions, stages, values = {}) {
  const stageOrders = new Map(stages.map((stage) => [stage.id, stage.order]));

  return actions.map((action, index) => ({
    ...action,
    order: index + 1,
    stageOrder: stageOrders.get(action.stageId) || index + 1,
    chainId: action.chainId || values.chainId || GNOSIS_CHAIN_ID,
    enabled: action.enabled !== false,
  }));
}

export function validateContractActionDependencies(actions = []) {
  const seen = new Set();
  const missing = [];

  actions.forEach((action) => {
    action.dependsOn?.forEach((dependency) => {
      if (!seen.has(dependency)) {
        missing.push(`${action.id}:${dependency}`);
      }
    });
    seen.add(action.id);
  });

  return {
    ok: missing.length === 0,
    missing,
  };
}

export function buildOneStepMarketPlan(input = {}) {
  const defaults = createMarketWizardDefaults({
    organizationId: input.organizationId || 'gnosis',
    nowSeconds: input.nowSeconds,
  });
  const values = { ...defaults, ...input };
  const metadataDraft = buildMetadataDraft(values);
  const stages = MARKET_CREATION_STAGES.map((stage, index) => ({
    ...stage,
    order: index + 1,
    enabled: stage.id !== 'snapshot' || values.snapshotLinkAfterLiquidity,
  }));

  return {
    values,
    metadataDraft,
    stages,
    contractActions: buildContractActionPlan(ONE_STEP_MARKET_CONTRACT_ACTIONS, stages, values),
  };
}

export function buildPermissionlessStackPlan(config = {}) {
  const values = {
    ...PERMISSIONLESS_TESTNET_DEFAULTS,
    ...config,
    contracts: {
      ...PERMISSIONLESS_TESTNET_DEFAULTS.contracts,
      ...(config.contracts || {}),
    },
  };

  return {
    values,
    stages: PERMISSIONLESS_STACK_STAGES.map((stage, index) => ({
      ...stage,
      order: index + 1,
      includedByDefault: stage.id !== 'deploy-stack',
    })),
    contractActions: buildContractActionPlan(
      PERMISSIONLESS_STACK_CONTRACT_ACTIONS,
      PERMISSIONLESS_STACK_STAGES.map((stage, index) => ({
        ...stage,
        order: index + 1,
      })),
      values
    ),
  };
}

export function validateOneStepMarketPlan(
  plan,
  { nowSeconds = Math.floor(Date.now() / 1000) } = {}
) {
  const errors = [];
  const values = plan?.values || {};

  if (!values.organizationAddress || !/^0x[a-fA-F0-9]{40}$/.test(values.organizationAddress)) {
    errors.push('organizationAddress');
  }
  if (!values.companyToken?.address || !/^0x[a-fA-F0-9]{40}$/.test(values.companyToken.address)) {
    errors.push('companyToken.address');
  }
  if (!values.currencyToken?.address || !/^0x[a-fA-F0-9]{40}$/.test(values.currencyToken.address)) {
    errors.push('currencyToken.address');
  }
  if (!values.closeTimestamp || Number(values.closeTimestamp) <= nowSeconds) {
    errors.push('closeTimestamp');
  }
  if (!values.snapshotLinkAfterLiquidity) {
    errors.push('snapshotLinkAfterLiquidity');
  }
  if (!validateContractActionDependencies(plan?.contractActions || []).ok) {
    errors.push('contractActions.dependencies');
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
