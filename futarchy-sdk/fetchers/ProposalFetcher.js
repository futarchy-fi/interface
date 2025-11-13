// fetchers/ProposalFetcher.js - Fetcher for Futarchy Proposal data from blockchain

import { BaseFetcher } from '../DataLayer.js';
import { createPublicClient, http } from 'viem';
import { gnosis, polygon, mainnet } from 'viem/chains';

// FutarchyProposal ABI
const FUTARCHY_PROPOSAL_ABI = [
    {"inputs":[],"name":"collateralToken1","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"collateralToken2","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"conditionId","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"encodedQuestion","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"marketName","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"numOutcomes","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"outcomes","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"parentCollectionId","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"parentMarket","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"parentOutcome","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"questionId","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"realityProxy","outputs":[{"internalType":"contract FutarchyRealityProxy","name":"","type":"address"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"index","type":"uint256"}],"name":"wrappedOutcome","outputs":[{"internalType":"contract IERC20","name":"wrapped1155","type":"address"},{"internalType":"bytes","name":"data","type":"bytes"}],"stateMutability":"view","type":"function"}
];

// ERC20 ABI for token symbols
const ERC20_ABI = [
    {"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"}
];

// Reality Proxy ABI
const REALITY_PROXY_ABI = [
    {"inputs":[],"name":"realitio","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}
];

// Realitio ABI for question details
const REALITIO_ABI = [
    {"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"getOpeningTS","outputs":[{"internalType":"uint32","name":"","type":"uint32"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"}],"name":"isFinalized","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"}],"name":"isPendingArbitration","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"}],"name":"resultFor","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"}],"name":"getFinalAnswer","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"questions","outputs":[{"internalType":"bytes32","name":"content_hash","type":"bytes32"},{"internalType":"address","name":"arbitrator","type":"address"},{"internalType":"uint32","name":"opening_ts","type":"uint32"},{"internalType":"uint32","name":"timeout","type":"uint32"},{"internalType":"uint32","name":"finalize_ts","type":"uint32"},{"internalType":"bool","name":"is_pending_arbitration","type":"bool"},{"internalType":"uint256","name":"bounty","type":"uint256"},{"internalType":"bytes32","name":"best_answer","type":"bytes32"},{"internalType":"bytes32","name":"history_hash","type":"bytes32"},{"internalType":"uint256","name":"bond","type":"uint256"},{"internalType":"uint256","name":"min_bond","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"}],"name":"getBestAnswer","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"}
];

// =============================================================================
// PROPOSAL FETCHER - Fetches Futarchy Proposal data from blockchain
// =============================================================================

class ProposalFetcher extends BaseFetcher {
    constructor(options = {}) {
        super();
        this.name = 'ProposalFetcher';
        // Options can include { publicClient, rpcUrl, chainId }
        if (options && options.publicClient) {
            this.publicClient = options.publicClient;
        } else {
            const rpcUrl = options.rpcUrl || 'https://rpc.gnosischain.com';
            const chainId = options.chainId || 100;
            const chain = chainId === 137 ? polygon : (chainId === 1 ? mainnet : gnosis);
            this.publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
        }
        
        // Register operations this fetcher supports
        this.registerOperation('proposal.info', this.fetchProposalInfo.bind(this));
        this.registerOperation('proposal.details', this.fetchProposalDetails.bind(this));
        this.registerOperation('proposal.tokens', this.fetchProposalTokens.bind(this));
        this.registerOperation('proposal.outcomes', this.fetchProposalOutcomes.bind(this));
        this.registerOperation('proposal.wrapped', this.fetchWrappedOutcomes.bind(this));
        this.registerOperation('proposal.realitio', this.fetchRealitioStatus.bind(this));
        this.registerOperation('proposal.status', this.fetchProposalStatus.bind(this));
        
        console.log(`🔧 ${this.name} initialized with ${this.supportedOperations.length} operations`);
    }
    
    async fetch(dataPath, args = {}) {
        console.log(`📡 ${this.name} handling '${dataPath}' with args:`, args);
        
        if (dataPath in this.operations) {
            return await this.operations[dataPath](args);
        } else {
            return { 
                status: "error", 
                reason: `Operation '${dataPath}' not supported by ${this.name}`,
                supportedOperations: this.supportedOperations
            };
        }
    }
    
