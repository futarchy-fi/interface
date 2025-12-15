import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { createClient } from '@supabase/supabase-js';
import { DataLayer } from '../../../../futarchy-sdk/DataLayer.js';
import { TradeHistoryFetcher } from '../../../../futarchy-sdk/fetchers/TradeHistoryFetcher.js';
import { ERC20Fetcher } from '../../../../futarchy-sdk/fetchers/ERC20Fetcher.js';
import TradeHistoryCartridge from '../../../../futarchy-sdk/cartridges/TradeHistoryCartridge.js';
import { formatWith } from '../../../utils/precisionFormatter';

const RecentTradesDataLayer = ({
  config,
  tokenImages = { company: null, currency: null },
  showMyTrades = false,
  limit = 30,
  cachedData = null,
  onDataFetched = null,
  dataKey = null
}) => {
  const [allTrades, setAllTrades] = useState([]); // Store all trades
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newTradeId, setNewTradeId] = useState(null); // Track newly arrived trade for animation
  const [lastFetchedDataKey, setLastFetchedDataKey] = useState(null);
  const { address, isConnected } = useAccount();
  const dataLayerRef = useRef(null);
  const supabaseClientRef = useRef(null);
  const subscriptionStartTime = useRef(Date.now()); // Track when subscription started to avoid processing old trades

  // Initialize DataLayer with SDK components
  useEffect(() => {
    const initializeDataLayer = async () => {
      try {
        console.log('[RecentTradesDataLayer] Initializing DataLayer...');

        // Get chainId from config (default to 100 for Gnosis if not set)
        const chainId = config?.chainId || 100;
        const rpcUrl = chainId === 1
          ? process.env.NEXT_PUBLIC_ETHEREUM_RPC || 'https://eth.llamarpc.com'
          : process.env.NEXT_PUBLIC_GNOSIS_RPC || 'https://rpc.gnosischain.com';

        console.log(`[RecentTradesDataLayer] Using chain ${chainId} with RPC: ${rpcUrl}`);

        // Create DataLayer instance
        const dataLayer = new DataLayer();

        // Initialize ERC20Fetcher for token metadata
        const erc20Fetcher = new ERC20Fetcher({
          chainId: chainId,
          rpcUrl: rpcUrl
        });

        // Create Supabase client (required by TradeHistoryFetcher)
        const supabaseClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );

        // Store supabase client for realtime subscriptions
        supabaseClientRef.current = supabaseClient;

        console.log('[RecentTradesDataLayer] Supabase client created');

        // Initialize TradeHistoryFetcher with Supabase client as first param
        const tradeHistoryFetcher = new TradeHistoryFetcher(supabaseClient, {
          erc20Fetcher: erc20Fetcher,
          rpcUrl: rpcUrl,
          chainId: chainId
        });

        // PRE-POPULATE token cache from metadata - NO RPC CALLS NEEDED!
        console.log('[RecentTradesDataLayer] 🔍 Checking config for metadata...');

        // metadata is at config.metadata (NOT config.marketInfo.metadata)
        const metadata = config?.metadata;

        if (metadata?.companyTokens || metadata?.currencyTokens) {
          console.log('[RecentTradesDataLayer] 🎯 Found metadata with token info! Pre-populating cache...');

          // Cache company tokens from metadata
          if (metadata.companyTokens) {
            const { yes, no, base } = metadata.companyTokens;

            if (yes?.wrappedCollateralTokenAddress && yes?.tokenSymbol) {
              tradeHistoryFetcher.tokenCache.set(yes.wrappedCollateralTokenAddress.toLowerCase(), {
                data: { symbol: yes.tokenSymbol, name: yes.tokenName || yes.tokenSymbol, decimals: 18 },
                timestamp: Date.now()
              });
              console.log(`  ✓ Cached ${yes.tokenSymbol} at ${yes.wrappedCollateralTokenAddress}`);
            }

            if (no?.wrappedCollateralTokenAddress && no?.tokenSymbol) {
              tradeHistoryFetcher.tokenCache.set(no.wrappedCollateralTokenAddress.toLowerCase(), {
                data: { symbol: no.tokenSymbol, name: no.tokenName || no.tokenSymbol, decimals: 18 },
                timestamp: Date.now()
              });
              console.log(`  ✓ Cached ${no.tokenSymbol} at ${no.wrappedCollateralTokenAddress}`);
            }

            if (base?.wrappedCollateralTokenAddress && base?.tokenSymbol) {
              tradeHistoryFetcher.tokenCache.set(base.wrappedCollateralTokenAddress.toLowerCase(), {
                data: { symbol: base.tokenSymbol, name: base.tokenName || base.tokenSymbol, decimals: 18 },
                timestamp: Date.now()
              });
              console.log(`  ✓ Cached ${base.tokenSymbol} at ${base.wrappedCollateralTokenAddress}`);
            }
          }

          // Cache currency tokens from metadata
          if (metadata.currencyTokens) {
            const { yes, no, base } = metadata.currencyTokens;

            if (yes?.wrappedCollateralTokenAddress && yes?.tokenSymbol) {
              tradeHistoryFetcher.tokenCache.set(yes.wrappedCollateralTokenAddress.toLowerCase(), {
                data: { symbol: yes.tokenSymbol, name: yes.tokenName || yes.tokenSymbol, decimals: 18 },
                timestamp: Date.now()
              });
              console.log(`  ✓ Cached ${yes.tokenSymbol} at ${yes.wrappedCollateralTokenAddress}`);
            }

            if (no?.wrappedCollateralTokenAddress && no?.tokenSymbol) {
              tradeHistoryFetcher.tokenCache.set(no.wrappedCollateralTokenAddress.toLowerCase(), {
                data: { symbol: no.tokenSymbol, name: no.tokenName || no.tokenSymbol, decimals: 18 },
                timestamp: Date.now()
              });
              console.log(`  ✓ Cached ${no.tokenSymbol} at ${no.wrappedCollateralTokenAddress}`);
            }

            if (base?.wrappedCollateralTokenAddress && base?.tokenSymbol) {
              tradeHistoryFetcher.tokenCache.set(base.wrappedCollateralTokenAddress.toLowerCase(), {
                data: { symbol: base.tokenSymbol, name: base.tokenName || base.tokenSymbol, decimals: 18 },
                timestamp: Date.now()
              });
              console.log(`  ✓ Cached ${base.tokenSymbol} at ${base.wrappedCollateralTokenAddress}`);
            }
          }

          console.log('[RecentTradesDataLayer] ✅ Token cache populated from metadata - zero RPC calls!');
          console.log('[RecentTradesDataLayer] Cached tokens:', Array.from(tradeHistoryFetcher.tokenCache.keys()));
        } else if (config?.BASE_TOKENS_CONFIG) {
          console.log('[RecentTradesDataLayer] Pre-populating token cache from config...');
          console.log('[RecentTradesDataLayer] Full config:', JSON.stringify(config.BASE_TOKENS_CONFIG, null, 2));

          // Cache company tokens (GNO/YES-GNO/NO-GNO)
          if (config.BASE_TOKENS_CONFIG.company) {
            const companyTokens = config.BASE_TOKENS_CONFIG.company;
            console.log('[RecentTradesDataLayer] Company tokens:', companyTokens);

            // Base company token
            if (companyTokens.address) {
              tradeHistoryFetcher.tokenCache.set(companyTokens.address.toLowerCase(), {
                data: {
                  symbol: companyTokens.symbol || 'GNO',
                  name: companyTokens.name || companyTokens.symbol || 'GNO',
                  decimals: 18
                },
                timestamp: Date.now()
              });
              console.log(`  ✓ Cached ${companyTokens.symbol} at ${companyTokens.address}`);
            }

            // YES token - check multiple possible field names
            const yesTokenAddr = companyTokens.yesToken || companyTokens.yesAddress || companyTokens.yes_token || companyTokens.yes_address;
            if (yesTokenAddr) {
              tradeHistoryFetcher.tokenCache.set(yesTokenAddr.toLowerCase(), {
                data: {
                  symbol: `YES_${companyTokens.symbol || 'GNO'}`,
                  name: `YES ${companyTokens.name || companyTokens.symbol || 'GNO'}`,
                  decimals: 18
                },
                timestamp: Date.now()
              });
              console.log(`  ✓ Cached YES_${companyTokens.symbol} at ${yesTokenAddr}`);
            }

            // NO token - check multiple possible field names
            const noTokenAddr = companyTokens.noToken || companyTokens.noAddress || companyTokens.no_token || companyTokens.no_address;
            if (noTokenAddr) {
              tradeHistoryFetcher.tokenCache.set(noTokenAddr.toLowerCase(), {
                data: {
                  symbol: `NO_${companyTokens.symbol || 'GNO'}`,
                  name: `NO ${companyTokens.name || companyTokens.symbol || 'GNO'}`,
                  decimals: 18
                },
                timestamp: Date.now()
              });
              console.log(`  ✓ Cached NO_${companyTokens.symbol} at ${noTokenAddr}`);
            }
          }

          // Cache currency tokens (sDAI/YES-sDAI/NO-sDAI)
          if (config.BASE_TOKENS_CONFIG.currency) {
            const currencyTokens = config.BASE_TOKENS_CONFIG.currency;
            console.log('[RecentTradesDataLayer] Currency tokens:', currencyTokens);

            // Base currency token
            if (currencyTokens.address) {
              tradeHistoryFetcher.tokenCache.set(currencyTokens.address.toLowerCase(), {
                data: {
                  symbol: currencyTokens.symbol || 'sDAI',
                  name: currencyTokens.name || currencyTokens.symbol || 'sDAI',
                  decimals: 18
                },
                timestamp: Date.now()
              });
              console.log(`  ✓ Cached ${currencyTokens.symbol} at ${currencyTokens.address}`);
            }

            // YES token - check multiple possible field names
            const yesTokenAddr = currencyTokens.yesToken || currencyTokens.yesAddress || currencyTokens.yes_token || currencyTokens.yes_address;
            if (yesTokenAddr) {
              tradeHistoryFetcher.tokenCache.set(yesTokenAddr.toLowerCase(), {
                data: {
                  symbol: `YES_${currencyTokens.symbol || 'sDAI'}`,
                  name: `YES ${currencyTokens.name || currencyTokens.symbol || 'sDAI'}`,
                  decimals: 18
                },
                timestamp: Date.now()
              });
              console.log(`  ✓ Cached YES_${currencyTokens.symbol} at ${yesTokenAddr}`);
            }

            // NO token - check multiple possible field names
            const noTokenAddr = currencyTokens.noToken || currencyTokens.noAddress || currencyTokens.no_token || currencyTokens.no_address;
            if (noTokenAddr) {
              tradeHistoryFetcher.tokenCache.set(noTokenAddr.toLowerCase(), {
                data: {
                  symbol: `NO_${currencyTokens.symbol || 'sDAI'}`,
                  name: `NO ${currencyTokens.name || currencyTokens.symbol || 'sDAI'}`,
                  decimals: 18
                },
                timestamp: Date.now()
              });
              console.log(`  ✓ Cached NO_${currencyTokens.symbol} at ${noTokenAddr}`);
            }
          }

          console.log('[RecentTradesDataLayer] Token cache populated successfully');
          console.log('[RecentTradesDataLayer] Cached tokens:', Array.from(tradeHistoryFetcher.tokenCache.keys()));
        } else {
          console.warn('[RecentTradesDataLayer] No BASE_TOKENS_CONFIG found in config!');
          console.log('[RecentTradesDataLayer] Full config:', config);
        }

        // Register fetcher
        dataLayer.registerFetcher(tradeHistoryFetcher);
        console.log('[RecentTradesDataLayer] TradeHistoryFetcher registered');

        // Initialize and register cartridge
        const tradeHistoryCartridge = new TradeHistoryCartridge(dataLayer);

        // Set metadata on cartridge for token type identification
        if (metadata) {
          console.log('[RecentTradesDataLayer] Setting metadata on cartridge...');
          tradeHistoryCartridge.setMetadata(metadata);
        } else {
          console.warn('[RecentTradesDataLayer] No metadata available for cartridge');
        }

        dataLayer.registerExecutor(tradeHistoryCartridge);
        console.log('[RecentTradesDataLayer] TradeHistoryCartridge registered');

        dataLayerRef.current = dataLayer;
        console.log('[RecentTradesDataLayer] DataLayer initialized successfully');
      } catch (err) {
        console.error('[RecentTradesDataLayer] Failed to initialize DataLayer:', err);
        setError(`Initialization failed: ${err.message}`);
        setIsLoading(false);
      }
    };

    initializeDataLayer();
  }, [config]);

  // Fetch trades when config, filter, or limit changes
  useEffect(() => {
    const fetchTrades = async () => {
      if (!dataLayerRef.current) {
        console.log('[RecentTradesDataLayer] DataLayer not initialized yet');
        return;
      }

      // Get proposal ID from config (NOT lowercased)
      const proposalId = config?.proposalId || config?.MARKET_ADDRESS;

      if (!proposalId) {
        console.log('[RecentTradesDataLayer] Waiting for config to load...');
        // Keep loading state if config hasn't loaded yet
        setIsLoading(true);
        return;
      }

      // Check if we already have cached data for this dataKey
      if (cachedData && dataKey && dataKey === lastFetchedDataKey) {
        console.log('[RecentTradesDataLayer] ✅ Using cached data - SKIPPING FETCH');
        setAllTrades(cachedData);
        setIsLoading(false);
        return;
      }

      console.log(`[RecentTradesDataLayer] Fetching ALL trades for proposal:`, {
        proposalId: proposalId,
        limit: limit,
        source: 'DataLayer SDK'
      });

      setIsLoading(true);
      setError(null);

      try {
        // Build fetch params - add userAddress filter when showing "My Trades"
        const fetchParams = {
          proposalId: proposalId, // Use original case from config - DON'T lowercase
          limit: limit,
          // CRITICAL FIX: Filter by user address when showMyTrades is true
          ...(showMyTrades && address ? { userAddress: address.toLowerCase() } : {})
        };

        // Use the DataLayer to execute trades.formatted operation
        for await (const step of dataLayerRef.current.execute('trades.formatted', fetchParams)) {
          if (step.status === 'processing') {
            console.log('[RecentTradesDataLayer]', step.message);
          } else if (step.status === 'success') {
            const trades = step.data.trades || [];
            console.log(`[RecentTradesDataLayer] Successfully fetched ${trades.length} trades`);
            setAllTrades(trades);
            setLastFetchedDataKey(dataKey);

            // Cache the data in parent
            if (onDataFetched) {
              onDataFetched(trades);
            }
            setIsLoading(false);
          } else if (step.status === 'error') {
            console.error('[RecentTradesDataLayer] Error:', step.message);
            setError(step.message);
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.error('[RecentTradesDataLayer] Fetch error:', err);
        setError(`Failed to fetch trades: ${err.message}`);
        setIsLoading(false);
      }
    };

    fetchTrades();
  }, [config?.proposalId, config?.MARKET_ADDRESS, limit, showMyTrades, address]); // Refetch when showMyTrades or address changes

  // Set up realtime subscription for new trades
  useEffect(() => {
    if (!supabaseClientRef.current) {
      console.log('[RecentTradesDataLayer] Waiting for Supabase client...');
      return;
    }

    if (!config?.proposalId && !config?.MARKET_ADDRESS) {
      console.log('[RecentTradesDataLayer] Waiting for config...');
      return;
    }

    if (!dataLayerRef.current) {
      console.log('[RecentTradesDataLayer] Waiting for DataLayer...');
      return;
    }

    const proposalId = config?.proposalId || config?.MARKET_ADDRESS;

    console.log('[RecentTradesDataLayer] 🔴 Setting up realtime subscription for proposal:', proposalId);

    const channel = supabaseClientRef.current
      .channel('realtime-trade-history')
      .on('postgres_changes', {
        event: 'INSERT', // Only listen for new inserts, not updates or deletes
        schema: 'public',
        table: 'trade_history'
      }, (payload) => {
        console.log('[RecentTradesDataLayer] 🔴 RAW PAYLOAD RECEIVED (INSERT):', JSON.stringify(payload, null, 2));

        // Filter manually for this proposal - check proposal_id in lowercase only
        const payloadProposalId = (payload.new?.proposal_id || '').toLowerCase();
        const expectedProposalId = (proposalId || '').toLowerCase();

        console.log('[RecentTradesDataLayer] 🔍 Filter check:', {
          payloadProposalId,
          expectedProposalId,
          match: payloadProposalId === expectedProposalId
        });

        if (payloadProposalId !== expectedProposalId) {
          console.log('[RecentTradesDataLayer] ⏭️ SKIPPING - proposal_id mismatch');
          return;
        }

        console.log('[RecentTradesDataLayer] ✅ PASSED FILTER - Processing trade');

        // Format the new trade using the cartridge
        try {
          const cartridge = dataLayerRef.current.executors.get('trades.formatted');
          if (!cartridge) {
            console.error('[RecentTradesDataLayer] ❌ Cartridge not found!');
            return;
          }

          if (!cartridge.formatTrade) {
            console.error('[RecentTradesDataLayer] ❌ formatTrade method not found!');
            return;
          }

          console.log('[RecentTradesDataLayer] 🔄 Formatting new trade...');
          console.log('[RecentTradesDataLayer] 🔄 Raw trade data:', payload.new);
          const formattedTrade = cartridge.formatTrade(payload.new);
          console.log('[RecentTradesDataLayer] ✅ Formatted trade:', JSON.stringify(formattedTrade, null, 2));

          // Generate unique ID for duplicate detection
          const uniqueTradeId = payload.new.id || payload.new.evt_tx_hash ||
            `${payload.new.evt_block_number}-${payload.new.evt_index || payload.new.log_index}`;

          // Add to the beginning of the trades array - with duplicate check
          setAllTrades(prevTrades => {
            console.log('[RecentTradesDataLayer] 📝 Adding trade to list. Previous count:', prevTrades.length);

            // Check if this trade already exists by transaction hash
            const newTxHash = payload.new.evt_tx_hash;
            const newBlockNumber = payload.new.evt_block_number;
            const newLogIndex = payload.new.evt_index || payload.new.log_index;

            const isDuplicate = prevTrades.some(trade => {
              // Extract tx hash from transactionLink (e.g., "https://gnosisscan.io/tx/0xabc...")
              const existingTxHash = trade.transactionLink ?
                trade.transactionLink.split('/tx/')[1]?.split('#')[0] : null;

              // Match by transaction hash (primary check)
              if (newTxHash && existingTxHash === newTxHash) {
                return true;
              }

              // Match by block number + log index (secondary check)
              if (newBlockNumber && newLogIndex &&
                trade.blockNumber === newBlockNumber &&
                trade.logIndex === newLogIndex) {
                return true;
              }

              return false;
            });

            if (isDuplicate) {
              console.log('[RecentTradesDataLayer] ⚠️ Duplicate trade detected, skipping tx:', newTxHash);
              return prevTrades;
            }

            const updatedTrades = [formattedTrade, ...prevTrades];

            // Also update the cached data in parent
            if (onDataFetched) {
              onDataFetched(updatedTrades);
            }

            return updatedTrades;
          });

          // Set the new trade ID for animation
          const tradeId = payload.new.id || payload.new.evt_tx_hash || payload.new.evt_block_number;
          console.log('[RecentTradesDataLayer] 🎨 Setting animation for trade ID:', tradeId);
          setNewTradeId(tradeId);

          // Clear the animation after 3 seconds
          setTimeout(() => {
            console.log('[RecentTradesDataLayer] 🎨 Clearing animation');
            setNewTradeId(null);
          }, 3000);

          console.log('[RecentTradesDataLayer] ✅ New trade added and animated!');
        } catch (err) {
          console.error('[RecentTradesDataLayer] ❌ Error formatting realtime trade:', err);
          console.error('[RecentTradesDataLayer] Error stack:', err.stack);
        }
      })
      .subscribe((status) => {
        console.log('[RecentTradesDataLayer] 🔴 Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('[RecentTradesDataLayer] ✅ Successfully subscribed to trade_history realtime updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[RecentTradesDataLayer] ❌ Channel error - subscription failed');
        } else if (status === 'TIMED_OUT') {
          console.error('[RecentTradesDataLayer] ❌ Subscription timed out');
        }
      });

    // Log channel state
    console.log('[RecentTradesDataLayer] 🔴 Channel created:', {
      channelName: 'realtime-trade-history',
      table: 'trade_history',
      proposalFilter: proposalId
    });

    // Cleanup on unmount
    return () => {
      console.log('[RecentTradesDataLayer] 🔴 Cleaning up realtime subscription');
      if (supabaseClientRef.current) {
        supabaseClientRef.current.removeChannel(channel);
      }
    };
  }, [config?.proposalId, config?.MARKET_ADDRESS]);

  const companySymbols = useMemo(() => {
    const symbols = new Set();
    const addSymbol = (symbol) => {
      if (symbol && typeof symbol === 'string') {
        symbols.add(symbol.toUpperCase());
      }
    };

    addSymbol(config?.BASE_TOKENS_CONFIG?.company?.symbol || 'GNO');
    addSymbol(config?.MERGE_CONFIG?.companyPositions?.yes?.wrap?.tokenSymbol);
    addSymbol(config?.MERGE_CONFIG?.companyPositions?.no?.wrap?.tokenSymbol);

    return symbols;
  }, [config]);

  const isCompanyToken = useCallback((symbol) => {
    if (!symbol) return false;
    const upper = symbol.toUpperCase();
    if (companySymbols.has(upper)) return true;
    for (const baseSymbol of companySymbols) {
      if (!baseSymbol) continue;
      if (upper.endsWith(`_${baseSymbol}`)) {
        return true;
      }
    }
    return false;
  }, [companySymbols]);

  const roundUp = useCallback((value, decimals) => {
    const factor = Math.pow(10, decimals);
    if (value >= 0) {
      return Math.ceil((value + Number.EPSILON) * factor) / factor;
    }
    return -Math.ceil((Math.abs(value) + Number.EPSILON) * factor) / factor;
  }, []);

  const formatTokenAmount = useCallback((rawValue, symbol) => {
    const parsed = typeof rawValue === 'number' ? rawValue : parseFloat(rawValue);
    const isCompany = isCompanyToken(symbol);
    if (!isFinite(parsed)) {
      return rawValue ?? (isCompany ? '0.0000' : '0.00');
    }

    const decimals = isCompany ? 4 : 2;
    const factor = Math.pow(10, decimals);
    let rounded;

    if (isCompany) {
      rounded = roundUp(parsed, decimals);
    } else {
      rounded = Math.round(parsed * factor) / factor;
    }

    if (Object.is(rounded, -0)) {
      rounded = 0;
    }

    return rounded.toFixed(decimals);
  }, [isCompanyToken, roundUp]);

  const formatPrice = useCallback((rawPrice) => {
    const parsed = typeof rawPrice === 'number' ? rawPrice : parseFloat(rawPrice);
    if (!isFinite(parsed)) {
      return rawPrice ?? '0.00';
    }
    const rounded = Math.round(parsed * 100) / 100;
    return rounded.toFixed(2);
  }, []);

  // Filter trades locally based on showMyTrades - NO REFETCHING!
  const filteredTrades = useMemo(() => {
    if (!showMyTrades) {
      return allTrades; // Show all trades
    }

    // For "My Trades" mode: if wallet not connected, show empty array
    if (!address) {
      return [];
    }

    // Filter to only user's trades by checking if user address matches buyer or seller
    return allTrades.filter(trade => {
      // Check if trade has user info and matches current user
      // Trade object might have userAddress, buyer, or seller fields
      const tradeUser = (trade.userAddress || trade.buyer || trade.seller || '').toLowerCase();
      const currentUser = address.toLowerCase();
      return tradeUser === currentUser;
    });
  }, [allTrades, showMyTrades, address]);

  console.log(`[RecentTradesDataLayer] Displaying ${filteredTrades.length} of ${allTrades.length} trades (${showMyTrades ? 'My Trades' : 'All Trades'})`);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-futarchyViolet9 mb-4"></div>
          <p className="text-futarchyGray11 dark:text-futarchyGray112">Loading trade history...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-red-500 mb-2">Error loading trades</p>
          <p className="text-sm text-futarchyGray11">{error}</p>
        </div>
      </div>
    );
  }

  // Format date helper
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  };

  // Handle load more button
  const handleLoadMore = () => {
    setLimit(prevLimit => prevLimit + 30); // Load 30 more trades
  };

  // No trades after filtering
  if (filteredTrades.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-futarchyGray11 dark:text-futarchyGray112">
        {showMyTrades && !isConnected
          ? 'Connect wallet to view your trades'
          : showMyTrades
            ? 'You have no trades for this proposal'
            : 'No trades found for this proposal'}
      </div>
    );
  }

  // Render trades table
  return (
    <div className="relative">
      {/* Desktop Table View - hidden on mobile */}
      <div className="hidden md:block rounded-2xl border border-futarchyGray62 dark:border-futarchyDarkGray42 bg-futarchyGray2 dark:bg-futarchyDarkGray3">
        <div className="overflow-hidden rounded-xl border border-futarchyGray62 dark:border-futarchyDarkGray42">
          <div className="bg-futarchyGray3 dark:bg-futarchyDarkGray3">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-futarchyGray62 dark:border-futarchyDarkGray42 dark:bg-futarchyDarkGray3 h-[60px]">
                  <th className="text-xs text-futarchyGray11 dark:text-futarchyGray112 font-semibold text-left px-4 w-[200px]">Outcome</th>
                  <th className="text-xs text-futarchyGray11 dark:text-futarchyGray112 font-semibold text-left px-4 w-[180px]">Amount</th>
                  <th className="text-xs text-futarchyGray11 dark:text-futarchyGray112 font-semibold text-right px-4 w-[100px]">Price</th>
                  <th className="text-xs text-futarchyGray11 dark:text-futarchyGray112 font-semibold text-right px-4 w-[220px]">Date</th>
                </tr>
              </thead>
            </table>
          </div>
          <div className="relative">
            <div className="overflow-y-auto overscroll-contain scroll-smooth" style={{ height: '400px', scrollbarWidth: 'none', scrollBehavior: 'smooth' }}>
              <table className="w-full">
                <tbody>
                  {filteredTrades.map((trade, index) => {
                    const tokenInSymbol = trade?.amount?.tokenIN?.symbol || '';
                    const tokenOutSymbol = trade?.amount?.tokenOUT?.symbol || '';

                    const isYes = trade.outcome.eventSide === 'yes';
                    const isNo = trade.outcome.eventSide === 'no';
                    const isBuy = trade.outcome.operationSide === 'buy';

                    // Check if this trade involves BASE TOKEN (prediction market)
                    const tokenInAddress = trade?.amount?.tokenIN?.address?.toLowerCase() || '';
                    const tokenOutAddress = trade?.amount?.tokenOUT?.address?.toLowerCase() || '';

                    const baseTokenAddress = config?.metadata?.currencyTokens?.base?.wrappedCollateralTokenAddress?.toLowerCase() ||
                      config?.metadata?.companyTokens?.base?.wrappedCollateralTokenAddress?.toLowerCase() || '';

                    const isPredictionMarket = baseTokenAddress && (
                      tokenInAddress === baseTokenAddress ||
                      tokenOutAddress === baseTokenAddress
                    );

                    // Detect if tokens are company or currency based on metadata
                    const isCompanyToken = (address) => {
                      const addr = address?.toLowerCase();
                      return addr === config?.metadata?.companyTokens?.yes?.wrappedCollateralTokenAddress?.toLowerCase() ||
                        addr === config?.metadata?.companyTokens?.no?.wrappedCollateralTokenAddress?.toLowerCase() ||
                        addr === config?.metadata?.companyTokens?.base?.wrappedCollateralTokenAddress?.toLowerCase();
                    };

                    const isCurrencyToken = (address) => {
                      const addr = address?.toLowerCase();
                      return addr === config?.metadata?.currencyTokens?.yes?.wrappedCollateralTokenAddress?.toLowerCase() ||
                        addr === config?.metadata?.currencyTokens?.no?.wrappedCollateralTokenAddress?.toLowerCase() ||
                        addr === config?.metadata?.currencyTokens?.base?.wrappedCollateralTokenAddress?.toLowerCase();
                    };

                    // Get precision config - handle both config.PRECISION_CONFIG and config.display structures
                    const precisionConfig = config?.PRECISION_CONFIG || (config?.display ? { display: config.display } : null);

                    // Format token amounts with proper precision based on token type
                    let formattedTokenInValue, formattedTokenOutValue;
                    if (isCompanyToken(tokenInAddress)) {
                      formattedTokenInValue = formatWith(trade?.amount?.tokenIN?.value, 'company', precisionConfig);
                    } else if (isCurrencyToken(tokenInAddress)) {
                      formattedTokenInValue = formatWith(trade?.amount?.tokenIN?.value, 'currency', precisionConfig);
                    } else {
                      formattedTokenInValue = formatWith(trade?.amount?.tokenIN?.value, 'amount', precisionConfig);
                    }

                    if (isCompanyToken(tokenOutAddress)) {
                      formattedTokenOutValue = formatWith(trade?.amount?.tokenOUT?.value, 'company', precisionConfig);
                    } else if (isCurrencyToken(tokenOutAddress)) {
                      formattedTokenOutValue = formatWith(trade?.amount?.tokenOUT?.value, 'currency', precisionConfig);
                    } else {
                      formattedTokenOutValue = formatWith(trade?.amount?.tokenOUT?.value, 'amount', precisionConfig);
                    }

                    // Format price - if prediction market, show as percentage
                    // Otherwise, price is ALWAYS in currency (not company tokens)
                    let formattedPrice;
                    if (isPredictionMarket) {
                      const priceValue = parseFloat(trade?.price) || 0;
                      const percentageValue = priceValue * 100;
                      formattedPrice = `${formatWith(percentageValue, 'percentage', precisionConfig)}%`;
                    } else {
                      // Non-prediction market: price is in currency, so use currency precision
                      formattedPrice = formatWith(trade?.price, 'currency', precisionConfig);
                    }

                    // Check if this is the newly arrived trade
                    const tradeId = `${trade.transactionLink}-${trade.blockNumber}`;
                    const isNewTrade = newTradeId && (
                      tradeId.includes(newTradeId) ||
                      trade.transactionLink?.includes(newTradeId) ||
                      String(trade.blockNumber) === String(newTradeId)
                    );

                    return (
                      <tr
                        key={trade.id || `${trade.transactionLink || trade.evt_tx_hash}-${trade.logIndex || trade.evt_index || index}`}
                        className={`border-b border-futarchyGray62 dark:border-futarchyDarkGray42 hover:bg-futarchyGray3 dark:hover:bg-futarchyGray3/20 transition-all duration-500 h-[60px] ${isNewTrade ? 'animate-new-trade-highlight' : ''
                          }`}
                      >
                        <td className="px-4 w-[200px]">
                          <div className="flex flex-col gap-1">
                            <div className="inline-flex overflow-hidden w-[160px]">
                              <div className={`w-[80px] px-3 py-1 text-sm font-medium text-center rounded-l-full ${isYes
                                ? 'bg-futarchyBlue4 text-futarchyBlue11 border border-futarchyBlue6 dark:bg-transparent dark:text-futarchyBlue9 dark:border-futarchyBlue9'
                                : isNo
                                  ? 'bg-futarchyGold4 text-futarchyGold11 border border-futarchyGold6 dark:bg-transparent dark:text-futarchyGold7 dark:border-futarchyGold7'
                                  : 'bg-futarchyGray4 text-futarchyGray11 border border-futarchyGray6 dark:bg-transparent dark:text-futarchyGray9 dark:border-futarchyGray9'
                                }`}>
                                {trade.outcome.eventSide.toUpperCase()}
                              </div>
                              <div className={`w-[80px] px-3 py-1 text-sm font-medium text-center rounded-r-full ${!isBuy
                                ? 'bg-futarchyTeal3 text-futarchyTeal9 border border-futarchyTeal5 dark:bg-transparent dark:text-futarchyTeal7 dark:border-futarchyTeal7'
                                : 'bg-futarchyCrimson4 text-futarchyCrimson11 border border-futarchyCrimson6 dark:bg-transparent dark:text-futarchyCrimson9 dark:border-futarchyCrimson9'
                                }`}>
                                {trade.outcome.operationSide === 'buy' ? 'sell' : 'buy'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 w-[180px]">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-futarchyGray12 dark:text-futarchyGray112 whitespace-nowrap flex items-center">
                              {formattedTokenInValue} {tokenInSymbol}
                              <span className="text-futarchyTeal7 ml-1">in</span>
                            </span>
                            <span className="text-xs font-semibold text-futarchyGray12 dark:text-futarchyGray112 whitespace-nowrap flex items-center">
                              {formattedTokenOutValue} {tokenOutSymbol}
                              <span className="text-futarchyCrimson9 ml-1">out</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-4 w-[100px] text-right">
                          <span
                            className={`text-xs font-semibold block ${isPredictionMarket
                              ? 'text-futarchyViolet9 dark:text-futarchyViolet7'
                              : isYes
                                ? 'text-futarchyBlue9'
                                : isNo
                                  ? 'text-futarchyGold9'
                                  : 'text-futarchyGray12 dark:text-futarchyGray112'
                              }`}
                          >
                            {formattedPrice}
                          </span>
                        </td>
                        <td className="px-4 w-[220px]">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-xs text-futarchyGray11 dark:text-futarchyGray112">{formatDate(trade.date)}</span>
                            {trade.transactionLink && (
                              <a
                                href={trade.transactionLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-6 h-6 flex items-center justify-center rounded hover:bg-futarchyGray4 dark:hover:bg-futarchyGray3/45 transition-colors"
                                title="View on Block Explorer"
                              >
                                <svg className="w-4 h-4 text-black dark:text-white hover:text-futarchyGray11 dark:hover:text-futarchyGray5 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                  <polyline points="15 3 21 3 21 9"></polyline>
                                  <line x1="10" y1="14" x2="21" y2="3"></line>
                                </svg>
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Card View - shown on mobile only */}
      <div className="md:hidden">
        <div className="overflow-y-auto overscroll-contain scroll-smooth" style={{ height: '400px', scrollbarWidth: 'none', scrollBehavior: 'smooth' }}>
          <div className="flex flex-col gap-3">
            {filteredTrades.map((trade, index) => {
              const tokenInSymbol = trade?.amount?.tokenIN?.symbol || '';
              const tokenOutSymbol = trade?.amount?.tokenOUT?.symbol || '';

              const isYes = trade.outcome.eventSide === 'yes';
              const isNo = trade.outcome.eventSide === 'no';
              const isBuy = trade.outcome.operationSide === 'buy';

              // Check if this trade involves BASE TOKEN (prediction market)
              const tokenInAddress = trade?.amount?.tokenIN?.address?.toLowerCase() || '';
              const tokenOutAddress = trade?.amount?.tokenOUT?.address?.toLowerCase() || '';

              const baseTokenAddress = config?.metadata?.currencyTokens?.base?.wrappedCollateralTokenAddress?.toLowerCase() ||
                config?.metadata?.companyTokens?.base?.wrappedCollateralTokenAddress?.toLowerCase() || '';

              const isPredictionMarket = baseTokenAddress && (
                tokenInAddress === baseTokenAddress ||
                tokenOutAddress === baseTokenAddress
              );

              // Detect if tokens are company or currency based on metadata
              const isCompanyToken = (address) => {
                const addr = address?.toLowerCase();
                return addr === config?.metadata?.companyTokens?.yes?.wrappedCollateralTokenAddress?.toLowerCase() ||
                  addr === config?.metadata?.companyTokens?.no?.wrappedCollateralTokenAddress?.toLowerCase() ||
                  addr === config?.metadata?.companyTokens?.base?.wrappedCollateralTokenAddress?.toLowerCase();
              };

              const isCurrencyToken = (address) => {
                const addr = address?.toLowerCase();
                return addr === config?.metadata?.currencyTokens?.yes?.wrappedCollateralTokenAddress?.toLowerCase() ||
                  addr === config?.metadata?.currencyTokens?.no?.wrappedCollateralTokenAddress?.toLowerCase() ||
                  addr === config?.metadata?.currencyTokens?.base?.wrappedCollateralTokenAddress?.toLowerCase();
              };

              // Get precision config - handle both config.PRECISION_CONFIG and config.display structures
              const precisionConfig = config?.PRECISION_CONFIG || (config?.display ? { display: config.display } : null);

              // Format token amounts with proper precision based on token type
              let formattedTokenInValue, formattedTokenOutValue;
              if (isCompanyToken(tokenInAddress)) {
                formattedTokenInValue = formatWith(trade?.amount?.tokenIN?.value, 'company', precisionConfig);
              } else if (isCurrencyToken(tokenInAddress)) {
                formattedTokenInValue = formatWith(trade?.amount?.tokenIN?.value, 'currency', precisionConfig);
              } else {
                formattedTokenInValue = formatWith(trade?.amount?.tokenIN?.value, 'amount', precisionConfig);
              }

              if (isCompanyToken(tokenOutAddress)) {
                formattedTokenOutValue = formatWith(trade?.amount?.tokenOUT?.value, 'company', precisionConfig);
              } else if (isCurrencyToken(tokenOutAddress)) {
                formattedTokenOutValue = formatWith(trade?.amount?.tokenOUT?.value, 'currency', precisionConfig);
              } else {
                formattedTokenOutValue = formatWith(trade?.amount?.tokenOUT?.value, 'amount', precisionConfig);
              }

              // Format price - if prediction market, show as percentage
              // Otherwise, price is ALWAYS in currency (not company tokens)
              let formattedPrice;
              if (isPredictionMarket) {
                const priceValue = parseFloat(trade?.price) || 0;
                const percentageValue = priceValue * 100;
                formattedPrice = `${formatWith(percentageValue, 'percentage', precisionConfig)}%`;
              } else {
                // Non-prediction market: price is in currency, so use currency precision
                formattedPrice = formatWith(trade?.price, 'currency', precisionConfig);
              }

              // Check if this is the newly arrived trade
              const tradeId = `${trade.transactionLink}-${trade.blockNumber}`;
              const isNewTrade = newTradeId && (
                tradeId.includes(newTradeId) ||
                trade.transactionLink?.includes(newTradeId) ||
                String(trade.blockNumber) === String(newTradeId)
              );

              return (
                <div
                  key={trade.id || `${trade.transactionLink || trade.evt_tx_hash}-${trade.logIndex || trade.evt_index || index}`}
                  className={`bg-futarchyGray3 dark:bg-futarchyDarkGray3 border border-futarchyGray62 dark:border-futarchyDarkGray42 rounded-lg p-3 ${isNewTrade ? 'animate-new-trade-highlight' : ''
                    }`}
                >
                  {/* Trader Address */}
                  <div className="mb-3">
                    <a
                      href={trade.transactionLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-futarchyGray12 dark:text-futarchyGray112 hover:text-futarchyBlue9 dark:hover:text-futarchyBlue9 transition-colors"
                    >
                      {trade.userAddress ? `${trade.userAddress.slice(0, 6)}...${trade.userAddress.slice(-4)}` : 'Unknown'}
                    </a>
                  </div>

                  {/* Trade Details Grid */}
                  <div className="flex flex-col gap-2.5">
                    {/* Outcome */}
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-futarchyGray11 dark:text-futarchyGray112">Outcome</div>
                      <div className="inline-flex overflow-hidden">
                        <div className={`px-3 py-1 text-xs font-medium text-center rounded-l-full ${isYes
                          ? 'bg-futarchyBlue4 text-futarchyBlue11 border border-futarchyBlue6 dark:bg-transparent dark:text-futarchyBlue9 dark:border-futarchyBlue9'
                          : isNo
                            ? 'bg-futarchyGold4 text-futarchyGold11 border border-futarchyGold6 dark:bg-transparent dark:text-futarchyGold7 dark:border-futarchyGold7'
                            : 'bg-futarchyGray4 text-futarchyGray11 border border-futarchyGray6 dark:bg-transparent dark:text-futarchyGray9 dark:border-futarchyGray9'
                          }`}>
                          {trade.outcome.eventSide.toUpperCase()}
                        </div>
                        <div className={`px-3 py-1 text-xs font-medium text-center rounded-r-full ${!isBuy
                          ? 'bg-futarchyTeal3 text-futarchyTeal9 border border-futarchyTeal5 dark:bg-transparent dark:text-futarchyTeal7 dark:border-futarchyTeal7'
                          : 'bg-futarchyCrimson4 text-futarchyCrimson11 border border-futarchyCrimson6 dark:bg-transparent dark:text-futarchyCrimson9 dark:border-futarchyCrimson9'
                          }`}>
                          {trade.outcome.operationSide === 'buy' ? 'sell' : 'buy'}
                        </div>
                      </div>
                    </div>

                    {/* Amount In */}
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-futarchyGray11 dark:text-futarchyGray112">Amount In</div>
                      <div className="text-xs font-semibold text-futarchyGray12 dark:text-futarchyGray112 text-right">
                        {formattedTokenInValue} {tokenInSymbol}
                      </div>
                    </div>

                    {/* Amount Out */}
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-futarchyGray11 dark:text-futarchyGray112">Amount Out</div>
                      <div className="text-xs font-semibold text-futarchyGray12 dark:text-futarchyGray112 text-right">
                        {formattedTokenOutValue} {tokenOutSymbol}
                      </div>
                    </div>

                    {/* Price */}
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-futarchyGray11 dark:text-futarchyGray112">Price</div>
                      <div
                        className={`text-xs font-semibold ${isPredictionMarket
                          ? 'text-futarchyViolet9 dark:text-futarchyViolet7'
                          : isYes
                            ? 'text-futarchyBlue9'
                            : isNo
                              ? 'text-futarchyGold9'
                              : 'text-futarchyGray12 dark:text-futarchyGray112'
                          }`}
                      >
                        {formattedPrice}
                      </div>
                    </div>

                    {/* Date */}
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-futarchyGray11 dark:text-futarchyGray112">Date</div>
                      <div className="text-xs text-futarchyGray12 dark:text-futarchyGray112 text-right">
                        {formatDate(trade.date)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecentTradesDataLayer;
