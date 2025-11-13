import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useTradeHistoryRealtime, usePoolCandlesRealtime } from '../hooks/useRealtimeSupabase';
import { useProposalContext } from '../context/ProposalContext';

/**
 * Realtime Display Component with Global Proposal Integration
 * Shows both Trade History and Pool Candles with separate tabs
 * Now fully integrated with the global proposal system
 */
export default function RealtimeDisplay() {
  const { address: connectedWalletAddress, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState('trades');
  const [manualAddress, setManualAddress] = useState('');
  const [interval, setInterval] = useState(60000);
  
  // Use global proposal context instead of local state
  const proposal = useProposalContext();
  
  // Use both realtime hooks
  const tradeHistory = useTradeHistoryRealtime();
  const poolCandles = usePoolCandlesRealtime();

  // Auto-subscribe when connected wallet is available and proposal is ready
  useEffect(() => {
    if (connectedWalletAddress && activeTab === 'trades' && isConnected && proposal.isProposalReady()) {
      console.log(`🔄 Auto-subscribing to trade history for connected wallet: ${connectedWalletAddress}`);
      handleTradeSubscribe(connectedWalletAddress);
    }
    
    return () => {
      console.log(`🧹 RealtimeDisplay cleanup - unsubscribing`);
      tradeHistory.unsubscribe();
      poolCandles.unsubscribe();
    };
  }, [connectedWalletAddress, activeTab, isConnected, proposal.isProposalReady()]);

  const handleTradeSubscribe = async (address = null) => {
    const targetAddress = address || connectedWalletAddress;
    
    if (!targetAddress) {
      alert('Please connect your wallet or provide a wallet address');
      return;
    }

    if (!proposal.isProposalReady()) {
      alert('Proposal data not loaded yet. Please load a proposal above.');
      return;
    }

    try {
      console.log(`📡 Trade subscription for: ${targetAddress}`);
      await tradeHistory.subscribe({
        user_address: targetAddress,
        proposal_id: proposal.proposalAddress
      });
      console.log(`✅ Trade subscription successful`);
    } catch (err) {
      console.error(`❌ Trade subscription failed:`, err);
      alert(`Trade subscription failed: ${err.message}`);
    }
  };

  const handlePoolSubscribe = async () => {
    if (!proposal.isProposalReady()) {
      alert('Proposal data not loaded yet. Please load a proposal above.');
      return;
    }

    try {
      console.log(`📡 Pool candles subscription for interval: ${interval}`);
      
      // Use dynamic pool addresses from global proposal context
      const poolAddresses = proposal.getPoolAddresses();
      console.log('Using pool addresses from global proposal context:', poolAddresses);
      
      await poolCandles.subscribe({
        interval: Number(interval),
        poolAddresses // Pass dynamic pool addresses
      });
      console.log(`✅ Pool subscription successful`);
    } catch (err) {
      console.error(`❌ Pool subscription failed:`, err);
      alert(`Pool subscription failed: ${err.message}`);
    }
  };

  const handleManualTest = () => {
    if (manualAddress && activeTab === 'trades') {
      handleTradeSubscribe(manualAddress);
    }
  };

  const getConnectionStatusBadge = (connectionStatus) => {
    const statusColors = {
      connected: '#10B981',
      live: '#059669',
      connecting: '#F59E0B',
      disconnected: '#6B7280',
      error: '#EF4444'
    };

    return (
      <span style={{
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 'bold',
        backgroundColor: statusColors[connectionStatus] || '#6B7280',
        color: 'white'
      }}>
        {connectionStatus.toUpperCase()}
      </span>
    );
  };

  const renderTradeHistory = () => {
    const { data, loading, error, connectionStatus, isSubscribed, lastUpdate, updateCount } = tradeHistory;
    const strategyMethods = tradeHistory.getStrategyMethods();

    return (
      <div>
        {/* Connection Status */}
        <div style={{ marginBottom: '15px' }}>
          <strong>Status:</strong> {getConnectionStatusBadge(connectionStatus)}
          {isSubscribed && <span style={{ marginLeft: '10px', color: '#059669' }}>📡 Subscribed</span>}
          {lastUpdate && (
            <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
              Last update: {lastUpdate.toLocaleTimeString()} ({updateCount} updates)
            </div>
          )}
          
          {/* Realtime Ready Indicator */}
          {connectionStatus === 'connected' && isSubscribed && (
            <div style={{
              fontSize: '12px',
              color: '#059669',
              marginTop: '4px',
              padding: '4px 8px',
              backgroundColor: '#D1FAE5',
              borderRadius: '4px',
              display: 'inline-block'
            }}>
              🚀 Ready to receive realtime trade updates via postgres_changes
            </div>
          )}
        </div>

        {/* Proposal Ready Check */}
        {!proposal.isProposalReady() && (
          <div style={{ 
            marginBottom: '15px', 
            padding: '10px', 
            backgroundColor: '#FEF3C7', 
            border: '1px solid #FBBF24',
            borderRadius: '6px' 
          }}>
            <strong style={{ color: '#D97706' }}>⚠️ Proposal Not Ready</strong>
            <div style={{ fontSize: '12px', color: '#92400E', marginTop: '4px' }}>
              {proposal.isLoading() ? 'Loading proposal data from global context...' : 
               proposal.hasError() ? `Error: ${proposal.getErrorMessage()}` : 
               'Please load a proposal using the selector above'}
            </div>
          </div>
        )}

        {/* Wallet Connection Status */}
        <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: isConnected ? '#D1FAE5' : '#FEF3C7', borderRadius: '6px' }}>
          {isConnected ? (
            <div>
              <strong style={{ color: '#059669' }}>✅ Wallet Connected:</strong>
              <div style={{ fontSize: '14px', color: '#065F46', fontFamily: 'monospace', marginTop: '4px' }}>
                {connectedWalletAddress}
              </div>
              <div style={{ fontSize: '12px', color: '#065F46', marginTop: '4px' }}>
                Trade history will auto-subscribe to this address
              </div>
            </div>
          ) : (
            <div>
              <strong style={{ color: '#D97706' }}>⚠️ No Wallet Connected</strong>
              <div style={{ fontSize: '12px', color: '#92400E', marginTop: '4px' }}>
                Connect your wallet or use manual address input below
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => handleTradeSubscribe()}
            disabled={loading || (!connectedWalletAddress && !manualAddress) || !proposal.isProposalReady()}
            style={{
              padding: '6px 12px',
              backgroundColor: '#4F46E5',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: (connectedWalletAddress || manualAddress) && proposal.isProposalReady() ? 'pointer' : 'not-allowed',
              opacity: (connectedWalletAddress || manualAddress) && proposal.isProposalReady() ? 1 : 0.5
            }}
          >
            {loading ? 'Connecting...' : `Subscribe ${connectedWalletAddress ? '(Connected Wallet)' : '(Manual Address)'}`}
          </button>

          <button
            onClick={tradeHistory.unsubscribe}
            disabled={!isSubscribed}
            style={{
              padding: '6px 12px',
              backgroundColor: '#DC2626',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isSubscribed ? 'pointer' : 'not-allowed',
              opacity: isSubscribed ? 1 : 0.5
            }}
          >
            Unsubscribe
          </button>

          {strategyMethods?.resetNewTradesCount && (
            <button
              onClick={strategyMethods.resetNewTradesCount}
              style={{
                padding: '6px 12px',
                backgroundColor: '#8B5CF6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Reset Counter
            </button>
          )}
        </div>

        {/* Manual Address Input (fallback when no wallet connected) */}
        {!isConnected && (
          <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#F3F4F6', borderRadius: '6px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>
              Manual Address Input (Fallback):
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="Enter wallet address (0x...)"
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontFamily: 'monospace'
                }}
              />
              <button
                onClick={handleManualTest}
                disabled={!manualAddress || !proposal.isProposalReady()}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#6B7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: manualAddress && proposal.isProposalReady() ? 'pointer' : 'not-allowed',
                  opacity: manualAddress && proposal.isProposalReady() ? 1 : 0.5
                }}
              >
                Subscribe
              </button>
            </div>
          </div>
        )}

        {/* Current Monitoring Info */}
        {(connectedWalletAddress || manualAddress) && proposal.isProposalReady() && (
          <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '15px' }}>
            <strong>Monitoring:</strong> <code>{connectedWalletAddress || manualAddress}</code><br/>
            <strong>Proposal:</strong> <code>{proposal.proposalAddress}</code><br/>
            <strong>Market:</strong> {proposal.getMarketName()}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div style={{
            padding: '10px',
            backgroundColor: '#FEE2E2',
            border: '1px solid #FECACA',
            borderRadius: '6px',
            color: '#B91C1C',
            marginBottom: '15px'
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Trade Data Display */}
        <div>
          {data ? (
            <div>
              <h4 style={{ color: '#059669' }}>
                📈 Trade History ({data.trades?.length || 0} trades)
              </h4>
              
              {/* Stats */}
              {data.stats && (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
                  gap: '10px',
                  marginBottom: '15px',
                  fontSize: '14px'
                }}>
                  <div><strong>Total:</strong> {data.stats.totalTrades}</div>
                  <div><strong>New:</strong> {data.stats.newTradesCount}</div>
                  <div><strong>Updates:</strong> {data.stats.updatesReceived}</div>
                  <div><strong>Last:</strong> {data.stats.lastTradeTime ? new Date(data.stats.lastTradeTime).toLocaleTimeString() : 'None'}</div>
                </div>
              )}

              {/* Recent Trades */}
              {data.trades && data.trades.length > 0 ? (
                <div>
                  <h5>Recent Trades (showing latest 3):</h5>
                  {data.trades.slice(0, 3).map((trade, idx) => (
                    <div key={trade.id || idx} style={{
                      padding: '10px',
                      backgroundColor: idx === 0 ? '#D1FAE5' : '#F3F4F6',
                      border: idx === 0 ? '2px solid #10B981' : '1px solid #D1D5DB',
                      borderRadius: '6px',
                      marginBottom: '8px',
                      fontSize: '12px'
                    }}>
                      <div><strong>ID:</strong> {trade.id}</div>
                      <div><strong>Time:</strong> {new Date(trade.evt_block_time).toLocaleString()}</div>
                      <div><strong>Hash:</strong> <code>{trade.evt_tx_hash?.slice(0, 20)}...</code></div>
                      <div><strong>Amount0:</strong> {trade.amount0}</div>
                      <div><strong>Amount1:</strong> {trade.amount1}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ 
                  padding: '20px', 
                  textAlign: 'center', 
                  color: '#6B7280',
                  backgroundColor: '#F9FAFB',
                  borderRadius: '6px'
                }}>
                  No trades found for this address
                </div>
              )}
            </div>
          ) : (
            <div style={{ 
              padding: '20px', 
              textAlign: 'center', 
              color: '#6B7280' 
            }}>
              {connectedWalletAddress ? 'Click Subscribe to see trade data' : 'Please connect a wallet address'}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPoolCandles = () => {
    const { data, loading, error, connectionStatus, isSubscribed, lastUpdate, updateCount } = poolCandles;
    const strategyMethods = poolCandles.getStrategyMethods();

    return (
      <div>
        {/* Connection Status */}
        <div style={{ marginBottom: '15px' }}>
          <strong>Status:</strong> {getConnectionStatusBadge(connectionStatus)}
          {isSubscribed && <span style={{ marginLeft: '10px', color: '#059669' }}>📡 Subscribed</span>}
          {lastUpdate && (
            <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
              Last update: {lastUpdate.toLocaleTimeString()} ({updateCount} updates)
            </div>
          )}
          
          {/* Realtime Ready Indicator */}
          {connectionStatus === 'connected' && isSubscribed && (
            <div style={{
              fontSize: '12px',
              color: '#059669',
              marginTop: '4px',
              padding: '4px 8px',
              backgroundColor: '#D1FAE5',
              borderRadius: '4px',
              display: 'inline-block'
            }}>
              🚀 Ready to receive realtime candle updates via postgres_changes
            </div>
          )}
        </div>

        {/* Proposal Ready Check */}
        {!proposal.isProposalReady() && (
          <div style={{ 
            marginBottom: '15px', 
            padding: '10px', 
            backgroundColor: '#FEF3C7', 
            border: '1px solid #FBBF24',
            borderRadius: '6px' 
          }}>
            <strong style={{ color: '#D97706' }}>⚠️ Proposal Not Ready</strong>
            <div style={{ fontSize: '12px', color: '#92400E', marginTop: '4px' }}>
              Pool candles require proposal data to determine which pools to monitor. 
              Please load a proposal using the selector above.
            </div>
          </div>
        )}

        {/* Controls */}
        <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label><strong>Interval:</strong></label>
            <select
              value={interval}
              onChange={(e) => setInterval(Number(e.target.value))}
              style={{
                padding: '6px 8px',
                border: '1px solid #D1D5DB',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            >
              <option value={60000}>60000 (1 minute)</option>
              <option value={300000}>300000 (5 minutes)</option>
              <option value={3600000}>3600000 (1 hour)</option>
            </select>
          </div>

          <button
            onClick={handlePoolSubscribe}
            disabled={loading || !proposal.isProposalReady()}
            style={{
              padding: '6px 12px',
              backgroundColor: '#4F46E5',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: proposal.isProposalReady() ? 'pointer' : 'not-allowed',
              opacity: proposal.isProposalReady() ? 1 : 0.5
            }}
          >
            {loading ? 'Connecting...' : 'Subscribe'}
          </button>

          <button
            onClick={poolCandles.unsubscribe}
            disabled={!isSubscribed}
            style={{
              padding: '6px 12px',
              backgroundColor: '#DC2626',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isSubscribed ? 'pointer' : 'not-allowed',
              opacity: isSubscribed ? 1 : 0.5
            }}
          >
            Unsubscribe
          </button>

          {strategyMethods?.resetNewCandlesCount && (
            <button
              onClick={strategyMethods.resetNewCandlesCount}
              style={{
                padding: '6px 12px',
                backgroundColor: '#8B5CF6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Reset Counter
            </button>
          )}
        </div>

        {/* Current Proposal Info */}
        {proposal.isProposalReady() && (
          <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '15px' }}>
            <strong>Monitoring:</strong> Dynamic Pool Candles<br/>
            <strong>Market:</strong> {proposal.getMarketName()}<br/>
            <strong>Interval:</strong> <code>{interval}</code><br/>
            <strong>Pool Addresses:</strong> {proposal.getPoolAddresses().length} outcome tokens
            
            {/* WebSocket Subscription Details */}
            {isSubscribed && (
              <div style={{ 
                marginTop: '8px', 
                padding: '8px', 
                backgroundColor: '#F0F9FF', 
                borderRadius: '4px',
                fontSize: '12px'
              }}>
                <strong>🔗 WebSocket Monitoring:</strong><br/>
                • Table: <code>pool_candles</code><br/>
                • Event: <code>postgres_changes (*)</code><br/>
                • Filter: <code>interval=eq.{interval}</code><br/>
                • Pool Addresses: <code>{proposal.getPoolAddresses().slice(0, 2).map(addr => addr ? `${addr.slice(0, 6)}...` : 'N/A').join(', ')}</code><br/>
                <span style={{ color: '#059669', fontWeight: 'bold' }}>
                  ✅ Ready for INSERT/UPDATE/DELETE events (dynamic pools)
                </span>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div style={{
            padding: '10px',
            backgroundColor: '#FEE2E2',
            border: '1px solid #FECACA',
            borderRadius: '6px',
            color: '#B91C1C',
            marginBottom: '15px'
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Pool Candles Data Display */}
        <div>
          {data ? (
            <div>
              <h4 style={{ color: '#059669' }}>
                📊 Pool Candles ({data.totalPools || 0} pools)
              </h4>
              
              {/* Stats */}
              {data.stats && (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
                  gap: '10px',
                  marginBottom: '15px',
                  fontSize: '14px'
                }}>
                  <div><strong>Total:</strong> {data.stats.totalCandles}</div>
                  <div><strong>New:</strong> {data.stats.newCandlesCount}</div>
                  <div><strong>Pools:</strong> {data.stats.totalPools}</div>
                  <div><strong>Updates:</strong> {data.stats.updatesReceived}</div>
                </div>
              )}

              {/* Pool Data */}
              {data.poolIds && data.poolIds.length > 0 ? (
                <div>
                  <h5>Pool Candles by Pool (showing latest 10 per pool):</h5>
                  {data.poolIds.map((poolId, idx) => {
                    const poolData = data.candlesByPool[poolId];
                    const candles = poolData?.candles || [];
                    
                    // Use dynamic pool type detection instead of hardcoded addresses
                    const poolIndex = proposal.getPoolAddresses().findIndex(addr => 
                      poolId.includes(addr?.toLowerCase())
                    );
                    const poolTypeNames = ['YES_COMPANY', 'NO_COMPANY', 'YES_CURRENCY', 'NO_CURRENCY'];
                    const poolType = poolTypeNames[poolIndex] || 'UNKNOWN';
                    const isCompanyPool = poolType.includes('COMPANY');
                    
                    return (
                      <div key={poolId} style={{
                        padding: '15px',
                        backgroundColor: idx === 0 ? '#EBF4FF' : '#F0F9FF',
                        border: `2px solid ${isCompanyPool ? '#10B981' : '#EF4444'}`,
                        borderRadius: '8px',
                        marginBottom: '15px'
                      }}>
                        <div style={{ marginBottom: '10px' }}>
                          <h6 style={{ margin: '0 0 5px 0', color: isCompanyPool ? '#059669' : '#DC2626' }}>
                            🏛️ {poolType} Pool ({poolData?.count || 0} total candles)
                          </h6>
                          <div style={{ fontSize: '11px', color: '#6B7280', fontFamily: 'monospace' }}>
                            Pool ID: {poolId}
                          </div>
                        </div>
                        
                        {candles.length > 0 ? (
                          <div>
                            <div style={{ 
                              display: 'grid', 
                              gridTemplateColumns: 'auto 1fr 1fr 1fr', 
                              gap: '8px', 
                              fontSize: '11px',
                              fontWeight: 'bold',
                              borderBottom: '1px solid #D1D5DB',
                              paddingBottom: '5px',
                              marginBottom: '8px'
                            }}>
                              <div>Time</div>
                              <div>Price</div>
                              <div>Interval</div>
                              <div>ID</div>
                            </div>
                            
                            {candles.slice(0, 10).map((candle, candleIdx) => (
                              <div key={candle.id || candleIdx} style={{
                                display: 'grid',
                                gridTemplateColumns: 'auto 1fr 1fr 1fr',
                                gap: '8px',
                                fontSize: '10px',
                                padding: '4px',
                                backgroundColor: candleIdx === 0 ? (isCompanyPool ? '#D1FAE5' : '#FEE2E2') : 'transparent',
                                borderRadius: '4px',
                                marginBottom: '2px',
                                border: candleIdx === 0 ? `1px solid ${isCompanyPool ? '#10B981' : '#EF4444'}` : 'none'
                              }}>
                                <div style={{ fontSize: '9px' }}>
                                  {new Date(candle.timestamp * 1000).toLocaleTimeString()}
                                </div>
                                <div style={{ fontWeight: 'bold', color: isCompanyPool ? '#059669' : '#DC2626' }}>
                                  {candle.price ? candle.price.toFixed(6) : '0.000000'}
                                </div>
                                <div>{candle.interval || '60000'}</div>
                                <div style={{ fontFamily: 'monospace', fontSize: '9px' }}>{candle.id}</div>
                                
                                {candleIdx === 0 && data.stats?.newCandlesCount > 0 && (
                                  <div style={{
                                    gridColumn: '1 / -1',
                                    fontSize: '10px',
                                    color: '#059669',
                                    fontWeight: 'bold',
                                    marginTop: '2px',
                                    textAlign: 'center'
                                  }}>
                                    🆕 Latest candle (realtime update)
                                  </div>
                                )}
                              </div>
                            ))}
                            
                            {data.stats?.newCandlesCount > 0 && (
                              <div style={{
                                fontSize: '11px',
                                color: '#059669',
                                fontWeight: 'bold',
                                textAlign: 'center',
                                marginTop: '8px',
                                padding: '4px',
                                backgroundColor: '#D1FAE5',
                                borderRadius: '4px'
                              }}>
                                📊 {data.stats.newCandlesCount} new candle(s) received via realtime
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ 
                            textAlign: 'center', 
                            color: '#6B7280',
                            fontSize: '12px',
                            padding: '10px'
                          }}>
                            No candles available for this pool
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ 
                  padding: '20px', 
                  textAlign: 'center', 
                  color: '#6B7280',
                  backgroundColor: '#F9FAFB',
                  borderRadius: '6px'
                }}>
                  No pool candles found for interval {interval}
                </div>
              )}
            </div>
          ) : (
            <div style={{ 
              padding: '20px', 
              textAlign: 'center', 
              color: '#6B7280' 
            }}>
              Click Subscribe to see pool candles data
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ 
      padding: '20px', 
      border: '1px solid #e5e7eb', 
      borderRadius: '8px',
      backgroundColor: '#f9fafb'
    }}>
      {/* Dynamic Market Title */}
      <h3 style={{ marginTop: 0, color: '#111827' }}>
        🔥 {proposal.isProposalReady() ? proposal.getMarketName() : 'Realtime System'}
      </h3>
      
      {/* Global Proposal Status Display */}
      <div style={{ 
        marginBottom: '20px', 
        padding: '15px', 
        backgroundColor: '#F0F9FF', 
        border: '2px solid #3B82F6', 
        borderRadius: '8px' 
      }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#1E40AF' }}>
          🏛️ {proposal.getMarketName()}
        </h4>
        
        {/* Global Proposal Info (read-only display) */}
        {proposal.isProposalReady() ? (
          <div style={{ fontSize: '12px', color: '#1E40AF', marginBottom: '10px' }}>
            <div><strong>Proposal:</strong> <code>{proposal.proposalAddress}</code></div>
            <div><strong>Status:</strong> ✅ Using global proposal data</div>
            <div><strong>Tokens:</strong> {Object.keys(proposal.getTokens()).length} configured</div>
            <div style={{ 
              padding: '8px', 
              backgroundColor: '#EBF4FF', 
              border: '1px solid #3B82F6',
              borderRadius: '4px',
              marginTop: '8px',
              fontSize: '11px'
            }}>
              <strong>ℹ️ Note:</strong> Proposal selection is now managed globally above. 
              All realtime subscriptions use the same proposal.
            </div>
          </div>
        ) : proposal.isLoading() ? (
          <div style={{ fontSize: '12px', color: '#D97706', marginBottom: '10px' }}>
            ⏳ Loading proposal data from global context...
          </div>
        ) : proposal.hasError() ? (
          <div style={{ fontSize: '12px', color: '#DC2626', marginBottom: '10px' }}>
            ❌ Error: {proposal.getErrorMessage()}
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '10px' }}>
            ℹ️ No proposal loaded - Use the global selector above
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        borderBottom: '2px solid #e5e7eb', 
        marginBottom: '20px' 
      }}>
        <button
          onClick={() => setActiveTab('trades')}
          style={{
            padding: '12px 24px',
            border: 'none',
            backgroundColor: 'transparent',
            borderBottom: activeTab === 'trades' ? '2px solid #3B82F6' : '2px solid transparent',
            color: activeTab === 'trades' ? '#3B82F6' : '#6B7280',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: '500'
          }}
        >
          📈 Trade History
        </button>
        <button
          onClick={() => setActiveTab('candles')}
          style={{
            padding: '12px 24px',
            border: 'none',
            backgroundColor: 'transparent',
            borderBottom: activeTab === 'candles' ? '2px solid #3B82F6' : '2px solid transparent',
            color: activeTab === 'candles' ? '#3B82F6' : '#6B7280',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: '500'
          }}
        >
          📊 Pool Candles
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'trades' && renderTradeHistory()}
      {activeTab === 'candles' && renderPoolCandles()}

      {/* Debug Info - Enhanced with Global Context */}
      <details style={{ marginTop: '15px' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>🔍 Debug Info</summary>
        <pre style={{
          backgroundColor: '#F3F4F6',
          padding: '10px',
          borderRadius: '4px',
          fontSize: '12px',
          overflow: 'auto',
          marginTop: '8px'
        }}>
          {JSON.stringify({
            activeTab,
            globalProposal: {
              address: proposal.proposalAddress,
              isReady: proposal.isProposalReady(),
              isLoading: proposal.isLoading(),
              hasError: proposal.hasError(),
              error: proposal.getErrorMessage(),
              marketName: proposal.getMarketName(),
              tokenCount: Object.keys(proposal.getTokens()).length,
              poolAddresses: proposal.getPoolAddresses()
            },
            tradeHistory: {
              connectionStatus: tradeHistory.connectionStatus,
              isSubscribed: tradeHistory.isSubscribed,
              hasData: !!tradeHistory.data,
              lastUpdate: tradeHistory.lastUpdate?.toISOString(),
              updateCount: tradeHistory.updateCount
            },
            poolCandles: {
              connectionStatus: poolCandles.connectionStatus,
              isSubscribed: poolCandles.isSubscribed,
              hasData: !!poolCandles.data,
              lastUpdate: poolCandles.lastUpdate?.toISOString(),
              updateCount: poolCandles.updateCount
            }
          }, null, 2)}
        </pre>
      </details>
    </div>
  );
} 