    // Fetch basic proposal information
    async fetchProposalInfo(args) {
        const { proposalAddress } = args;
        
        if (!proposalAddress) {
            return {
                status: "error",
                reason: "proposalAddress is required",
                source: this.name
            };
        }
        
        console.log(`🔍 Fetching proposal info for ${proposalAddress}`);
        
        try {
            // Fetch multiple values in parallel
            const [marketName, encodedQuestion, conditionId, questionId] = await Promise.all([
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: FUTARCHY_PROPOSAL_ABI,
                    functionName: 'marketName'
                }),
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: FUTARCHY_PROPOSAL_ABI,
                    functionName: 'encodedQuestion'
                }),
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: FUTARCHY_PROPOSAL_ABI,
                    functionName: 'conditionId'
                }),
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: FUTARCHY_PROPOSAL_ABI,
                    functionName: 'questionId'
                })
            ]);
            
            return {
                status: "success",
                data: {
                    proposalAddress,
                    marketName,
                    encodedQuestion,
                    conditionId,
                    questionId
                },
                source: this.name
            };
        } catch (error) {
            return {
                status: "error",
                reason: error.message,
                source: this.name
            };
        }
    }
    
    // Fetch detailed proposal information including tokens
    async fetchProposalDetails(args) {
        const { proposalAddress } = args;
        
        if (!proposalAddress) {
            return {
                status: "error",
                reason: "proposalAddress is required",
                source: this.name
            };
        }
        
        console.log(`🔍 Fetching detailed proposal data for ${proposalAddress}`);
        
        try {
            const [
                marketName,
                encodedQuestion,
                conditionId,
                questionId,
                collateralToken1,
                collateralToken2,
                numOutcomes,
                parentMarket,
                parentOutcome,
                parentCollectionId,
                realityProxy
            ] = await Promise.all([
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: FUTARCHY_PROPOSAL_ABI,
                    functionName: 'marketName'
                }),
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: FUTARCHY_PROPOSAL_ABI,
                    functionName: 'encodedQuestion'
                }),
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: FUTARCHY_PROPOSAL_ABI,
                    functionName: 'conditionId'
                }),
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: FUTARCHY_PROPOSAL_ABI,
                    functionName: 'questionId'
                }),
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: FUTARCHY_PROPOSAL_ABI,
                    functionName: 'collateralToken1'
                }),
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: FUTARCHY_PROPOSAL_ABI,
                    functionName: 'collateralToken2'
                }),
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: FUTARCHY_PROPOSAL_ABI,
                    functionName: 'numOutcomes'
                }),
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: FUTARCHY_PROPOSAL_ABI,
                    functionName: 'parentMarket'
                }),
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: FUTARCHY_PROPOSAL_ABI,
                    functionName: 'parentOutcome'
                }),
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: FUTARCHY_PROPOSAL_ABI,
                    functionName: 'parentCollectionId'
                }),
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: FUTARCHY_PROPOSAL_ABI,
                    functionName: 'realityProxy'
                })
            ]);
            
            return {
                status: "success",
                data: {
                    proposalAddress,
                    marketName,
                    encodedQuestion,
                    conditionId,
                    questionId,
                    collateralToken1,
                    collateralToken2,
                    numOutcomes: Number(numOutcomes),
                    parentMarket,
                    parentOutcome: Number(parentOutcome),
                    parentCollectionId,
                    realityProxy
                },
                source: this.name
            };
        } catch (error) {
            return {
                status: "error",
                reason: error.message,
                source: this.name
            };
        }
    }
    
    // Fetch token information (symbols and names)
    async fetchProposalTokens(args) {
        const { proposalAddress } = args;
        
        if (!proposalAddress) {
            return {
                status: "error",
                reason: "proposalAddress is required",
                source: this.name
            };
        }
        
        console.log(`🔍 Fetching token information for proposal ${proposalAddress}`);
        
        try {
            // Get token addresses
            const [collateralToken1, collateralToken2] = await Promise.all([
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: FUTARCHY_PROPOSAL_ABI,
                    functionName: 'collateralToken1'
                }),
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: FUTARCHY_PROPOSAL_ABI,
                    functionName: 'collateralToken2'
                })
            ]);
            
            // Get token symbols
            const [token1Symbol, token2Symbol] = await Promise.all([
                this.publicClient.readContract({
                    address: collateralToken1,
                    abi: ERC20_ABI,
                    functionName: 'symbol'
                }).catch(() => 'COMPANY'),
                this.publicClient.readContract({
                    address: collateralToken2,
                    abi: ERC20_ABI,
                    functionName: 'symbol'
                }).catch(() => 'CURRENCY')
            ]);
            
            return {
                status: "success",
                data: {
                    proposalAddress,
                    companyToken: {
                        address: collateralToken1,
                        symbol: token1Symbol
                    },
                    currencyToken: {
                        address: collateralToken2,
                        symbol: token2Symbol
                    }
                },
                source: this.name
            };
        } catch (error) {
            return {
                status: "error",
                reason: error.message,
                source: this.name
            };
        }
    }
    
    // Fetch outcome strings (YES/NO)
    async fetchProposalOutcomes(args) {
        const { proposalAddress } = args;
        
        if (!proposalAddress) {
            return {
                status: "error",
                reason: "proposalAddress is required",
                source: this.name
            };
        }
        
        console.log(`🔍 Fetching outcomes for proposal ${proposalAddress}`);
        
        try {
            const numOutcomes = await this.publicClient.readContract({
                address: proposalAddress,
                abi: FUTARCHY_PROPOSAL_ABI,
                functionName: 'numOutcomes'
            });
            
            const outcomes = [];
            for (let i = 0; i < Number(numOutcomes); i++) {
                const outcome = await this.publicClient.readContract({
                    address: proposalAddress,
                    abi: FUTARCHY_PROPOSAL_ABI,
                    functionName: 'outcomes',
                    args: [i]
                });
                outcomes.push(outcome);
            }
            
            return {
                status: "success",
                data: {
                    proposalAddress,
                    numOutcomes: Number(numOutcomes),
                    outcomes // Should be ["YES", "NO"]
                },
                source: this.name
            };
        } catch (error) {
            return {
                status: "error",
                reason: error.message,
                source: this.name
            };
        }
    }
    
    // Fetch wrapped outcomes (4 tokens: YES_COMPANY, NO_COMPANY, YES_CURRENCY, NO_CURRENCY)
    async fetchWrappedOutcomes(args) {
        const { proposalAddress } = args;
        
        if (!proposalAddress) {
            return {
                status: "error",
                reason: "proposalAddress is required",
                source: this.name
            };
        }
        
        console.log(`🔍 Fetching wrapped outcomes for proposal ${proposalAddress}`);
        
        try {
            const wrappedOutcomes = [];
            const outcomeLabels = ['YES_COMPANY', 'NO_COMPANY', 'YES_CURRENCY', 'NO_CURRENCY'];
            
            for (let i = 0; i < 4; i++) {
                try {
                    const [wrapped1155, data] = await this.publicClient.readContract({
                        address: proposalAddress,
                        abi: FUTARCHY_PROPOSAL_ABI,
                        functionName: 'wrappedOutcome',
                        args: [i]
                    });
                    
                    wrappedOutcomes.push({
                        index: i,
                        label: outcomeLabels[i],
                        wrapped1155,
                        data
                    });
                } catch (err) {
                    console.log(`Could not fetch wrapped outcome ${i}`);
                }
            }
            
            return {
                status: "success",
                data: {
                    proposalAddress,
                    wrappedOutcomes
                },
                source: this.name
            };
        } catch (error) {
            return {
                status: "error",
                reason: error.message,
                source: this.name
            };
        }
    }
    
    // Fetch Realitio question status and details
    async fetchRealitioStatus(args) {
        const { proposalAddress } = args;
        
        if (!proposalAddress) {
            return {
                status: "error",
                reason: "proposalAddress is required",
                source: this.name
            };
        }
        
        console.log(`🔍 Fetching Realitio status for proposal ${proposalAddress}`);
        
        try {
            // Get questionId and realityProxy from proposal
            const [questionId, realityProxyAddress] = await Promise.all([
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: FUTARCHY_PROPOSAL_ABI,
                    functionName: 'questionId'
                }),
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: FUTARCHY_PROPOSAL_ABI,
                    functionName: 'realityProxy'
                })
            ]);
            
            // Get realitio address from proxy
            const realitioAddress = await this.publicClient.readContract({
                address: realityProxyAddress,
                abi: REALITY_PROXY_ABI,
                functionName: 'realitio'
            });
            
            // Get question details from Realitio
            const questionDetails = await this.publicClient.readContract({
                address: realitioAddress,
                abi: REALITIO_ABI,
                functionName: 'questions',
                args: [questionId]
            });
            
            const [
                content_hash,
                arbitrator,
                opening_ts,
                timeout,
                finalize_ts,
                is_pending_arbitration,
                bounty,
                best_answer,
                history_hash,
                bond,
                min_bond
            ] = questionDetails;
            
            // Get finalization status first
            const isFinalized = await this.publicClient.readContract({
                address: realitioAddress,
                abi: REALITIO_ABI,
                functionName: 'isFinalized',
                args: [questionId]
            });
            
            // Only get resultFor if finalized (otherwise it reverts)
            let resultFor = null;
            if (isFinalized) {
                try {
                    resultFor = await this.publicClient.readContract({
                        address: realitioAddress,
                        abi: REALITIO_ABI,
                        functionName: 'resultFor',
                        args: [questionId]
                    });
                } catch (err) {
                    console.log('Could not get resultFor:', err.message);
                }
            }
            
            // Get final answer if finalized
            let finalAnswer = null;
            if (isFinalized) {
                finalAnswer = await this.publicClient.readContract({
                    address: realitioAddress,
                    abi: REALITIO_ABI,
                    functionName: 'getFinalAnswer',
                    args: [questionId]
                });
            }
            
            return {
                status: "success",
                data: {
                    proposalAddress,
                    questionId,
                    realityProxyAddress,
                    realitioAddress,
                    contentHash: content_hash,
                    arbitrator,
                    openingTime: Number(opening_ts),
                    timeout: Number(timeout),
                    finalizeTime: Number(finalize_ts),
                    isPendingArbitration: is_pending_arbitration,
                    bounty: bounty.toString(),
                    bestAnswer: best_answer,
                    historyHash: history_hash,
                    bond: bond.toString(),
                    minBond: min_bond.toString(),
                    isFinalized,
                    resultFor,
                    finalAnswer
                },
                source: this.name
            };
        } catch (error) {
            return {
                status: "error",
                reason: error.message,
                source: this.name
            };
        }
    }
    
    // Fetch comprehensive proposal status (combines multiple data sources)
    async fetchProposalStatus(args) {
        const { proposalAddress } = args;
        
        if (!proposalAddress) {
            return {
                status: "error",
                reason: "proposalAddress is required",
                source: this.name
            };
        }
        
        console.log(`🔍 Fetching comprehensive status for proposal ${proposalAddress}`);
        
        try {
            // Fetch all relevant data
            const [basicInfo, realitioStatus, outcomes] = await Promise.all([
                this.fetchProposalInfo({ proposalAddress }),
                this.fetchRealitioStatus({ proposalAddress }),
                this.fetchProposalOutcomes({ proposalAddress })
            ]);
            
            if (basicInfo.status !== 'success' || realitioStatus.status !== 'success') {
                return {
                    status: "error",
                    reason: "Failed to fetch complete status",
                    source: this.name
                };
            }
            
            const realitio = realitioStatus.data;
            const info = basicInfo.data;
            const outcomeData = outcomes.status === 'success' ? outcomes.data : null;
            
            // Interpret the answer
            let interpretedAnswer = null;
            let answerIndex = null;
            
            if (realitio.isFinalized && realitio.finalAnswer) {
                answerIndex = parseInt(realitio.finalAnswer);
                if (outcomeData && answerIndex < outcomeData.outcomes.length) {
                    // Remove token suffix (e.g., "Yes-GNO" -> "Yes", "No-sDAI" -> "No")
                    const rawAnswer = outcomeData.outcomes[answerIndex];
                    interpretedAnswer = rawAnswer.includes('-') ? rawAnswer.split('-')[0] : rawAnswer;
                }
            } else if (realitio.bestAnswer && realitio.bestAnswer !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                answerIndex = parseInt(realitio.bestAnswer);
                if (outcomeData && answerIndex < outcomeData.outcomes.length) {
                    // Remove token suffix (e.g., "Yes-GNO" -> "Yes", "No-sDAI" -> "No")
                    const rawAnswer = outcomeData.outcomes[answerIndex];
                    interpretedAnswer = rawAnswer.includes('-') ? rawAnswer.split('-')[0] : rawAnswer;
                }
            }
            
            // Determine overall status
            let overallStatus = 'UNKNOWN';
            if (realitio.isPendingArbitration) {
                overallStatus = 'PENDING_ARBITRATION';
            } else if (realitio.isFinalized) {
                overallStatus = 'FINALIZED';
            } else if (realitio.openingTime > 0) {
                const now = Math.floor(Date.now() / 1000);
                if (now < realitio.openingTime) {
                    overallStatus = 'NOT_OPENED';
                } else {
                    overallStatus = 'OPEN_FOR_ANSWERS';
                }
            }
            
            return {
                status: "success",
                data: {
                    proposalAddress,
                    marketName: info.marketName,
                    question: info.encodedQuestion,
                    status: overallStatus,
                    isFinalized: realitio.isFinalized,
                    isPendingArbitration: realitio.isPendingArbitration,
                    openingTime: new Date(realitio.openingTime * 1000).toISOString(),
                    finalizeTime: realitio.finalizeTime > 0 ? new Date(realitio.finalizeTime * 1000).toISOString() : null,
                    timeout: `${realitio.timeout} seconds`,
                    currentAnswer: interpretedAnswer,
                    answerIndex,
                    bounty: realitio.bounty,
                    bond: realitio.bond,
                    minBond: realitio.minBond,
                    outcomes: outcomeData?.outcomes || []
                },
                source: this.name
            };
        } catch (error) {
            return {
                status: "error",
                reason: error.message,
                source: this.name
            };
        }
    }
}

// Factory function for easy instantiation
export function createProposalFetcher(options) {
    return new ProposalFetcher(options);
}

export { ProposalFetcher, FUTARCHY_PROPOSAL_ABI };
