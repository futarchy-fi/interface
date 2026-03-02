import { CONTRACT_ADDRESSES, CONTRACT_ABIS, CHAIN_CONFIG } from '../config/contracts.js';
import { CANDLE_SUBGRAPHS, getCompleteSubgraph, getCandleSubgraph } from '../config/subgraphEndpoints.js';
import { createPublicClient, http } from 'viem';
import { gnosis, mainnet } from 'viem/chains';

export class FutarchyCompleteCartridge {
    constructor() {
        this.name = 'FutarchyComplete';
        this.operations = {
            'futarchy.getOrganizations': this.getOrganizations.bind(this),
            'futarchy.getOrganizationsByOwner': this.getOrganizationsByOwner.bind(this),
            'futarchy.addProposal': this.addProposal.bind(this),
            'futarchy.getProposals': this.getProposals.bind(this),
            'futarchy.getProposalDetails': this.getProposalDetails.bind(this),
            'futarchy.getLinkableProposals': this.getLinkableProposals.bind(this),
            'futarchy.verifyToken': this.verifyToken.bind(this),
            'futarchy.createActualProposal': this.createActualProposal.bind(this),
            'futarchy.linkProposalToOrganization': this.linkProposalToOrganization.bind(this),
            // New metadata operations
            'futarchy.getOrganizationMetadata': this.getOrganizationMetadata.bind(this),
            'futarchy.getProposalMetadata': this.getProposalMetadata.bind(this),
            'futarchy.updateEntityMetadata': this.updateEntityMetadata.bind(this),
            'futarchy.getAggregatorMetadata': this.getAggregatorMetadata.bind(this),
            // Remove operations
            'futarchy.removeOrganization': this.removeOrganization.bind(this),
            'futarchy.removeProposal': this.removeProposal.bind(this),
            // Create organization
            'futarchy.createOrganization': this.createOrganization.bind(this),
            // Update info operations
            'futarchy.updateOrganizationInfo': this.updateOrganizationInfo.bind(this),
            'futarchy.updateAggregatorInfo': this.updateAggregatorInfo.bind(this),
            'futarchy.updateProposalInfo': this.updateProposalInfo.bind(this),
            // Add existing metadata
            'futarchy.addExistingMetadata': this.addExistingMetadata.bind(this),
            // Update extended metadata
            'futarchy.updateOrgExtendedMetadata': this.updateOrgExtendedMetadata.bind(this),
            'futarchy.updateProposalExtendedMetadata': this.updateProposalExtendedMetadata.bind(this),
            // Batch metadata update (single transaction for multiple keys)
            'futarchy.batchUpdateEntityMetadata': this.batchUpdateEntityMetadata.bind(this),
            // Pool creation
            'futarchy.createPool': this.createPool.bind(this)
        };
    }

    getSupportedOperations() {
        return Object.keys(this.operations);
    }

    async* execute(operation, args, viemClients) {
        if (!this.operations[operation]) {
            throw new Error(`Operation ${operation} not supported`);
        }
        yield* this.operations[operation](args, viemClients);
    }

    /**
     * Get organizations from an Aggregator
     */
    async* getOrganizations(args, { publicClient }) {
        const aggregatorAddress = args.aggregatorAddress || CONTRACT_ADDRESSES.DEFAULT_AGGREGATOR;

        yield { status: 'pending', message: `Fetching organizations from ${aggregatorAddress}...` };

        try {
            // Get count first
            const count = await publicClient.readContract({
                address: aggregatorAddress,
                abi: CONTRACT_ABIS.AGGREGATOR,
                functionName: 'getOrganizationsCount'
            });

            yield { status: 'pending', message: `Found ${count} organizations. Fetching details...` };

            const orgs = [];

            const orgAddresses = await publicClient.readContract({
                address: aggregatorAddress,
                abi: CONTRACT_ABIS.AGGREGATOR,
                functionName: 'getOrganizations',
                args: [0n, count] // Fetch all
            });

            for (const orgAddr of orgAddresses) {
                const [name, description] = await Promise.all([
                    publicClient.readContract({
                        address: orgAddr,
                        abi: CONTRACT_ABIS.ORGANIZATION,
                        functionName: 'companyName'
                    }),
                    publicClient.readContract({
                        address: orgAddr,
                        abi: CONTRACT_ABIS.ORGANIZATION,
                        functionName: 'description'
                    }).catch(() => '')
                ]);

                orgs.push({ address: orgAddr, name, description });
                yield { status: 'partial', data: { address: orgAddr, name, description }, message: `Fetched ${name}` };
            }

            yield {
                status: 'success',
                message: `Successfully fetched ${orgs.length} organizations`,
                data: orgs
            };

        } catch (error) {
            yield { status: 'error', message: `Failed to fetch organizations: ${error.message}` };
        }
    }

    /**
     * Get proposals from an Organization
     */
    async* getProposals(args, { publicClient }) {
        const { organizationAddress } = args;

        if (!organizationAddress) {
            throw new Error("organizationAddress is required");
        }

        yield { status: 'pending', message: `Fetching proposals for ${organizationAddress}...` };

        try {
            const count = await publicClient.readContract({
                address: organizationAddress,
                abi: CONTRACT_ABIS.ORGANIZATION,
                functionName: 'getProposalsCount'
            });

            const metadataAddresses = await publicClient.readContract({
                address: organizationAddress,
                abi: CONTRACT_ABIS.ORGANIZATION,
                functionName: 'getProposals',
                args: [0n, count]
            });

            // Fetch additional info for each proposal metadata
            yield { status: 'pending', message: `Fetching details for ${metadataAddresses.length} proposals...` };

            const proposals = await Promise.all(metadataAddresses.map(async (metadataAddr) => {
                try {
                    const [proposalAddress, displayNameEvent] = await Promise.all([
                        publicClient.readContract({
                            address: metadataAddr,
                            abi: CONTRACT_ABIS.PROPOSAL,
                            functionName: 'proposalAddress'
                        }),
                        publicClient.readContract({
                            address: metadataAddr,
                            abi: CONTRACT_ABIS.PROPOSAL,
                            functionName: 'displayNameEvent'
                        }).catch(() => '')
                    ]);
                    return {
                        metadataAddress: metadataAddr,
                        proposalAddress,
                        displayNameEvent: displayNameEvent || ''
                    };
                } catch (e) {
                    return { metadataAddress: metadataAddr, proposalAddress: null, displayNameEvent: '' };
                }
            }));

            yield {
                status: 'success',
                message: `Found ${proposals.length} proposals`,
                data: proposals
            };

        } catch (error) {
            yield { status: 'error', message: `Failed to fetch proposals: ${error.message}` };
        }
    }

    /**
     * Create and Add Proposal Metadata to an Organization
     */
    async* addProposal(args, { walletClient, publicClient, account }) {
        const {
            organizationAddress,
            proposalAddress,
            // Accept both naming conventions (ABI names + legacy aliases)
            displayNameQuestion = args.question || '',
            displayNameEvent = args.marketName || '',
            description = '',
            metadata = '',
            metadataURI = ''
        } = args;

        if (!walletClient || !account) {
            yield { status: 'error', message: 'Wallet client/account required for write operations' };
            return;
        }

        yield { status: 'pending', message: `Adding proposal to ${organizationAddress}...` };

        try {
            const hash = await walletClient.writeContract({
                address: organizationAddress,
                abi: CONTRACT_ABIS.ORGANIZATION,
                functionName: 'createAndAddProposalMetadata',
                args: [
                    proposalAddress,
                    displayNameQuestion,
                    displayNameEvent,
                    description,
                    metadata,
                    metadataURI
                ],
                account
            });

            yield { status: 'pending', message: `Transaction sent: ${hash}. Waiting for receipt...`, data: { hash } };

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            // Try to parse the ProposalCreatedAndAdded event to get metadata contract
            let metadataContract = null;
            try {
                // Event signature: ProposalCreatedAndAdded(address indexed proposalMetadata, address indexed proposalAddress)
                const eventTopic = '0x' + 'ProposalCreatedAndAdded'.split('').reduce((a, c) => a + c.charCodeAt(0).toString(16), '');
                // The first indexed param (proposalMetadata) is in topics[1]
                if (receipt.logs && receipt.logs.length > 0) {
                    for (const log of receipt.logs) {
                        if (log.topics && log.topics.length >= 2) {
                            // topics[1] is the indexed proposalMetadata address
                            metadataContract = '0x' + log.topics[1].slice(-40);
                            break;
                        }
                    }
                }
            } catch (e) {
                // Silent fail, metadataContract will be null
            }

            yield {
                status: 'success',
                message: 'Proposal metadata created!',
                data: {
                    hash,
                    blockNumber: Number(receipt.blockNumber),
                    metadataContract
                }
            };

        } catch (error) {
            yield { status: 'error', message: `Failed to add proposal: ${error.message}` };
        }
    }

