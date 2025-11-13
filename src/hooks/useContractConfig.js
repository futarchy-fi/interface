import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { PRECISION_CONFIG } from '../components/futarchyFi/marketPage/constants/contracts';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nvhqdqtlsdboctqjcelq.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Hook to fetch and manage contract configuration data from Supabase
 * @param {string} proposalId - The proposal ID to fetch configuration for
 * @param {boolean} forceTestPools - Force use of test pool addresses (default: false)
 * @returns {Object} - Contains loading state, error state, and contract configuration data
 */
export const useContractConfig = (proposalId, forceTestPools = false) => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchContractConfig = async () => {
      try {
        // Get proposal ID from URL parameters using native browser API
        let extractedProposalId = proposalId;
        
        // Try to get proposalId from URL search parameters
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          const proposalFromUrl = urlParams.get('proposalId');
          console.log('📊 Full URL:', window.location.href);
          console.log('📊 Window location search:', window.location.search);
          console.log('📊 URL search params:', Object.fromEntries(urlParams.entries()));
          console.log('📊 proposalFromUrl:', proposalFromUrl);
          console.log('📊 proposalId param:', proposalId);
          
          if (proposalFromUrl) {
            extractedProposalId = proposalFromUrl;
            console.log('📊 Using proposalId from URL:', extractedProposalId);
          } else if (proposalId) {
            console.log('📊 Using proposalId from parameter:', extractedProposalId);
          } else {
            console.log('📊 No proposalId found in URL or parameters');
          }
        } else {
          console.log('📊 Server-side rendering - using passed proposalId:', proposalId);
        }

        // If no proposal ID found, return null config (graceful handling for non-proposal pages)
        if (!extractedProposalId) {
          console.log('📊 No proposal ID found in parameters or URL - returning null config');
          console.log('📊 Debug - URL:', typeof window !== 'undefined' ? window.location.href : 'N/A');
          console.log('📊 Debug - Search params:', typeof window !== 'undefined' ? window.location.search : 'N/A');
          setConfig(null);
          setLoading(false);
          setError(null);
          return;
        }
        
        console.log('📊 Fetching contract config for proposal ID:', extractedProposalId);
        
        setLoading(true);
        
        // Query Supabase directly for the specific proposal
        const { data, error } = await supabase
          .from('market_event')
          .select('*')
          .eq('id', extractedProposalId)
          .single();
        
        if (error) {
          console.error('Error fetching market event:', error);
          throw error;
        }
        
        if (!data) {
          throw new Error(`Proposal ${extractedProposalId} not found in market events`);
        }
        
        console.log('Market event fetched successfully:', data);
        
        // Parse metadata if it's a string, handle null case
        const metadata = data.metadata 
          ? (typeof data.metadata === 'string' ? JSON.parse(data.metadata) : data.metadata)
          : null;
        
        // Check if we have the required metadata
        if (!metadata || !metadata?.contractInfos || !metadata?.currencyTokens || !metadata?.companyTokens) {
          throw new Error(`Proposal ${extractedProposalId} does not have complete metadata configuration`);
        }

        console.log('metadata', metadata);

        // Test pool addresses for override
        const TEST_POOLS = {
          yes: '0x44fEA76b9F876d85C117e96f6a0323517210CA25',
          no: '0x8a896a495690Abf9C8394b18780a821699f5f52c',
          base: '0x31227b50eCCDC9C589826AA2D9E7C5619B1895Da'
        };

        // Proposal-specific base pool overrides (highest priority)
        const PROPOSAL_BASE_POOL_OVERRIDES = {
          '0x1F54f0312E85c5AFACe2bDF15AA2514BeFDB844F': '0x2A4b52B47625431Fdc6fE58CeD3086E76c1f6bbf'
        };

        if (forceTestPools) {
          console.log('🔧 FORCING TEST POOLS:', TEST_POOLS);
        }

        // Check for proposal-specific base pool override
        const proposalSpecificBasePool = PROPOSAL_BASE_POOL_OVERRIDES[extractedProposalId];
        if (proposalSpecificBasePool) {
          console.log('🎯 Using proposal-specific base pool override:', proposalSpecificBasePool, 'for proposal:', extractedProposalId);
        }

        // Transform API data into the format needed by the application
        const transformedConfig = {
          // Proposal/Market identification (these are the same thing)
          proposalId: extractedProposalId,
          MARKET_ADDRESS: extractedProposalId,
          
          // Chain info
          chainId: metadata.chain || 100,
          
          // Contract addresses
          CONDITIONAL_TOKENS_ADDRESS: metadata?.contractInfos?.conditionalTokens || '0xCeAfDD6bc0bEF976fdCd1112955828E00543c0Ce',
          WRAPPER_SERVICE_ADDRESS: metadata?.contractInfos?.wrapperService || '0xc14f5d2B9d6945EF1BA93f8dB20294b90FA5b5b1',
          
          // Router addresses from contractInfos
          FUTARCHY_ROUTER_ADDRESS: metadata?.contractInfos?.futarchy?.router || '0x7495a583ba85875d59407781b4958ED6e0E1228f',
          SUSHISWAP_V2_ROUTER: metadata?.contractInfos?.sushiswap?.routerV2 || '0xf2614A233c7C3e7f08b1F887Ba133a13f1eb2c55',
          SUSHISWAP_V3_ROUTER: metadata.contractInfos?.sushiswap?.routerV3 || '0x592abc3734cd0d458e6e44a2db2992a3d00283a4',
          SUSHISWAP_FACTORY: metadata?.contractInfos?.sushiswap?.factory || '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
          
          // Base token configurations
          BASE_TOKENS_CONFIG: {
            currency: {
              address: metadata.currencyTokens?.base?.wrappedCollateralTokenAddress || '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
              symbol: metadata.currencyTokens?.base?.tokenSymbol || 'sDAI',
              name: metadata.currencyTokens?.base?.tokenName || 'sDAI',
              decimals: 18
            },
            company: {
              address: metadata.companyTokens?.base?.wrappedCollateralTokenAddress || '0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb',
              symbol: metadata.companyTokens?.base?.tokenSymbol || 'GNO',
              name: metadata.companyTokens?.base?.tokenName || 'Gnosis',
              decimals: 18
            }
          },
          
          // Pool configurations - use conditional pools metadata (more consistent for price fetching)
          POOL_CONFIG_YES: {
            address: forceTestPools ? TEST_POOLS.yes : (metadata.conditional_pools?.yes?.address || data.pool_yes || '0xF336F812Db1ad142F22A9A4dd43D40e64B478361'),
            tokenCompanySlot: metadata.conditional_pools?.yes?.tokenCompanySlot ?? 1,
          },

          POOL_CONFIG_NO: {
            address: forceTestPools ? TEST_POOLS.no : (metadata.conditional_pools?.no?.address || data.pool_no || '0xfbf1BE5CE2f9056dAaB1C368EC241ad7Be3507A8'),
            tokenCompanySlot: metadata.conditional_pools?.no?.tokenCompanySlot ?? 0,
          },
          
          // Prediction pools configuration
          PREDICTION_POOLS: metadata.prediction_pools ? {
            yes: {
              address: metadata.prediction_pools.yes.address,
              tokenBaseSlot: metadata.prediction_pools.yes.tokenBaseSlot ?? metadata.prediction_pools.yes.token_slot ?? 0  // Use tokenBaseSlot or token_slot from API, default to 0
            },
            no: {
              address: metadata.prediction_pools.no.address,
              tokenBaseSlot: metadata.prediction_pools.no.tokenBaseSlot ?? metadata.prediction_pools.no.token_slot ?? 0   // Use tokenBaseSlot or token_slot from API, default to 0
            }
          } : {
            yes: {
              address: "0x19109DB1e35a9Ba50807aedDa244dCfFc634EF6F",
              tokenBaseSlot: 0  // Default to 0 (no inversion)
            },
            no: {
              address: "0xb0F38743e0d55D60d5F84112eDFb15d985a4415e",
              tokenBaseSlot: 0  // Default to 0 (no inversion)
            }
          },
          
          // Base pool configuration (spot price reference)
          BASE_POOL_CONFIG: proposalSpecificBasePool ? {
            // Highest priority: Proposal-specific base pool override
            address: "0xabc6625d494568349704cae6ba77bbec96470683b4d0384e83823d59f2240ea9",
            type: metadata.base_pool.type || 'DXswapPair',
            companyName: 'TSLAon',
            currencyName: 'USDS',
            currencySlot: 0
          } : (metadata.chain === 1) ? {
            // Always use this address for Ethereum mainnet (chain 1)
            address: "0x31227b50eCCDC9C589826AA2D9E7C5619B1895Da",
            type: 'DXswapPair',
            companyName: 'TSLAon',
            currencyName: 'USDS', // USDS on mainnet
            currencySlot: 0
          } : forceTestPools ? {
            // Force test base pool (for non-mainnet chains)
            address: TEST_POOLS.base,
            type: 'DXswapPair',
            companyName: 'GNO',
            currencyName: 'SDAI',
            currencySlot: 0
          } : metadata.base_pool ? {
            address: metadata.base_pool.address,
            type: metadata.base_pool.type || 'DXswapPair',
            companyName: metadata.base_pool.companyName,
            currencyName: metadata.base_pool.currencyName,
            currencySlot: metadata.base_pool.currencySlot ?? 0
          } : {
            // Gnosis Chain default base pool
            address: "0xd1d7fa8871d84d0e77020fc28b7cd5718c446522",
            type: 'DXswapPair',
            companyName: 'GNO',
            currencyName: 'sDAI',
            currencySlot: 0
          },
          
          // Third pool configuration (for additional price fetching)
          POOL_CONFIG_THIRD: metadata.prediction_pools?.yes ? {
            address: metadata.prediction_pools.yes.address,
            tokenCompanySlot: metadata.prediction_pools.yes.tokenBaseSlot ?? metadata.prediction_pools.yes.token_slot ?? 0,  // Use tokenBaseSlot or token_slot from API, default to 0
          } : {
            address: "0x19109DB1e35a9Ba50807aedDa244dCfFc634EF6F",
            tokenCompanySlot: 0,  // Default to 0 (no inversion)
          },
          
          // Merge configuration - use metadata if available, otherwise use updated addresses
          MERGE_CONFIG: {
            currencyPositions: {
                yes: {
                    positionId: '0x0da8ddb6e1511c1b897fa0fdabac151efbe8a6a1cee0d042035a10bd8ca50566',
                    wrap: {
                        tokenName: metadata.currencyTokens?.yes?.tokenName || 'YES_sDAI',
                        tokenSymbol: metadata.currencyTokens?.yes?.tokenSymbol || 'YES_sDAI',
                        wrappedCollateralTokenAddress: metadata?.currencyTokens?.yes?.wrappedCollateralTokenAddress || '0x2301e71f6c6dc4f8d906772f0551e488dd007a99'
                    }
                },
                no: {
                    positionId: '0xc493e87c029b70d6dd6a58ea51d2bb5e7c5e19a61833547e3f3876242665b501',
                    wrap: {
                        tokenName: metadata.currencyTokens?.no?.tokenName || 'NO_sDAI',
                        tokenSymbol: metadata.currencyTokens?.no?.tokenSymbol || 'NO_sDAI',
                        wrappedCollateralTokenAddress: metadata?.currencyTokens?.no?.wrappedCollateralTokenAddress || '0xb9d258c84589d47d9c4cab20a496255556337111'
                    }
                }
            },
            companyPositions: {
                yes: {
                    positionId: '0x15883231add67852d8d5ae24898ec21779cc1a99897a520f12ba52021266e218',
                    wrap: {
                        tokenName: metadata.companyTokens?.yes?.tokenName || 'YES_GNO',
                        tokenSymbol: metadata.companyTokens?.yes?.tokenSymbol || 'YES_GNO',
                        wrappedCollateralTokenAddress: metadata?.companyTokens?.yes?.wrappedCollateralTokenAddress || '0xb28dbe5cd5168d2d94194eb706eb6bcd81edb04e'
                    }
                },
                no: {
                    positionId: '0x50b02574e86d37993b7a6ebd52414f9deea42ecfe9c3f1e8556a6d91ead41cc7',
                    wrap: {
                        tokenName: metadata.companyTokens?.no?.tokenName || 'NO_GNO',
                        tokenSymbol: metadata.companyTokens?.no?.tokenSymbol || 'NO_GNO',
                        wrappedCollateralTokenAddress: metadata?.companyTokens?.no?.wrappedCollateralTokenAddress || '0xad34b43712588fa57d80e76c5c2bcbd274bdb5c0'
                    }
                }
            }
        },
          
          // Use PRECISION_CONFIG from metadata if available, otherwise fallback to static PRECISION_CONFIG
          // Check both metadata.display and metadata.precisions.display for backwards compatibility
          PRECISION_CONFIG: {
            display: metadata?.display || metadata?.precisions?.display || PRECISION_CONFIG.display,
            tokens: metadata?.precisions?.tokens || PRECISION_CONFIG.tokens || {
              default: 18,
              [metadata.currencyTokens?.base?.tokenSymbol || 'sDAI']: 18,
              [metadata.companyTokens?.base?.tokenSymbol || 'GNO']: 18
            },
            rounding: metadata?.precisions?.rounding || PRECISION_CONFIG.rounding || {
              floor: true,
              multiplier: {
                default: 8,
                high: 20
              },
              tolerance: {
                balance: 1e-15,
                price: 1e-12,
                amount: 1e-10
              }
            }
          },
          
          // Keep the market information
          marketInfo: {
            title: data.title,
            description: data.proposal_markdown || metadata?.description,
            outcomes: metadata?.outcomes,
            endTime: data.end_date || data.end_time, // Support both field names
            // Extract display text from metadata if available (check both levels)
            display_text_0: metadata?.display_title_0 || metadata?.metadata?.display_title_0 || null,
            display_text_1: metadata?.display_title_1 || metadata?.metadata?.display_title_1 || null,
            // Include fetchSpotPrice URL for custom price endpoints
            fetchSpotPrice: metadata?.fetchSpotPrice || null,
            // Include spot price for inversion logic
            spotPrice: metadata?.spotPrice || null,
            // Include track progress link from metadata
            trackProgressLink: metadata?.trackProgressLink || null,
            // Include question link from metadata (check both nested and direct paths)
            questionLink: metadata?.metadata?.question_link || metadata?.questionLink || null,
            // Add resolved status - only resolved if there's an actual outcome or resolution_status indicates completion
            resolved: data.resolution_outcome !== null || data.resolution_status === 'resolved',
            resolutionStatus: data.resolution_status,
            finalOutcome: data.resolution_outcome || metadata?.finalOutcome || null
          },
          
          // Include the full metadata for access to all fields
          metadata: metadata,
          
          // Include spot price for inversion logic
          spotPrice: metadata?.spotPrice || null,
          
          // Include precision settings
          precisions: metadata?.precisions || { main: 2 } // Default to 2 if not specified
        };
        
        setConfig(transformedConfig);
        setLoading(false);
        console.log('✅ Contract config loaded successfully', { 
          title: data.title,
          chain: metadata?.chain,
          router: metadata?.contractInfos.futarchy.router
        });
      } catch (err) {
        console.error('🔴 Failed to fetch contract config:', err);
        setError(err);
        setLoading(false);
      }
    };

    fetchContractConfig();
  }, [proposalId, forceTestPools]);

  return { config, loading, error };
};

export default useContractConfig; 