    /**
     * Fetch recent proposals from Subgraph (Linkable Candidates)
     * Replaces Supabase logic with strict Subgraph query
     */
    async* getLinkableProposals(args) {
        const { chainId = 100 } = args;
        yield { status: 'pending', message: `Fetching linkable proposals from Subgraph (chain ${chainId})...` };

        // Use unified config
        const SUBGRAPH_URL = getCandleSubgraph(chainId);

        const query = `{
            proposals(first: 50, orderBy: id, orderDirection: desc) {
                id
                marketName
                companyToken { symbol }
            }
        }`;

        try {
            const response = await fetch(SUBGRAPH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });

            const result = await response.json();
            if (result.errors) throw new Error(JSON.stringify(result.errors));

            const proposals = result.data?.proposals || [];

            yield {
                status: 'success',
                message: `Found ${proposals.length} recent proposals in Subgraph`,
                data: proposals.map(p => ({
                    id: p.id,
                    title: p.marketName || 'Untitled',
                    marketName: p.marketName || 'N/A',
                    question: p.marketName || 'N/A', // Subgraph usually puts question in marketName
                    description: '', // Not in subgraph
                    companyId: 'N/A'
                }))
            };

        } catch (error) {
            yield { status: 'error', message: `Failed to fetch from Subgraph: ${error.message}` };
        }
    }

    async* getProposalDetails(args, { publicClient }) {
        const { proposalAddress, chainId: overrideChainId } = args;
        if (!proposalAddress) throw new Error("proposalAddress is required");

        const proposalId = proposalAddress.toLowerCase();

        yield { status: 'pending', message: `Resolving proposal address for ${proposalId}...` };

        // 0. Resolve potential Metadata Address -> Proposal Address
        let resolvedProposalAddress = proposalAddress;
        let didResolve = false;

        try {
            const underlyingProposal = await publicClient.readContract({
                address: proposalAddress,
                abi: CONTRACT_ABIS.PROPOSAL,
                functionName: 'proposalAddress'
            });
            if (underlyingProposal && underlyingProposal !== '0x0000000000000000000000000000000000000000') {
                resolvedProposalAddress = underlyingProposal;
                didResolve = true;
                yield { status: 'pending', message: `Resolved Metadata ${proposalId.slice(0, 6)}... -> Proposal ${resolvedProposalAddress.slice(0, 6)}...` };
            }
        } catch (e) { /* Not a metadata contract */ }

        const effectiveProposalId = resolvedProposalAddress.toLowerCase();

        // 1. Registry Fetch (Futarchy Complete Subgraph v0.0.10)
        // BREAKING CHANGE: id is now Metadata Contract, proposalAddress is Trading Contract
        // Use override chain or default to 100, will be refined after registry fetch
        let chainId = overrideChainId || 100;
        let chainSource = overrideChainId ? `override-${overrideChainId}` : 'default-100';
        const COMPLETE_SUBGRAPH_URL = getCompleteSubgraph(chainId);
        let registryData = null;

        yield { status: 'pending', message: `Querying Registry for Trading Contract ${effectiveProposalId}...` };

        try {
            // v0.0.10 Schema: Search by proposalAddress (Trading Contract)
            const registryQuery = `{
                proposalEntities(where: { proposalAddress: "${effectiveProposalId}" }, first: 1) {
                    id
                    proposalAddress
                    title
                    description
                    displayNameQuestion
                    displayNameEvent
                    owner
                    metadata
                    metadataURI
                    organization {
                        id
                        name
                        metadata
                    }
                }
            }`;

            console.log(`[DEBUG] Fetching Registry from: ${COMPLETE_SUBGRAPH_URL}`);
            console.log(`[DEBUG] Trading Contract (proposalAddress): ${effectiveProposalId}`);

            const response = await fetch(COMPLETE_SUBGRAPH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: registryQuery })
            });

            const result = await response.json();

            console.log(`[DEBUG] Registry Result:`, JSON.stringify(result));

            if (result.data?.proposalEntities && result.data.proposalEntities.length > 0) {
                const proposal = result.data.proposalEntities[0];
                registryData = {
                    metadataContract: proposal.id,  // id IS the metadata contract now
                    proposalAddress: proposal.proposalAddress,
                    owner: proposal.owner,
                    title: proposal.title,
                    description: proposal.description,
                    displayNameQuestion: proposal.displayNameQuestion,
                    displayNameEvent: proposal.displayNameEvent,
                    metadata: proposal.metadata,
                    metadataURI: proposal.metadataURI,
                    organization: proposal.organization
                };

                // Extract chain from proposal metadata OR organization metadata
                try {
                    const proposalMeta = proposal.metadata ? JSON.parse(proposal.metadata) : null;
                    const orgMeta = proposal.organization?.metadata ? JSON.parse(proposal.organization.metadata) : null;

                    // Priority: proposal.metadata.chain > organization.metadata.chain > default
                    if (proposalMeta?.chain && !overrideChainId) {
                        chainId = typeof proposalMeta.chain === 'string' ? parseInt(proposalMeta.chain) : proposalMeta.chain;
                        chainSource = `registry-proposal-${chainId}`;
                        console.log(`[DEBUG] Chain from proposal metadata: ${chainId}`);
                    } else if (orgMeta?.chain && !overrideChainId) {
                        chainId = typeof orgMeta.chain === 'string' ? parseInt(orgMeta.chain) : orgMeta.chain;
                        chainSource = `registry-org-${chainId}`;
                        console.log(`[DEBUG] Chain from organization metadata: ${chainId}`);
                    }
                } catch (e) {
                    console.log(`[DEBUG] Failed to parse registry metadata for chain: ${e.message}`);
                }

                yield { status: 'pending', message: `Found Registry Entry. Owner: ${registryData.owner}, Chain: ${chainId}, Metadata: ${registryData.metadataContract?.slice(0, 10)}...` };
            } else {
                yield { status: 'pending', message: `Not found in Registry. Using defaults.` };
            }

        } catch (e) {
            yield { status: 'error', message: `Registry Query Failed: ${e.message}` };
        }

        // 2. Determine Chain Source - Fallback to RPC if Registry didn't provide chain
        // (chainId and chainSource already set above from registry or defaults)
        let metadataWarning = null;
        let parsedMetadata = null;

        // RPC fallback for chain detection if not already determined from registry
        if (chainSource.startsWith('default')) {
            try {
                const metadataStr = await publicClient.readContract({
                    address: resolvedProposalAddress,
                    abi: CONTRACT_ABIS.PROPOSAL,
                    functionName: 'metadata'
                }).catch(() => null);

                if (metadataStr) {
                    try {
                        parsedMetadata = JSON.parse(metadataStr);
                        if (parsedMetadata.chain && !overrideChainId) {
                            chainId = typeof parsedMetadata.chain === 'string' ? parseInt(parsedMetadata.chain) : parsedMetadata.chain;
                            chainSource = `rpc-metadata-${chainId}`;
                        }
                    } catch (e) { /* Ignore */ }
                } else {
                    metadataWarning = "Metadata not found on contract.";
                }
            } catch (e) {
                metadataWarning = `Metadata check failed (${e.message}).`;
            }
        }

        // 3. Market Data Fetch (Algebra / Uniswap Subgraph)
        // Use unified config
        const SUBGRAPH_URL = getCandleSubgraph(chainId);
        let marketData = null;

        // CRITICAL: Market Subgraph uses Logic Address (NOT Metadata Address) as ID.
        // The 'effectiveProposalId' is the resolved Logic Address of the proposal.
        // The Registry Subgraph gives us metadataContract, but Market Subgraph indexes by Logic Address.
        const marketQueryId = effectiveProposalId;


        yield { status: 'pending', message: `Querying Market Data (Chain ${chainId}, ID: ${marketQueryId})...` };

        try {
            // Enhanced query with outcomeTokens (roles) and pools (full token info)
            const marketQuery = `{
                proposal(id: "${marketQueryId}") {
                    id
                    marketName
                    companyToken { id symbol decimals }
                    currencyToken { id symbol decimals }
                    outcomeTokens {
                        id
                        symbol
                        decimals
                        role
                    }
                    pools {
                        id
                        type
                        outcomeSide
                        token0 { id symbol }
                        token1 { id symbol }
                    }
                }
            }`;

            console.log(`[DEBUG] Market Subgraph: ${SUBGRAPH_URL}`);
            console.log(`[DEBUG] Market Query ID: '${marketQueryId}' (Length: ${marketQueryId.length})`);

            const response = await fetch(SUBGRAPH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: marketQuery })
            });

            const result = await response.json();
            console.log(`[DEBUG] Market Result:`, JSON.stringify(result));

            if (result.data?.proposal) {
                marketData = result.data.proposal;
            }
        } catch (e) {
            yield { status: 'error', message: `Market Data Query Failed: ${e.message}` };
        }

        // 4. Merge & Return
        if (!marketData && !registryData) {
            yield { status: 'error', message: `Proposal not found in any Subgraph. Resolved Addr: ${effectiveProposalId}` };
            return;
        }

        // v0.0.10: Prefer registry data for metadata fields
        const finalDescription = registryData?.description || parsedMetadata?.description || 'N/A';
        const finalMetadataURI = registryData?.metadataURI || parsedMetadata?.metadataURI || 'N/A';
        const finalOwner = registryData?.owner || parsedMetadata?.owner || 'Unknown';
        const finalMetadataContract = registryData?.metadataContract || null;
        const finalTitle = registryData?.title || marketData?.marketName || 'N/A';

        // Parse outcome tokens by role
        const tokensByRole = {};
        marketData?.outcomeTokens?.forEach(t => { tokensByRole[t.role] = t; });

        // Parse pools by type_side
        const poolsByKey = {};
        marketData?.pools?.forEach(p => { poolsByKey[`${p.type}_${p.outcomeSide}`] = p; });

        yield {
            status: 'success',
            message: `Fetched details successfully`,
            data: {
                address: marketData?.id || effectiveProposalId,
                metadataContract: finalMetadataContract,
                question: registryData?.displayNameQuestion || marketData?.marketName || 'N/A',
                marketName: registryData?.displayNameEvent || marketData?.marketName || 'N/A',
                title: finalTitle,
                description: finalDescription,
                metadataURI: finalMetadataURI,
                owner: finalOwner,
                chain: { id: chainId, source: chainSource },

                // Base tokens
                baseTokens: {
                    company: marketData?.companyToken ? {
                        symbol: marketData.companyToken.symbol,
                        address: marketData.companyToken.id,
                        decimals: marketData.companyToken.decimals
                    } : null,
                    currency: marketData?.currencyToken ? {
                        symbol: marketData.currencyToken.symbol,
                        address: marketData.currencyToken.id,
                        decimals: marketData.currencyToken.decimals
                    } : null
                },

                // Outcome tokens by role (easy to consume!)
                outcomeTokens: {
                    YES_COMPANY: tokensByRole['YES_COMPANY'] ? {
                        address: tokensByRole['YES_COMPANY'].id,
                        symbol: tokensByRole['YES_COMPANY'].symbol
                    } : null,
                    NO_COMPANY: tokensByRole['NO_COMPANY'] ? {
                        address: tokensByRole['NO_COMPANY'].id,
                        symbol: tokensByRole['NO_COMPANY'].symbol
                    } : null,
                    YES_CURRENCY: tokensByRole['YES_CURRENCY'] ? {
                        address: tokensByRole['YES_CURRENCY'].id,
                        symbol: tokensByRole['YES_CURRENCY'].symbol
                    } : null,
                    NO_CURRENCY: tokensByRole['NO_CURRENCY'] ? {
                        address: tokensByRole['NO_CURRENCY'].id,
                        symbol: tokensByRole['NO_CURRENCY'].symbol
                    } : null
                },

                // Pools by type (organized structure)
                pools: {
                    conditional: {
                        yes: poolsByKey['CONDITIONAL_YES'] ? {
                            address: poolsByKey['CONDITIONAL_YES'].id,
                            token0: poolsByKey['CONDITIONAL_YES'].token0,
                            token1: poolsByKey['CONDITIONAL_YES'].token1
                        } : null,
                        no: poolsByKey['CONDITIONAL_NO'] ? {
                            address: poolsByKey['CONDITIONAL_NO'].id,
                            token0: poolsByKey['CONDITIONAL_NO'].token0,
                            token1: poolsByKey['CONDITIONAL_NO'].token1
                        } : null
                    },
                    prediction: {
                        yes: poolsByKey['PREDICTION_YES'] ? {
                            address: poolsByKey['PREDICTION_YES'].id,
                            token0: poolsByKey['PREDICTION_YES'].token0,
                            token1: poolsByKey['PREDICTION_YES'].token1
                        } : null,
                        no: poolsByKey['PREDICTION_NO'] ? {
                            address: poolsByKey['PREDICTION_NO'].id,
                            token0: poolsByKey['PREDICTION_NO'].token0,
                            token1: poolsByKey['PREDICTION_NO'].token1
                        } : null
                    },
                    expectedValue: {
                        yes: poolsByKey['EXPECTED_VALUE_YES'] ? {
                            address: poolsByKey['EXPECTED_VALUE_YES'].id,
                            token0: poolsByKey['EXPECTED_VALUE_YES'].token0,
                            token1: poolsByKey['EXPECTED_VALUE_YES'].token1
                        } : null,
                        no: poolsByKey['EXPECTED_VALUE_NO'] ? {
                            address: poolsByKey['EXPECTED_VALUE_NO'].id,
                            token0: poolsByKey['EXPECTED_VALUE_NO'].token0,
                            token1: poolsByKey['EXPECTED_VALUE_NO'].token1
                        } : null
                    }
                },

                poolCount: marketData?.pools?.length || 0,

                extra: {
                    warning: metadataWarning,
                    resolutionInfo: didResolve ? `Resolved from Metadata: ${proposalId}` : null,
                    metadataContract: finalMetadataContract,
                    organization: registryData?.organization?.name
                }
            }
        };
    }

    /**
     * Verify a token address by fetching its symbol and decimals
     */
    async* verifyToken(args) {
        const { tokenAddress, chainId = 100 } = args;

        if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
            yield { status: 'error', message: 'Invalid token address' };
            return;
        }

        const chainConfig = CHAIN_CONFIG[chainId];
        if (!chainConfig) {
            yield { status: 'error', message: `Unsupported chain: ${chainId}` };
            return;
        }

        yield { status: 'pending', message: `Fetching token info from ${chainConfig.name}...` };

        try {
            const chain = chainId === 1 ? mainnet : gnosis;
            const client = createPublicClient({
                chain,
                transport: http(chainConfig.rpcUrl)
            });

            const [symbol, decimals, name] = await Promise.all([
                client.readContract({
                    address: tokenAddress,
                    abi: CONTRACT_ABIS.ERC20,
                    functionName: 'symbol'
                }).catch(() => 'UNKNOWN'),
                client.readContract({
                    address: tokenAddress,
                    abi: CONTRACT_ABIS.ERC20,
                    functionName: 'decimals'
                }).catch(() => 18),
                client.readContract({
                    address: tokenAddress,
                    abi: CONTRACT_ABIS.ERC20,
                    functionName: 'name'
                }).catch(() => 'Unknown Token')
            ]);

            yield {
                status: 'success',
                message: `Token: ${symbol} (${decimals} decimals)`,
                data: {
                    address: tokenAddress,
                    symbol,
                    decimals: Number(decimals),
                    name
                }
            };
        } catch (error) {
            yield { status: 'error', message: `Failed to verify token: ${error.message}` };
        }
    }

    /**
     * Create an actual proposal (trading contract) via the Factory
     */
    async* createActualProposal(args, { walletClient, publicClient, account }) {
        const {
            chainId = 100,
            marketName,
            companyToken,
            currencyToken,
            category = 'crypto',
            language = 'en',
            minBond = '1000000000000000000', // 1 token default
            openingTime // Unix timestamp
        } = args;

        // Validation
        if (!marketName?.trim()) {
            yield { status: 'error', message: 'Market name is required' };
            return;
        }
        if (!companyToken || !/^0x[a-fA-F0-9]{40}$/.test(companyToken)) {
            yield { status: 'error', message: 'Invalid company token address' };
            return;
        }
        if (!currencyToken || !/^0x[a-fA-F0-9]{40}$/.test(currencyToken)) {
            yield { status: 'error', message: 'Invalid currency token address' };
            return;
        }
        if (!openingTime || openingTime < Math.floor(Date.now() / 1000)) {
            yield { status: 'error', message: 'Opening time must be in the future' };
            return;
        }

        const chainConfig = CHAIN_CONFIG[chainId];
        if (!chainConfig) {
            yield { status: 'error', message: `Unsupported chain: ${chainId}` };
            return;
        }

        // Create chain-specific wallet from PRIVATE_KEY
        let privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
            yield { status: 'error', message: 'PRIVATE_KEY not found in .env file' };
            return;
        }

        // Normalize private key format (ensure 0x prefix)
        privateKey = privateKey.trim();
        if (!privateKey.startsWith('0x')) {
            privateKey = '0x' + privateKey;
        }

        yield { status: 'pending', message: `Setting up wallet for ${chainConfig.name}...` };

        let chainWalletClient;
        let chainAccount;
        try {
            const { createWalletClient, http } = await import('viem');
            const { privateKeyToAccount } = await import('viem/accounts');
            const chain = chainId === 1 ? mainnet : gnosis;

            chainAccount = privateKeyToAccount(privateKey);
            chainWalletClient = createWalletClient({
                account: chainAccount,
                chain,
                transport: http(chainConfig.rpcUrl)
            });
            console.log(`[DEBUG] Wallet for ${chainConfig.name}: ${chainAccount.address}`);
        } catch (e) {
            yield { status: 'error', message: `Failed to create wallet: ${e.message}` };
            return;
        }

        yield { status: 'pending', message: `Creating proposal on ${chainConfig.name}...` };

        try {
            // Build params tuple
            const params = [
                marketName,
                companyToken,
                currencyToken,
                category,
                language,
                BigInt(minBond),
                openingTime
            ];

            console.log('[DEBUG] Creating proposal with params:', {
                factoryAddress: chainConfig.factoryAddress,
                marketName,
                companyToken,
                currencyToken,
                category,
                language,
                minBond,
                openingTime
            });

            yield { status: 'pending', message: 'Sending transaction...' };

            const hash = await chainWalletClient.writeContract({
                address: chainConfig.factoryAddress,
                abi: CONTRACT_ABIS.PROPOSAL_FACTORY,
                functionName: 'createProposal',
                args: [params],
                account: chainAccount
            });

            yield { status: 'pending', message: `Transaction sent: ${hash}. Waiting for confirmation...`, data: { hash } };

            // Create chain-specific public client
            const chain = chainId === 1 ? mainnet : gnosis;
            const chainClient = createPublicClient({
                chain,
                transport: http(chainConfig.rpcUrl)
            });

            const receipt = await chainClient.waitForTransactionReceipt({ hash });

            // Try to extract proposal address from NewProposal event
            // Event: NewProposal(address indexed proposal, string marketName, bytes32 conditionId, bytes32 questionId)
            // Signature: 0xd05f26c1ddded17cf93f419cafa17cd29e4447ac6a070f6ad5150012a4dfaec0
            const NEW_PROPOSAL_EVENT = '0xd05f26c1ddded17cf93f419cafa17cd29e4447ac6a070f6ad5150012a4dfaec0';
            let proposalAddress = null;
            for (const log of receipt.logs) {
                try {
                    if (log.topics[0] === NEW_PROPOSAL_EVENT && log.topics[1]) {
                        // Topic 1 is the indexed proposal address
                        proposalAddress = '0x' + log.topics[1].slice(-40);
                        break;
                    }
                } catch { }
            }

            yield {
                status: 'success',
                message: `✅ Proposal created successfully!`,
                data: {
                    transactionHash: hash,
                    proposalAddress,
                    blockNumber: Number(receipt.blockNumber),
                    chain: chainConfig.name,
                    explorerUrl: `${chainConfig.explorerUrl}/tx/${hash}`
                }
            };

        } catch (error) {
            console.error('[ERROR] Create proposal failed:', error);

            let errorMessage = 'Failed to create proposal: ';
            if (error.shortMessage) {
                errorMessage += error.shortMessage;
            } else if (error.message) {
                errorMessage += error.message;
            }

            yield { status: 'error', message: errorMessage };
        }
    }

    /**
     * Get organizations where the given address is the owner (via Registry subgraph)
     */
    async* getOrganizationsByOwner(args) {
        const { ownerAddress } = args;

        if (!ownerAddress || !/^0x[a-fA-F0-9]{40}$/.test(ownerAddress)) {
            yield { status: 'error', message: 'Invalid owner address' };
            return;
        }

        const normalizedOwner = ownerAddress.toLowerCase();
        const COMPLETE_SUBGRAPH_URL = getCompleteSubgraph(100);

        yield { status: 'pending', message: `Searching for organizations owned by ${ownerAddress.slice(0, 10)}...` };

        try {
            const query = `{
                organizations(where: { owner: "${normalizedOwner}" }, first: 100) {
                    id
                    name
                    owner
                    description
                }
            }`;

            const response = await fetch(COMPLETE_SUBGRAPH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });

            const result = await response.json();
            const orgs = result.data?.organizations || [];

            yield {
                status: 'success',
                message: `Found ${orgs.length} organization(s)`,
                data: orgs.map(o => ({
                    address: o.id,
                    name: o.name,
                    owner: o.owner,
                    description: o.description
                }))
            };
        } catch (error) {
            yield { status: 'error', message: `Failed to query organizations: ${error.message}` };
        }
    }

    /**
     * Link a proposal (trading contract) to an organization by creating ProposalMetadata
     */
    async* linkProposalToOrganization(args) {
        const {
            organizationAddress,
            proposalAddress,  // Trading contract address
            displayNameQuestion,
            displayNameEvent,
            description = '',
            metadata = '',
            metadataURI = ''
        } = args;

        // Validation
        if (!organizationAddress || !/^0x[a-fA-F0-9]{40}$/.test(organizationAddress)) {
            yield { status: 'error', message: 'Invalid organization address' };
            return;
        }
        if (!proposalAddress || !/^0x[a-fA-F0-9]{40}$/.test(proposalAddress)) {
            yield { status: 'error', message: 'Invalid proposal address' };
            return;
        }
        if (!displayNameQuestion?.trim()) {
            yield { status: 'error', message: 'Display name (question) is required' };
            return;
        }

        // Setup wallet for Gnosis (Registry is on Gnosis)
        let privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
            yield { status: 'error', message: 'PRIVATE_KEY not found in .env file' };
            return;
        }
        privateKey = privateKey.trim();
        if (!privateKey.startsWith('0x')) {
            privateKey = '0x' + privateKey;
        }

        yield { status: 'pending', message: 'Setting up wallet...' };

        let chainWalletClient;
        let chainAccount;
        try {
            const { createWalletClient, http } = await import('viem');
            const { privateKeyToAccount } = await import('viem/accounts');

            chainAccount = privateKeyToAccount(privateKey);
            chainWalletClient = createWalletClient({
                account: chainAccount,
                chain: gnosis,
                transport: http('https://rpc.gnosischain.com')
            });
        } catch (e) {
            yield { status: 'error', message: `Failed to create wallet: ${e.message}` };
            return;
        }

        yield { status: 'pending', message: 'Creating ProposalMetadata and linking...' };

        try {
            // Call Organization.createAndAddProposalMetadata
            const hash = await chainWalletClient.writeContract({
                address: organizationAddress,
                abi: CONTRACT_ABIS.ORGANIZATION,
                functionName: 'createAndAddProposalMetadata',
                args: [
                    proposalAddress,
                    displayNameQuestion,
                    displayNameEvent || displayNameQuestion,
                    description,
                    metadata,
                    metadataURI
                ],
                account: chainAccount
            });

            yield { status: 'pending', message: `Transaction sent: ${hash}. Waiting for confirmation...` };

            // Wait for confirmation
            const client = createPublicClient({
                chain: gnosis,
                transport: http('https://rpc.gnosischain.com')
            });

            const receipt = await client.waitForTransactionReceipt({ hash });

            // Try to extract metadata contract from ProposalCreatedAndAdded event
            // Event: ProposalCreatedAndAdded(address indexed proposalMetadata, address indexed proposalAddress)
            // Signature: 0x8f76dcc62256638841dfcf42bf7111663135f3f40f28c8fd18d7fcc5a85ac877
            const PROPOSAL_CREATED_EVENT = '0x8f76dcc62256638841dfcf42bf7111663135f3f40f28c8fd18d7fcc5a85ac877';
            let metadataContract = null;
            for (const log of receipt.logs) {
                try {
                    if (log.topics[0] === PROPOSAL_CREATED_EVENT && log.topics[1]) {
                        // Topic 1 is proposalMetadata (indexed)
                        metadataContract = '0x' + log.topics[1].slice(-40);
                        break;
                    }
                } catch { }
            }

            yield {
                status: 'success',
                message: '✅ Proposal linked to organization!',
                data: {
                    transactionHash: hash,
                    metadataContract,
                    explorerUrl: `https://gnosisscan.io/tx/${hash}`
                }
            };

        } catch (error) {
            console.error('[ERROR] Link proposal failed:', error);
            let errorMessage = 'Failed to link proposal: ';
            if (error.shortMessage) {
                errorMessage += error.shortMessage;
            } else if (error.message) {
                errorMessage += error.message;
            }
            yield { status: 'error', message: errorMessage };
        }
    }

    // =========================================
    // NEW: Metadata CRUD Operations
    // =========================================

    /**
     * Get organization details with all metadataEntries from subgraph
     */
    async* getOrganizationMetadata(args) {
        const { organizationAddress, chainId = 100 } = args;

        if (!organizationAddress || !/^0x[a-fA-F0-9]{40}$/.test(organizationAddress)) {
            yield { status: 'error', message: 'Invalid organization address' };
            return;
        }

        const orgId = organizationAddress.toLowerCase();
        const SUBGRAPH_URL = getCompleteSubgraph(chainId);

        yield { status: 'pending', message: `Fetching metadata for organization ${orgId.slice(0, 10)}... (chain ${chainId})` };

        try {
            const query = `{
                organization(id: "${orgId}") {
                    id
                    name
                    description
                    owner
                    editor
                    metadata
                    metadataURI
                    createdAt
                    metadataEntries {
                        id
                        key
                        value
                    }
                    proposals {
                        id
                        title
                        proposalAddress
                    }
                }
            }`;

            const response = await fetch(SUBGRAPH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });

            const result = await response.json();

            if (result.errors) {
                yield { status: 'error', message: `GraphQL Error: ${JSON.stringify(result.errors)}` };
                return;
            }

            const org = result.data?.organization;
            if (!org) {
                yield { status: 'error', message: 'Organization not found in subgraph' };
                return;
            }

            // Transform metadataEntries to a simple key-value map
            const metadataMap = {};
            org.metadataEntries?.forEach(e => {
                metadataMap[e.key] = e.value;
            });

            // Extract chain from metadata JSON if present
            let detectedChain = chainId;
            try {
                if (org.metadata) {
                    const parsedMeta = JSON.parse(org.metadata);
                    if (parsedMeta?.chain) {
                        detectedChain = typeof parsedMeta.chain === 'string' ? parseInt(parsedMeta.chain) : parsedMeta.chain;
                    }
                }
            } catch (e) { /* Ignore parse errors */ }

            yield {
                status: 'success',
                message: `Found ${org.metadataEntries?.length || 0} metadata entries`,
                data: {
                    address: org.id,
                    name: org.name,
                    description: org.description,
                    owner: org.owner,
                    editor: org.editor,
                    metadata: org.metadata,
                    metadataURI: org.metadataURI,
                    createdAt: org.createdAt,
                    metadataEntries: org.metadataEntries || [],
                    metadataMap,
                    proposalCount: org.proposals?.length || 0,
                    chainId: detectedChain
                }
            };

        } catch (error) {
            yield { status: 'error', message: `Failed to fetch organization metadata: ${error.message}` };
        }
    }

    /**
     * Get proposal details with all metadataEntries from subgraph
     */
    async* getProposalMetadata(args) {
        const { proposalAddress, chainId = 100, aggregatorAddress } = args;

        if (!proposalAddress || !/^0x[a-fA-F0-9]{40}$/.test(proposalAddress)) {
            yield { status: 'error', message: 'Invalid proposal address' };
            return;
        }

        const SUBGRAPH_URL = getCompleteSubgraph(chainId);
        const propId = proposalAddress.toLowerCase();

        // Use provided aggregator or default
        const aggregator = (aggregatorAddress || CONTRACT_ADDRESSES.DEFAULT_AGGREGATOR).toLowerCase();

        yield { status: 'pending', message: `Fetching metadata for proposal ${propId.slice(0, 10)}... (chain ${chainId}, aggregator ${aggregator.slice(0, 10)}...)` };

        try {
            // v0.0.11: Filter by proposalAddress AND organization must be under the specified aggregator
            // This ensures we get the correct metadata contract when multiple exist for the same trading address
            const query = `{
                proposalEntities(where: { 
                    proposalAddress: "${propId}",
                    organization_: { aggregator: "${aggregator}" }
                }, first: 1) {
                    id
                    proposalAddress
                    title
                    description
                    displayNameQuestion
                    displayNameEvent
                    owner
                    editor
                    metadata
                    metadataURI
                    createdAtTimestamp
                    metadataEntries {
                        id
                        key
                        value
                    }
                    organization {
                        id
                        name
                        aggregator {
                            id
                        }
                    }
                }
            }`;

            const response = await fetch(SUBGRAPH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });

            const result = await response.json();

            if (result.errors) {
                yield { status: 'error', message: `GraphQL Error: ${JSON.stringify(result.errors)}` };
                return;
            }

            const proposal = result.data?.proposalEntities?.[0];
            if (!proposal) {
                yield { status: 'error', message: 'Proposal not found in subgraph (searched by proposalAddress)' };
                return;
            }

            // Transform metadataEntries to a simple key-value map
            const metadataMap = {};
            proposal.metadataEntries?.forEach(e => {
                metadataMap[e.key] = e.value;
            });

            yield {
                status: 'success',
                message: `Found ${proposal.metadataEntries?.length || 0} metadata entries`,
                data: {
                    metadataContract: proposal.id,
                    proposalAddress: proposal.proposalAddress,
                    title: proposal.title,
                    description: proposal.description,
                    displayNameQuestion: proposal.displayNameQuestion,
                    displayNameEvent: proposal.displayNameEvent,
                    owner: proposal.owner,
                    editor: proposal.editor,
                    metadata: proposal.metadata,
                    metadataURI: proposal.metadataURI,
                    createdAt: proposal.createdAtTimestamp,
                    metadataEntries: proposal.metadataEntries || [],
                    metadataMap,
                    organization: proposal.organization
                }
            };

        } catch (error) {
            yield { status: 'error', message: `Failed to fetch proposal metadata: ${error.message}` };
        }
    }

    /**
     * Get aggregator details with all metadataEntries from subgraph
     */
    async* getAggregatorMetadata(args) {
        const aggregatorAddress = args.aggregatorAddress || CONTRACT_ADDRESSES.DEFAULT_AGGREGATOR;
        const aggId = aggregatorAddress.toLowerCase();
        const SUBGRAPH_URL = getCompleteSubgraph(100);

        yield { status: 'pending', message: `Fetching metadata for aggregator ${aggId.slice(0, 10)}...` };

        try {
            const query = `{
                aggregator(id: "${aggId}") {
                    id
                    name
                    description
                    owner
                    editor
                    metadata
                    metadataURI
                    createdAt
                    metadataEntries {
                        id
                        key
                        value
                    }
                    organizations {
                        id
                        name
                    }
                }
            }`;

            const response = await fetch(SUBGRAPH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });

            const result = await response.json();

            if (result.errors) {
                yield { status: 'error', message: `GraphQL Error: ${JSON.stringify(result.errors)}` };
                return;
            }

            const agg = result.data?.aggregator;
            if (!agg) {
                yield { status: 'error', message: 'Aggregator not found in subgraph' };
                return;
            }

            // Transform metadataEntries to a simple key-value map
            const metadataMap = {};
            agg.metadataEntries?.forEach(e => {
                metadataMap[e.key] = e.value;
            });

            yield {
                status: 'success',
                message: `Found ${agg.metadataEntries?.length || 0} metadata entries`,
                data: {
                    address: agg.id,
                    name: agg.name,
                    description: agg.description,
                    owner: agg.owner,
                    editor: agg.editor,
                    metadata: agg.metadata,
                    metadataURI: agg.metadataURI,
                    createdAt: agg.createdAt,
                    metadataEntries: agg.metadataEntries || [],
                    metadataMap,
                    organizationCount: agg.organizations?.length || 0
                }
            };

        } catch (error) {
            yield { status: 'error', message: `Failed to fetch aggregator metadata: ${error.message}` };
        }
    }

    /**
     * Update entity metadata with SMART MERGE logic
     * Reads current metadata, merges new key-value, then writes back
     * 
     * @param {Object} args
     * @param {string} args.entityType - 'aggregator', 'organization', or 'proposal'
     * @param {string} args.entityAddress - Address of the entity to update
     * @param {string} args.key - Metadata key to set/update
     * @param {string} args.value - Metadata value
     * @param {string} [args.metadataURI] - Optional URI to update
     */
    async* updateEntityMetadata(args, { publicClient }) {
        const { entityType, entityAddress, key, value, metadataURI } = args;

        // Validation
        if (!['aggregator', 'organization', 'proposal'].includes(entityType)) {
            yield { status: 'error', message: 'entityType must be: aggregator, organization, or proposal' };
            return;
        }
        if (!entityAddress || !/^0x[a-fA-F0-9]{40}$/.test(entityAddress)) {
            yield { status: 'error', message: 'Invalid entity address' };
            return;
        }
        if (!key || typeof key !== 'string') {
            yield { status: 'error', message: 'Key is required' };
            return;
        }

        // Setup wallet
        let privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
            yield { status: 'error', message: 'PRIVATE_KEY not found in .env file' };
            return;
        }
        privateKey = privateKey.trim();
        if (!privateKey.startsWith('0x')) {
            privateKey = '0x' + privateKey;
        }

        yield { status: 'pending', message: 'Reading current metadata...' };

        // 1. Read current metadata from contract
        let currentMetadata = '';
        let currentMetadataURI = '';
        const abi = entityType === 'aggregator' ? CONTRACT_ABIS.AGGREGATOR :
            entityType === 'organization' ? CONTRACT_ABIS.ORGANIZATION :
                CONTRACT_ABIS.PROPOSAL;

        try {
            const client = createPublicClient({
                chain: gnosis,
                transport: http('https://rpc.gnosischain.com')
            });

            currentMetadata = await client.readContract({
                address: entityAddress,
                abi,
                functionName: 'metadata'
            }).catch(() => '');

            currentMetadataURI = await client.readContract({
                address: entityAddress,
                abi,
                functionName: 'metadataURI'
            }).catch(() => '');

            yield { status: 'pending', message: `Current metadata length: ${currentMetadata?.length || 0} chars` };

        } catch (e) {
            yield { status: 'error', message: `Failed to read current metadata: ${e.message}` };
            return;
        }

        // 2. Parse, merge, stringify
        let metadataObj = {};
        try {
            if (currentMetadata && currentMetadata.trim()) {
                metadataObj = JSON.parse(currentMetadata);
            }
        } catch (e) {
            // If not valid JSON, start fresh
            yield { status: 'pending', message: 'Current metadata is not valid JSON, starting fresh...' };
        }

        // Smart merge: add/update the key
        metadataObj[key] = value;
        const newMetadata = JSON.stringify(metadataObj);
        const newMetadataURI = metadataURI !== undefined ? metadataURI : currentMetadataURI;

        yield { status: 'pending', message: `Merged metadata: ${Object.keys(metadataObj).length} keys. Submitting...` };

        // 3. Write back to contract
        try {
            const { createWalletClient, http } = await import('viem');
            const { privateKeyToAccount } = await import('viem/accounts');

            const account = privateKeyToAccount(privateKey);
            const walletClient = createWalletClient({
                account,
                chain: gnosis,
                transport: http('https://rpc.gnosischain.com')
            });

            const hash = await walletClient.writeContract({
                address: entityAddress,
                abi,
                functionName: 'updateExtendedMetadata',
                args: [newMetadata, newMetadataURI],
                account
            });

            yield { status: 'pending', message: `Transaction sent: ${hash}. Waiting for confirmation...` };

            const client = createPublicClient({
                chain: gnosis,
                transport: http('https://rpc.gnosischain.com')
            });

            const receipt = await client.waitForTransactionReceipt({ hash });

            yield {
                status: 'success',
                message: `✅ Metadata updated! Key: "${key}" = "${value.slice(0, 30)}${value.length > 30 ? '...' : ''}"`,
                data: {
                    transactionHash: hash,
                    blockNumber: Number(receipt.blockNumber),
                    entityType,
                    entityAddress,
                    key,
                    value,
                    totalKeys: Object.keys(metadataObj).length,
                    explorerUrl: `https://gnosisscan.io/tx/${hash}`
                }
            };

        } catch (error) {
            console.error('[ERROR] Update metadata failed:', error);
            let errorMessage = 'Failed to update metadata: ';
            if (error.shortMessage) {
                errorMessage += error.shortMessage;
            } else if (error.message) {
                errorMessage += error.message;
            }
            yield { status: 'error', message: errorMessage };
        }
    }

    /**
     * Batch update entity metadata - single transaction for multiple keys
     * Reads current metadata, merges all new key-values, then writes back ONCE
     * 
     * @param {Object} args
     * @param {string} args.entityType - 'aggregator', 'organization', or 'proposal'
     * @param {string} args.entityAddress - Address of the entity to update
     * @param {Object} args.updates - Object with key-value pairs to update, e.g. {"logo": "https://...", "chain": "1"}
     * @param {string} [args.metadataURI] - Optional URI to update
     */
    async* batchUpdateEntityMetadata(args, { publicClient }) {
        const { entityType, entityAddress, updates, metadataURI } = args;

        // Validation
        if (!['aggregator', 'organization', 'proposal'].includes(entityType)) {
            yield { status: 'error', message: 'entityType must be: aggregator, organization, or proposal' };
            return;
        }
        if (!entityAddress || !/^0x[a-fA-F0-9]{40}$/.test(entityAddress)) {
            yield { status: 'error', message: 'Invalid entity address' };
            return;
        }
        if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
            yield { status: 'error', message: 'updates must be an object with at least one key-value pair' };
            return;
        }

        const keysToUpdate = Object.keys(updates);
        yield { status: 'pending', message: `Batch updating ${keysToUpdate.length} keys: ${keysToUpdate.join(', ')}` };

        // Setup wallet
        let privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
            yield { status: 'error', message: 'PRIVATE_KEY not found in .env file' };
            return;
        }
        privateKey = privateKey.trim();
        if (!privateKey.startsWith('0x')) {
            privateKey = '0x' + privateKey;
        }

        yield { status: 'pending', message: 'Reading current metadata...' };

        // 1. Read current metadata from contract
        let currentMetadata = '';
        let currentMetadataURI = '';
        const abi = entityType === 'aggregator' ? CONTRACT_ABIS.AGGREGATOR :
            entityType === 'organization' ? CONTRACT_ABIS.ORGANIZATION :
                CONTRACT_ABIS.PROPOSAL;

        try {
            const client = createPublicClient({
                chain: gnosis,
                transport: http('https://rpc.gnosischain.com')
            });

            currentMetadata = await client.readContract({
                address: entityAddress,
                abi,
                functionName: 'metadata'
            }).catch(() => '');

            currentMetadataURI = await client.readContract({
                address: entityAddress,
                abi,
                functionName: 'metadataURI'
            }).catch(() => '');

            yield { status: 'pending', message: `Current metadata length: ${currentMetadata?.length || 0} chars` };

        } catch (e) {
            yield { status: 'error', message: `Failed to read current metadata: ${e.message}` };
            return;
        }

        // 2. Parse, merge ALL keys, stringify
        let metadataObj = {};
        try {
            if (currentMetadata && currentMetadata.trim()) {
                metadataObj = JSON.parse(currentMetadata);
            }
        } catch (e) {
            // If not valid JSON, start fresh
            yield { status: 'pending', message: 'Current metadata is not valid JSON, starting fresh...' };
        }

        // Smart merge: add/update ALL keys from updates object
        for (const [key, value] of Object.entries(updates)) {
            metadataObj[key] = value;
        }
        const newMetadata = JSON.stringify(metadataObj);
        const newMetadataURI = metadataURI !== undefined ? metadataURI : currentMetadataURI;

        yield { status: 'pending', message: `Merged metadata: ${Object.keys(metadataObj).length} total keys. Submitting single transaction...` };

        // 3. Write back to contract - SINGLE TRANSACTION
        try {
            const { createWalletClient, http } = await import('viem');
            const { privateKeyToAccount } = await import('viem/accounts');

            const account = privateKeyToAccount(privateKey);
            const walletClient = createWalletClient({
                account,
                chain: gnosis,
                transport: http('https://rpc.gnosischain.com')
            });

            const hash = await walletClient.writeContract({
                address: entityAddress,
                abi,
                functionName: 'updateExtendedMetadata',
                args: [newMetadata, newMetadataURI],
                account
            });

            yield { status: 'pending', message: `Transaction sent: ${hash}. Waiting for confirmation...` };

            const client = createPublicClient({
                chain: gnosis,
                transport: http('https://rpc.gnosischain.com')
            });

            const receipt = await client.waitForTransactionReceipt({ hash });

            yield {
                status: 'success',
                message: `✅ Batch metadata updated! ${keysToUpdate.length} keys in 1 transaction`,
                data: {
                    transactionHash: hash,
                    blockNumber: Number(receipt.blockNumber),
                    entityType,
                    entityAddress,
                    keysUpdated: keysToUpdate,
                    totalKeys: Object.keys(metadataObj).length,
                    explorerUrl: `https://gnosisscan.io/tx/${hash}`
                }
            };

        } catch (error) {
            console.error('[ERROR] Batch update metadata failed:', error);
            let errorMessage = 'Failed to batch update metadata: ';
            if (error.shortMessage) {
                errorMessage += error.shortMessage;
            } else if (error.message) {
                errorMessage += error.message;
            }
            yield { status: 'error', message: errorMessage };
        }
    }

    /**
     * Remove an organization from an Aggregator by index
     */
    async* removeOrganization(args, { publicClient }) {
        const { aggregatorAddress, organizationIndex } = args;

        if (!aggregatorAddress) {
            yield { status: 'error', message: 'aggregatorAddress is required' };
            return;
        }
        if (organizationIndex === undefined || organizationIndex < 0) {
            yield { status: 'error', message: 'Valid organizationIndex is required' };
            return;
        }

        let privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
            yield { status: 'error', message: 'PRIVATE_KEY not found in .env file' };
            return;
        }
        privateKey = privateKey.trim();
        if (!privateKey.startsWith('0x')) privateKey = '0x' + privateKey;

        yield { status: 'pending', message: `Removing organization at index ${organizationIndex}...` };

        try {
            const { createWalletClient, http } = await import('viem');
            const { privateKeyToAccount } = await import('viem/accounts');

            const account = privateKeyToAccount(privateKey);
            const walletClient = createWalletClient({
                account,
                chain: gnosis,
                transport: http('https://rpc.gnosischain.com')
            });

            const hash = await walletClient.writeContract({
                address: aggregatorAddress,
                abi: CONTRACT_ABIS.AGGREGATOR,
                functionName: 'removeOrganizationMetadata',
                args: [BigInt(organizationIndex)],
                account
            });

            yield { status: 'pending', message: `Transaction sent: ${hash}. Waiting...` };

            const client = createPublicClient({
                chain: gnosis,
                transport: http('https://rpc.gnosischain.com')
            });

            const receipt = await client.waitForTransactionReceipt({ hash });

            yield {
                status: 'success',
                message: `✅ Organization removed from index ${organizationIndex}`,
                data: {
                    transactionHash: hash,
                    blockNumber: Number(receipt.blockNumber),
                    explorerUrl: `https://gnosisscan.io/tx/${hash}`
                }
            };
        } catch (error) {
            yield { status: 'error', message: `Failed to remove organization: ${error.message}` };
        }
    }

    /**
     * Remove a proposal from an Organization by index
     */
    async* removeProposal(args, { publicClient }) {
        const { organizationAddress, proposalIndex } = args;

        if (!organizationAddress) {
            yield { status: 'error', message: 'organizationAddress is required' };
            return;
        }
        if (proposalIndex === undefined || proposalIndex < 0) {
            yield { status: 'error', message: 'Valid proposalIndex is required' };
            return;
        }

        let privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
            yield { status: 'error', message: 'PRIVATE_KEY not found in .env file' };
            return;
        }
        privateKey = privateKey.trim();
        if (!privateKey.startsWith('0x')) privateKey = '0x' + privateKey;

        yield { status: 'pending', message: `Removing proposal at index ${proposalIndex}...` };

        try {
            const { createWalletClient, http } = await import('viem');
            const { privateKeyToAccount } = await import('viem/accounts');

            const account = privateKeyToAccount(privateKey);
            const walletClient = createWalletClient({
                account,
                chain: gnosis,
                transport: http('https://rpc.gnosischain.com')
            });

            const hash = await walletClient.writeContract({
                address: organizationAddress,
                abi: CONTRACT_ABIS.ORGANIZATION,
                functionName: 'removeProposalMetadata',
                args: [BigInt(proposalIndex)],
                account
            });

            yield { status: 'pending', message: `Transaction sent: ${hash}. Waiting...` };

            const client = createPublicClient({
                chain: gnosis,
                transport: http('https://rpc.gnosischain.com')
            });

            const receipt = await client.waitForTransactionReceipt({ hash });

            yield {
                status: 'success',
                message: `✅ Proposal removed from index ${proposalIndex}`,
                data: {
                    transactionHash: hash,
                    blockNumber: Number(receipt.blockNumber),
                    explorerUrl: `https://gnosisscan.io/tx/${hash}`
                }
            };
        } catch (error) {
            yield { status: 'error', message: `Failed to remove proposal: ${error.message}` };
        }
    }

    /**
     * Create and add a new Organization to an Aggregator
     */
    async* createOrganization(args, { publicClient }) {
        const {
            aggregatorAddress,
            companyName,
            description = '',
            metadata = '',
            metadataURI = ''
        } = args;

        if (!aggregatorAddress) {
            yield { status: 'error', message: 'aggregatorAddress is required' };
            return;
        }
        if (!companyName?.trim()) {
            yield { status: 'error', message: 'companyName is required' };
            return;
        }

        let privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
            yield { status: 'error', message: 'PRIVATE_KEY not found in .env file' };
            return;
        }
        privateKey = privateKey.trim();
        if (!privateKey.startsWith('0x')) privateKey = '0x' + privateKey;

        yield { status: 'pending', message: `Creating organization "${companyName}"...` };

        try {
            const { createWalletClient, http } = await import('viem');
            const { privateKeyToAccount } = await import('viem/accounts');

            const account = privateKeyToAccount(privateKey);
            const walletClient = createWalletClient({
                account,
                chain: gnosis,
                transport: http('https://rpc.gnosischain.com')
            });

            const hash = await walletClient.writeContract({
                address: aggregatorAddress,
                abi: CONTRACT_ABIS.AGGREGATOR,
                functionName: 'createAndAddOrganizationMetadata',
                args: [companyName, description, metadata, metadataURI],
                account
            });

            yield { status: 'pending', message: `Transaction sent: ${hash}. Waiting...` };

            const client = createPublicClient({
                chain: gnosis,
                transport: http('https://rpc.gnosischain.com')
            });

            const receipt = await client.waitForTransactionReceipt({ hash });

            // Extract organization address from event
            let organizationAddress = null;
            for (const log of receipt.logs) {
                if (log.topics && log.topics.length >= 2) {
                    organizationAddress = '0x' + log.topics[1].slice(-40);
                    break;
                }
            }

            yield {
                status: 'success',
                message: `✅ Organization "${companyName}" created!`,
                data: {
                    transactionHash: hash,
                    organizationAddress,
                    blockNumber: Number(receipt.blockNumber),
                    explorerUrl: `https://gnosisscan.io/tx/${hash}`
                }
            };
        } catch (error) {
            yield { status: 'error', message: `Failed to create organization: ${error.message}` };
        }
    }

    /**
     * Update Organization Info (name and description)
     */
    async* updateOrganizationInfo(args, { publicClient }) {
        const { organizationAddress, newName, newDescription } = args;

        if (!organizationAddress) {
            yield { status: 'error', message: 'organizationAddress is required' };
            return;
        }
        if (!newName?.trim()) {
            yield { status: 'error', message: 'newName is required' };
            return;
        }

        let privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
            yield { status: 'error', message: 'PRIVATE_KEY not found in .env file' };
            return;
        }
        privateKey = privateKey.trim();
        if (!privateKey.startsWith('0x')) privateKey = '0x' + privateKey;

        yield { status: 'pending', message: `Updating organization info to "${newName}"...` };

        try {
            const { createWalletClient, http } = await import('viem');
            const { privateKeyToAccount } = await import('viem/accounts');

            const account = privateKeyToAccount(privateKey);
            const walletClient = createWalletClient({
                account,
                chain: gnosis,
                transport: http('https://rpc.gnosischain.com')
            });

            const hash = await walletClient.writeContract({
                address: organizationAddress,
                abi: CONTRACT_ABIS.ORGANIZATION,
                functionName: 'updateCompanyInfo',
                args: [newName, newDescription || ''],
                account
            });

            yield { status: 'pending', message: `Transaction sent: ${hash}. Waiting...` };

            const client = createPublicClient({
                chain: gnosis,
                transport: http('https://rpc.gnosischain.com')
            });

            const receipt = await client.waitForTransactionReceipt({ hash });

            yield {
                status: 'success',
                message: `✅ Organization updated to "${newName}"`,
                data: {
                    transactionHash: hash,
                    blockNumber: Number(receipt.blockNumber),
                    explorerUrl: `https://gnosisscan.io/tx/${hash}`
                }
            };
        } catch (error) {
            yield { status: 'error', message: `Failed to update organization: ${error.message}` };
        }
    }

    /**
     * Update Aggregator Info (name and description)
     */
    async* updateAggregatorInfo(args, { publicClient }) {
        const { aggregatorAddress, newName, newDescription } = args;

        if (!aggregatorAddress) {
            yield { status: 'error', message: 'aggregatorAddress is required' };
            return;
        }
        if (!newName?.trim()) {
            yield { status: 'error', message: 'newName is required' };
            return;
        }

        let privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
            yield { status: 'error', message: 'PRIVATE_KEY not found in .env file' };
            return;
        }
        privateKey = privateKey.trim();
        if (!privateKey.startsWith('0x')) privateKey = '0x' + privateKey;

        yield { status: 'pending', message: `Updating aggregator info to "${newName}"...` };

        try {
            const { createWalletClient, http } = await import('viem');
            const { privateKeyToAccount } = await import('viem/accounts');

            const account = privateKeyToAccount(privateKey);
            const walletClient = createWalletClient({
                account,
                chain: gnosis,
                transport: http('https://rpc.gnosischain.com')
            });

            const hash = await walletClient.writeContract({
                address: aggregatorAddress,
                abi: CONTRACT_ABIS.AGGREGATOR,
                functionName: 'updateAggregatorInfo',
                args: [newName, newDescription || ''],
                account
            });

            yield { status: 'pending', message: `Transaction sent: ${hash}. Waiting...` };

            const client = createPublicClient({
                chain: gnosis,
                transport: http('https://rpc.gnosischain.com')
            });

            const receipt = await client.waitForTransactionReceipt({ hash });

            yield {
                status: 'success',
                message: `✅ Aggregator updated to "${newName}"`,
                data: {
                    transactionHash: hash,
                    blockNumber: Number(receipt.blockNumber),
                    explorerUrl: `https://gnosisscan.io/tx/${hash}`
                }
            };
        } catch (error) {
            yield { status: 'error', message: `Failed to update aggregator: ${error.message}` };
        }
    }

    /**
     * Update Proposal Info (displayNameQuestion, displayNameEvent, description)
     * SAFE: Reads current values first and only updates the fields you specify
     */
    async* updateProposalInfo(args, { publicClient }) {
        const { proposalMetadataAddress, displayNameQuestion, displayNameEvent, description } = args;

        if (!proposalMetadataAddress) {
            yield { status: 'error', message: 'proposalMetadataAddress is required' };
            return;
        }

        let privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
            yield { status: 'error', message: 'PRIVATE_KEY not found in .env file' };
            return;
        }
        privateKey = privateKey.trim();
        if (!privateKey.startsWith('0x')) privateKey = '0x' + privateKey;

        yield { status: 'pending', message: `Reading current proposal metadata...` };

        try {
            const { createWalletClient, createPublicClient, http } = await import('viem');
            const { privateKeyToAccount } = await import('viem/accounts');

            const client = createPublicClient({
                chain: gnosis,
                transport: http('https://rpc.gnosischain.com')
            });

            // Read current values first to avoid overwriting
            const [currentQuestion, currentEvent, currentDescription] = await Promise.all([
                client.readContract({
                    address: proposalMetadataAddress,
                    abi: CONTRACT_ABIS.PROPOSAL,
                    functionName: 'displayNameQuestion'
                }).catch(() => ''),
                client.readContract({
                    address: proposalMetadataAddress,
                    abi: CONTRACT_ABIS.PROPOSAL,
                    functionName: 'displayNameEvent'
                }).catch(() => ''),
                client.readContract({
                    address: proposalMetadataAddress,
                    abi: CONTRACT_ABIS.PROPOSAL,
                    functionName: 'description'
                }).catch(() => '')
            ]);

            // Merge: use new value ONLY if provided as non-empty string, otherwise keep current
            const finalQuestion = (displayNameQuestion && displayNameQuestion.trim()) ? displayNameQuestion : currentQuestion;
            const finalEvent = (displayNameEvent && displayNameEvent.trim()) ? displayNameEvent : currentEvent;
            const finalDescription = (description && description.trim()) ? description : currentDescription;

            yield { status: 'pending', message: `Updating proposal metadata (preserving unspecified fields)...` };

            const account = privateKeyToAccount(privateKey);
            const walletClient = createWalletClient({
                account,
                chain: gnosis,
                transport: http('https://rpc.gnosischain.com')
            });

            const hash = await walletClient.writeContract({
                address: proposalMetadataAddress,
                abi: CONTRACT_ABIS.PROPOSAL,
                functionName: 'updateMetadata',
                args: [finalQuestion, finalEvent, finalDescription],
                account
            });

            yield { status: 'pending', message: `Transaction sent: ${hash}. Waiting...` };

            const receipt = await client.waitForTransactionReceipt({ hash });

            yield {
                status: 'success',
                message: `✅ Proposal metadata updated`,
                data: {
                    transactionHash: hash,
                    blockNumber: Number(receipt.blockNumber),
                    explorerUrl: `https://gnosisscan.io/tx/${hash}`,
                    updated: {
                        displayNameQuestion: displayNameQuestion !== undefined,
                        displayNameEvent: displayNameEvent !== undefined,
                        description: description !== undefined
                    }
                }
            };
        } catch (error) {
            yield { status: 'error', message: `Failed to update proposal: ${error.message}` };
        }
    }

    /**
     * Add an existing ProposalMetadata contract to an organization
     * This just calls addProposalMetadata(address) on the organization
     */
    async* addExistingMetadata(args, { publicClient }) {
        const { organizationAddress, metadataAddress } = args;

        if (!organizationAddress) {
            yield { status: 'error', message: 'organizationAddress is required' };
            return;
        }
        if (!metadataAddress) {
            yield { status: 'error', message: 'metadataAddress is required' };
            return;
        }

        let privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
            yield { status: 'error', message: 'PRIVATE_KEY not found in .env file' };
            return;
        }
        privateKey = privateKey.trim();
        if (!privateKey.startsWith('0x')) privateKey = '0x' + privateKey;

        yield { status: 'pending', message: `Adding metadata ${metadataAddress.slice(0, 10)}... to organization...` };

        try {
            const { createWalletClient, http } = await import('viem');
            const { privateKeyToAccount } = await import('viem/accounts');

            const account = privateKeyToAccount(privateKey);
            const walletClient = createWalletClient({
                account,
                chain: gnosis,
                transport: http('https://rpc.gnosischain.com')
            });

            const hash = await walletClient.writeContract({
                address: organizationAddress,
                abi: CONTRACT_ABIS.ORGANIZATION,
                functionName: 'addProposalMetadata',
                args: [metadataAddress],
                account
            });

            yield { status: 'pending', message: `Transaction sent: ${hash}. Waiting...` };

            const client = createPublicClient({
                chain: gnosis,
                transport: http('https://rpc.gnosischain.com')
            });

            const receipt = await client.waitForTransactionReceipt({ hash });

            yield {
                status: 'success',
                message: `✅ Metadata added to organization!`,
                data: {
                    transactionHash: hash,
                    blockNumber: Number(receipt.blockNumber),
                    explorerUrl: `https://gnosisscan.io/tx/${hash}`
                }
            };
        } catch (error) {
            yield { status: 'error', message: `Failed to add metadata: ${error.message}` };
        }
    }

    /**
     * Update extended metadata on an Organization contract
     */
    async* updateOrgExtendedMetadata(args, { publicClient }) {
        const { organizationAddress, metadata, metadataURI } = args;

        if (!organizationAddress) {
            yield { status: 'error', message: 'organizationAddress is required' };
            return;
        }

        let privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
            yield { status: 'error', message: 'PRIVATE_KEY not found in .env file' };
            return;
        }
        privateKey = privateKey.trim();
        if (!privateKey.startsWith('0x')) privateKey = '0x' + privateKey;

        yield { status: 'pending', message: `Updating extended metadata on organization...` };

        try {
            const { createWalletClient, http } = await import('viem');
            const { privateKeyToAccount } = await import('viem/accounts');

            const account = privateKeyToAccount(privateKey);
            const walletClient = createWalletClient({
                account,
                chain: gnosis,
                transport: http('https://rpc.gnosischain.com')
            });

            const hash = await walletClient.writeContract({
                address: organizationAddress,
                abi: CONTRACT_ABIS.ORGANIZATION,
                functionName: 'updateExtendedMetadata',
                args: [metadata || '', metadataURI || ''],
                account
            });

            yield { status: 'pending', message: `Transaction sent: ${hash}. Waiting...` };

            const client = createPublicClient({
                chain: gnosis,
                transport: http('https://rpc.gnosischain.com')
            });

            const receipt = await client.waitForTransactionReceipt({ hash });

            yield {
                status: 'success',
                message: `✅ Extended metadata updated!`,
                data: {
                    transactionHash: hash,
                    blockNumber: Number(receipt.blockNumber),
                    explorerUrl: `https://gnosisscan.io/tx/${hash}`
                }
            };
        } catch (error) {
            yield { status: 'error', message: `Failed to update metadata: ${error.message}` };
        }
    }

    /**
     * Update extended metadata on a ProposalMetadata contract
     */
    async* updateProposalExtendedMetadata(args, { publicClient }) {
        const { proposalMetadataAddress, metadata, metadataURI } = args;

        if (!proposalMetadataAddress) {
            yield { status: 'error', message: 'proposalMetadataAddress is required' };
            return;
        }

        let privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
            yield { status: 'error', message: 'PRIVATE_KEY not found in .env file' };
            return;
        }
        privateKey = privateKey.trim();
        if (!privateKey.startsWith('0x')) privateKey = '0x' + privateKey;

        yield { status: 'pending', message: `Updating extended metadata on proposal...` };

        try {
            const { createWalletClient, http } = await import('viem');
            const { privateKeyToAccount } = await import('viem/accounts');

            const account = privateKeyToAccount(privateKey);
            const walletClient = createWalletClient({
                account,
                chain: gnosis,
                transport: http('https://rpc.gnosischain.com')
            });

            const hash = await walletClient.writeContract({
                address: proposalMetadataAddress,
                abi: CONTRACT_ABIS.PROPOSAL,
                functionName: 'updateExtendedMetadata',
                args: [metadata || '', metadataURI || ''],
                account
            });

            yield { status: 'pending', message: `Transaction sent: ${hash}. Waiting...` };

            const client = createPublicClient({
                chain: gnosis,
                transport: http('https://rpc.gnosischain.com')
            });

            const receipt = await client.waitForTransactionReceipt({ hash });

            yield {
                status: 'success',
                message: `✅ Extended metadata updated!`,
                data: {
                    transactionHash: hash,
                    blockNumber: Number(receipt.blockNumber),
                    explorerUrl: `https://gnosisscan.io/tx/${hash}`
                }
            };
        } catch (error) {
            yield { status: 'error', message: `Failed to update metadata: ${error.message}` };
        }
    }
    // =========================================================================
    // POOL CREATION
    // =========================================================================

    /**
     * Create a missing pool for a proposal
     * Ports the logic from frontend useCreatePool.js hook
     * 
     * @param {Object} args
     * @param {string} args.proposalAddress - Trading contract address
     * @param {string} args.poolType - CONDITIONAL_YES, CONDITIONAL_NO, PREDICTION_YES, PREDICTION_NO, EXPECTED_VALUE_YES, EXPECTED_VALUE_NO
     * @param {number} args.initialPrice - Price as token1/token0 (e.g., spot GNO price ~120)
     * @param {number} [args.chainId=100] - Chain ID (100 for Gnosis/Algebra, 1 for Ethereum/Uniswap)
     * @param {number} [args.feeTier=3000] - Fee tier for Uniswap V3 (ignored for Algebra)
     */
    async* createPool(args, { publicClient }) {
        const {
            proposalAddress,
            poolType,
            initialPrice,
            chainId = 100,
            feeTier = 3000
        } = args;

        // Validation
        if (!proposalAddress || !/^0x[a-fA-F0-9]{40}$/.test(proposalAddress)) {
            yield { status: 'error', message: 'Invalid proposal address' };
            return;
        }
        if (!poolType) {
            yield { status: 'error', message: 'poolType is required. Options: CONDITIONAL_YES, CONDITIONAL_NO, PREDICTION_YES, PREDICTION_NO, EXPECTED_VALUE_YES, EXPECTED_VALUE_NO' };
            return;
        }
        if (!initialPrice || initialPrice <= 0) {
            yield { status: 'error', message: 'initialPrice must be a positive number (e.g., 120 for GNO spot price)' };
            return;
        }

        const chainConfig = CHAIN_CONFIG[chainId];
        if (!chainConfig) {
            yield { status: 'error', message: `Unsupported chain: ${chainId}` };
            return;
        }
        if (!chainConfig.positionManager) {
            yield { status: 'error', message: `No position manager configured for chain ${chainId}` };
            return;
        }

        // 1. Fetch proposal details to get token addresses
        yield { status: 'pending', message: `Fetching proposal token addresses...` };

        let proposalDetails = null;
        try {
            for await (const update of this.getProposalDetails({ proposalAddress, chainId }, { publicClient })) {
                if (update.status === 'success') {
                    proposalDetails = update.data;
                }
            }
        } catch (e) {
            yield { status: 'error', message: `Failed to fetch proposal details: ${e.message}` };
            return;
        }

        if (!proposalDetails) {
            yield { status: 'error', message: 'Could not fetch proposal details' };
            return;
        }

        // 2. Determine token pair based on pool type
        const { outcomeTokens, baseTokens } = proposalDetails;
        let token0, token1, token0Symbol, token1Symbol;

        switch (poolType) {
            case 'CONDITIONAL_YES':
                token0 = outcomeTokens?.YES_COMPANY?.address;
                token1 = outcomeTokens?.YES_CURRENCY?.address;
                token0Symbol = outcomeTokens?.YES_COMPANY?.symbol || 'YES_Company';
                token1Symbol = outcomeTokens?.YES_CURRENCY?.symbol || 'YES_Currency';
                break;
            case 'CONDITIONAL_NO':
                token0 = outcomeTokens?.NO_COMPANY?.address;
                token1 = outcomeTokens?.NO_CURRENCY?.address;
                token0Symbol = outcomeTokens?.NO_COMPANY?.symbol || 'NO_Company';
                token1Symbol = outcomeTokens?.NO_CURRENCY?.symbol || 'NO_Currency';
                break;
            case 'PREDICTION_YES':
                token0 = outcomeTokens?.YES_CURRENCY?.address;
                token1 = baseTokens?.currency?.address;
                token0Symbol = outcomeTokens?.YES_CURRENCY?.symbol || 'YES_Currency';
                token1Symbol = baseTokens?.currency?.symbol || 'Currency';
                break;
            case 'PREDICTION_NO':
                token0 = outcomeTokens?.NO_CURRENCY?.address;
                token1 = baseTokens?.currency?.address;
                token0Symbol = outcomeTokens?.NO_CURRENCY?.symbol || 'NO_Currency';
                token1Symbol = baseTokens?.currency?.symbol || 'Currency';
                break;
            case 'EXPECTED_VALUE_YES':
                token0 = outcomeTokens?.YES_COMPANY?.address;
                token1 = baseTokens?.currency?.address;
                token0Symbol = outcomeTokens?.YES_COMPANY?.symbol || 'YES_Company';
                token1Symbol = baseTokens?.currency?.symbol || 'Currency';
                break;
            case 'EXPECTED_VALUE_NO':
                token0 = outcomeTokens?.NO_COMPANY?.address;
                token1 = baseTokens?.currency?.address;
                token0Symbol = outcomeTokens?.NO_COMPANY?.symbol || 'NO_Company';
                token1Symbol = baseTokens?.currency?.symbol || 'Currency';
                break;
            default:
                yield { status: 'error', message: `Unknown pool type: ${poolType}. Options: CONDITIONAL_YES, CONDITIONAL_NO, PREDICTION_YES, PREDICTION_NO, EXPECTED_VALUE_YES, EXPECTED_VALUE_NO` };
                return;
        }

        if (!token0 || !token1) {
            yield { status: 'error', message: `Missing token addresses for ${poolType}. token0: ${token0}, token1: ${token1}` };
            return;
        }

        yield { status: 'pending', message: `Pool type: ${poolType} — ${token0Symbol} / ${token1Symbol}` };

        // 3. AMM Token Ordering (lower address = token0)
        const t0Lower = token0.toLowerCase();
        const t1Lower = token1.toLowerCase();
        const needsReorder = t0Lower > t1Lower;
        const ammToken0 = needsReorder ? token1 : token0;
        const ammToken1 = needsReorder ? token0 : token1;

        // 4. Calculate sqrtPriceX96 (adjust for token reorder)
        const ammPrice = needsReorder ? (1 / initialPrice) : initialPrice;
        const sqrtPrice = Math.sqrt(ammPrice);
        const Q96 = 2n ** 96n;
        const sqrtPriceX96 = BigInt(Math.floor(sqrtPrice * Number(Q96)));

        console.log('[createPool] Config:', {
            poolType,
            ammToken0: ammToken0.slice(0, 10) + '...',
            ammToken1: ammToken1.slice(0, 10) + '...',
            logicalPrice: initialPrice,
            ammPrice,
            sqrtPriceX96: sqrtPriceX96.toString(),
            needsReorder,
            amm: chainConfig.amm,
            positionManager: chainConfig.positionManager
        });

        // 5. Setup wallet
        let privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
            yield { status: 'error', message: 'PRIVATE_KEY not found in .env file' };
            return;
        }
        privateKey = privateKey.trim();
        if (!privateKey.startsWith('0x')) privateKey = '0x' + privateKey;

        yield { status: 'pending', message: `Setting up wallet for ${chainConfig.name} (${chainConfig.amm})...` };

        let chainWalletClient, chainAccount;
        try {
            const { createWalletClient, http } = await import('viem');
            const { privateKeyToAccount } = await import('viem/accounts');
            const chain = chainId === 1 ? mainnet : gnosis;

            chainAccount = privateKeyToAccount(privateKey);
            chainWalletClient = createWalletClient({
                account: chainAccount,
                chain,
                transport: http(chainConfig.rpcUrl)
            });
        } catch (e) {
            yield { status: 'error', message: `Failed to create wallet: ${e.message}` };
            return;
        }

        // 6. Call createAndInitializePoolIfNecessary
        yield { status: 'pending', message: `Creating ${poolType} pool on ${chainConfig.name} (${chainConfig.amm})...` };

        try {
            let hash;
            if (chainConfig.amm === 'uniswap') {
                // Uniswap V3: with fee tier
                const fee = feeTier || chainConfig.defaultFeeTier || 3000;
                hash = await chainWalletClient.writeContract({
                    address: chainConfig.positionManager,
                    abi: CONTRACT_ABIS.UNISWAP_V3_NFPM,
                    functionName: 'createAndInitializePoolIfNecessary',
                    args: [ammToken0, ammToken1, fee, sqrtPriceX96],
                    account: chainAccount,
                    gas: 5000000n
                });
            } else {
                // Algebra (Swapr): no fee tier
                hash = await chainWalletClient.writeContract({
                    address: chainConfig.positionManager,
                    abi: CONTRACT_ABIS.ALGEBRA_NFPM,
                    functionName: 'createAndInitializePoolIfNecessary',
                    args: [ammToken0, ammToken1, sqrtPriceX96],
                    account: chainAccount,
                    gas: 16000000n // Algebra needs higher gas
                });
            }

            yield { status: 'pending', message: `Transaction sent: ${hash}. Waiting for confirmation...`, data: { hash } };

            // Wait for confirmation
            const chain = chainId === 1 ? mainnet : gnosis;
            const chainClient = createPublicClient({
                chain,
                transport: http(chainConfig.rpcUrl)
            });

            const receipt = await chainClient.waitForTransactionReceipt({ hash });

            // 7. Extract pool address from Initialize(uint160,int24) event
            let poolAddress = null;
            // keccak256('Initialize(uint160,int24)') = 0x98636036cb66a9c19a37435efc1e90142190214e8abeb821bdba3f2990dd4c95
            const INITIALIZE_TOPIC = '0x98636036cb66a9c19a37435efc1e90142190214e8abeb821bdba3f2990dd4c95';
            for (const log of (receipt.logs || [])) {
                if (log.topics && log.topics[0] === INITIALIZE_TOPIC && log.address) {
                    poolAddress = log.address;
                    break;
                }
            }

            yield {
                status: 'success',
                message: `✅ Pool created successfully!${poolAddress ? ` Address: ${poolAddress}` : ''}`,
                data: {
                    transactionHash: hash,
                    poolAddress,
                    poolType,
                    token0: ammToken0,
                    token1: ammToken1,
                    initialPrice,
                    blockNumber: Number(receipt.blockNumber),
                    chain: chainConfig.name,
                    amm: chainConfig.amm,
                    explorerUrl: `${chainConfig.explorerUrl}/tx/${hash}`
                }
            };
        } catch (error) {
            yield { status: 'error', message: `Pool creation failed: ${error.message}` };
        }
    }
}


