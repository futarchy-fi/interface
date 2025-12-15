import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import MetaMaskLogin from './MetaMaskLogin';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nvhqdqtlsdboctqjcelq.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Gnosis Chain (xDai) configuration
const GNOSIS_CHAIN_ID = 100;
const GNOSIS_CHAIN_CONFIG = {
  chainId: `0x${GNOSIS_CHAIN_ID.toString(16)}`, // '0x64' in hex
  chainName: 'Gnosis Chain',
  nativeCurrency: {
    name: 'xDAI',
    symbol: 'xDAI',
    decimals: 18,
  },
  rpcUrls: ['https://rpc.gnosischain.com/'],
  blockExplorerUrls: ['https://gnosisscan.io/'],
};

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'system-ui, sans-serif',
  },
  header: {
    borderBottom: '1px solid #e5e7eb',
    paddingBottom: '15px',
    marginBottom: '20px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: '10px',
  },
  subtitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#374151',
    marginTop: '30px',
    marginBottom: '15px',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: '500',
    backgroundColor: '#10B981',
    color: 'white',
    marginLeft: '10px',
  },
  realtimeBadge: {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: '500',
    backgroundColor: '#3B82F6',
    color: 'white',
    marginLeft: '10px',
  },
  authBadge: {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: '500',
    backgroundColor: '#F59E0B',
    color: 'white',
    marginLeft: '10px',
  },
  walletBadge: {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: '500',
    backgroundColor: '#8B5CF6',
    color: 'white',
    marginLeft: '10px',
  },
  verifiedBadge: {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: '500',
    backgroundColor: '#059669',
    color: 'white',
    marginLeft: '10px',
  },
  userList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px',
  },
  userCard: {
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '16px',
    backgroundColor: '#f9fafb',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  loadingMessage: {
    padding: '40px',
    textAlign: 'center',
    fontSize: '18px',
    color: '#6B7280',
  },
  errorMessage: {
    padding: '20px',
    backgroundColor: '#FEE2E2',
    borderRadius: '8px',
    color: '#B91C1C',
    marginBottom: '20px',
  },
  successMessage: {
    padding: '12px',
    backgroundColor: '#D1FAE5',
    borderRadius: '8px',
    color: '#065F46',
    marginBottom: '15px',
  },
  detailsSummary: {
    cursor: 'pointer',
    padding: '8px 0',
    fontWeight: '500',
    color: '#4B5563',
  },
  jsonPre: {
    backgroundColor: '#F3F4F6',
    padding: '12px',
    borderRadius: '6px',
    overflowX: 'auto',
    fontSize: '12px',
  },
  refreshButton: {
    padding: '8px 16px',
    backgroundColor: '#4F46E5',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '14px',
    marginTop: '20px',
  },
  updatedAt: {
    fontSize: '14px',
    color: '#6B7280',
    marginTop: '8px',
  },
  buttonContainer: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    marginTop: '15px',
  },
  walletContainer: {
    marginTop: '20px',
    padding: '20px',
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    border: '1px solid #E5E7EB',
  },
  walletInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '10px',
    fontSize: '14px',
  },
  walletAddress: {
    fontFamily: 'monospace',
    padding: '8px',
    backgroundColor: '#F3F4F6',
    borderRadius: '4px',
    fontSize: '14px',
    wordBreak: 'break-all',
  },
  walletButton: {
    padding: '8px 16px',
    backgroundColor: '#8B5CF6', // Purple for wallet connection
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '14px',
    marginTop: '10px',
  },
  verifyButton: {
    padding: '8px 16px',
    backgroundColor: '#059669', // Green for verification
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '14px',
    marginTop: '10px',
  },
  linkContainer: {
    marginTop: '15px',
    padding: '15px',
    backgroundColor: '#EFF6FF',
    borderRadius: '8px',
    border: '1px solid #DBEAFE',
  },
  section: {
    marginTop: '20px',
    padding: '20px',
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    border: '1px solid #E5E7EB',
  },
  sectionHeading: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: '10px',
  },
  logo: {
    width: '24px',
    height: '24px',
    marginRight: '10px',
  },
  heading: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '20px',
  },
};

// --- Simple realtime pool_candles subscription component ---
function PoolCandlesRealtime({ interval = 60000 }) {
  const [candlesByPool, setCandlesByPool] = useState({}); // { pool_interval_id: { candles: [], count: 0 } }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch initial candles, grouped by pool_interval_id
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    const ALLOWED_ADDRESSES = [
      '0xF336F812Db1ad142F22A9A4dd43D40e64B478361', // YES pool
      '0xfbf1BE5CE2f9056dAaB1C368EC241ad7Be3507A8'  // NO pool
    ];
    supabase
      .from('pool_candles')
      .select('*')
      .eq('interval', interval)
      .in('address', ALLOWED_ADDRESSES)
      .order('timestamp', { ascending: false })
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          setError(error.message);
        } else {
          // Group by pool_interval_id
          const grouped = {};
          (data || []).forEach(candle => {
            const key = candle.pool_interval_id || 'unknown';
            if (!grouped[key]) grouped[key] = { candles: [], count: 0 };
            if (grouped[key].candles.length < 10) grouped[key].candles.push(candle);
            grouped[key].count += 1;
          });
          setCandlesByPool(grouped);
        }
        setLoading(false);
      });
    return () => { isMounted = false; };
  }, [interval]);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('realtime-pool-candles')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pool_candles',
          filter: `interval=eq.${interval}`
        },
        (payload) => {
          const ALLOWED_ADDRESSES = [
            '0xF336F812Db1ad142F22A9A4dd43D40e64B478361', // YES pool
            '0xfbf1BE5CE2f9056dAaB1C368EC241ad7Be3507A8'  // NO pool
          ];
          const newAddress = payload.new?.address?.toLowerCase();
          const oldAddress = payload.old?.address?.toLowerCase();
          const allowed = ALLOWED_ADDRESSES.map(a => a.toLowerCase());
          if (allowed.includes(newAddress) || allowed.includes(oldAddress)) {
            const poolKey = (payload.new?.pool_interval_id || payload.old?.pool_interval_id || 'unknown');
            setCandlesByPool(prev => {
              const group = prev[poolKey] || { candles: [], count: 0 };
              let newGroup = { ...group };
              if (payload.eventType === 'INSERT') {
                newGroup = {
                  candles: [payload.new, ...group.candles].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 10),
                  count: group.count + 1
                };
              } else if (payload.eventType === 'UPDATE') {
                newGroup = {
                  candles: group.candles.map(c => c.id === payload.new.id ? payload.new : c),
                  count: group.count
                };
              } else if (payload.eventType === 'DELETE') {
                newGroup = {
                  candles: group.candles.filter(c => c.id !== payload.old.id),
                  count: Math.max(0, group.count - 1)
                };
              }
              return { ...prev, [poolKey]: newGroup };
            });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [interval]);

  // Sort pool_interval_id keys for display
  const poolIds = Object.keys(candlesByPool).sort();

  return (
    <div style={{ marginTop: 24, padding: 16, background: '#F0F6FF', borderRadius: 8 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>
        Realtime pool_candles (interval={interval})<br />
        <span style={{ fontWeight: 400, fontSize: 13 }}>
          Organizado por <b>pool_interval_id</b> &mdash; cada seção mostra os 10 mais recentes
        </span>
      </div>
      {loading ? (
        <div style={{ color: '#6B7280' }}>Carregando...</div>
      ) : error ? (
        <div style={{ color: 'red' }}>Erro: {error}</div>
      ) : poolIds.length === 0 ? (
        <div>Nenhum candle encontrado.</div>
      ) : (
        <div>
          {poolIds.map(poolId => (
            <div key={poolId} style={{ marginBottom: 24, background: '#fff', borderRadius: 6, padding: 12, border: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: 500, color: '#2563eb', marginBottom: 4 }}>
                Pool Interval ID: <span style={{ fontFamily: 'monospace' }}>{poolId}</span> &mdash; <span style={{ color: '#059669' }}>Total: {candlesByPool[poolId].count}</span>
              </div>
              <ol style={{ paddingLeft: 18 }}>
                {candlesByPool[poolId].candles.map((candle, idx) => (
                  <li key={candle.id || idx}>
                    <pre style={{ background: '#F3F4F6', padding: 8, borderRadius: 4, fontSize: 12, marginBottom: 8 }}>
                      {JSON.stringify(candle, null, 2)}
                    </pre>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



// --- Main SupabaseComponent ---
const SupabaseComponent = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);
  const [session, setSession] = useState(null);
  const [useAuth, setUseAuth] = useState(false);
  
  // Ethereum wallet states
  const [walletAddress, setWalletAddress] = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [walletConnecting, setWalletConnecting] = useState(false);
  const [walletError, setWalletError] = useState(null);
  
  // Wallet verification states
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState(null);
  const [linkedUserData, setLinkedUserData] = useState(null);
  
  // POOL CANDLES STATE
  const [poolCandles, setPoolCandles] = useState([]);
  const [loadingPoolCandles, setLoadingPoolCandles] = useState(false);
  const [errorPoolCandles, setErrorPoolCandles] = useState(null);

  // TRADE HISTORY REALTIME STATE
  const [tradeHistory, setTradeHistory] = useState([]);
  const [loadingTradeHistory, setLoadingTradeHistory] = useState(false);
  const [errorTradeHistory, setErrorTradeHistory] = useState(null);
  const [tradeHistoryRealtimeEnabled, setTradeHistoryRealtimeEnabled] = useState(true);
  const [lastTradeHistoryUpdate, setLastTradeHistoryUpdate] = useState(new Date());
  const [tradeHistoryChannel, setTradeHistoryChannel] = useState(null);
  const [realtimeStats, setRealtimeStats] = useState({
    totalTrades: 0,
    newTradesCount: 0,
    lastTradeTime: null,
    connectionStatus: 'disconnected'
  });

  // Company Info Function State
  const [companyInfo, setCompanyInfo] = useState(null);
  const [loadingCompanyInfo, setLoadingCompanyInfo] = useState(false);
  const [errorCompanyInfo, setErrorCompanyInfo] = useState(null);

  // Market Events State
  const [marketEvents, setMarketEvents] = useState([]);
  const [loadingMarketEvents, setLoadingMarketEvents] = useState(false);
  const [errorMarketEvents, setErrorMarketEvents] = useState(null);

  // Function to fetch data from Supabase
  const fetchData = async () => {
    try {
      console.log('Fetching data from Supabase');
      const { data, error } = await supabase
        .from('users')
        .select('*')
    

      if (error) throw error;
      console.log('Data fetched successfully:', data);
      setData(data);
      setLoading(false);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error.message);
      setLoading(false);
    }
  };

  // Function to fetch market events by company_id
  const fetchMarketEventsByCompanyId = async (companyId = 9) => {
    setLoadingMarketEvents(true);
    setErrorMarketEvents(null);
    setMarketEvents([]);

    console.log(`Fetching market events for company_id: ${companyId}`);
    try {
      const { data, error } = await supabase
        .from("market_event")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error('Error fetching market events:', error);
        throw error;
      }

      console.log('Market events fetched successfully:', data);
      setMarketEvents(data);
    } catch (err) {
      console.error('Detailed error fetching market events:', err);
      setErrorMarketEvents(err.message || 'Failed to fetch market events.');
    } finally {
      setLoadingMarketEvents(false);
    }
  };

  // COMPREHENSIVE TRADE HISTORY REALTIME FUNCTION
  const fetchAllTradeHistoryRealtime = async (targetAddress = null) => {
    const addressToQuery = targetAddress || walletAddress;
    
    console.log('📊 === INITIAL DATA FETCH START ===');
    console.log('🔍 Fetching for address:', addressToQuery);
    
    if (!addressToQuery) {
      console.log('❌ No wallet address available for trade history fetch');
      setTradeHistory([]);
      setRealtimeStats(prev => ({ ...prev, totalTrades: 0, connectionStatus: 'no_address' }));
      return;
    }

    setLoadingTradeHistory(true);
    setErrorTradeHistory(null);
    
    try {
      console.log(`🔍 Fetching ALL trade history for address: ${addressToQuery}`);
      console.log('🔍 Query filter:', `user_address=eq.${addressToQuery.toLowerCase()} AND proposal_id=eq.0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919`);
      
      // Fetch ALL trades for this address with proposal_id filter
      const { data, error, count } = await supabase
        .from('trade_history')
        .select('*', { count: 'exact' })
        .eq('user_address', addressToQuery.toLowerCase())
        .eq('proposal_id', '0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919') // Filter by specific proposal
        .order('evt_block_time', { ascending: false });
      
      if (error) throw error;
      
      console.log(`✅ === INITIAL DATA FETCH SUCCESS ===`);
      console.log('📊 Trades fetched:', data.length);
      console.log('📊 Total count:', count);
      console.log('📊 First trade:', data[0]);
      console.log('📊 Last trade:', data[data.length - 1]);
      console.log('📊 All trade IDs:', data.map(t => t.id));
      
      setTradeHistory(data);
      setLastTradeHistoryUpdate(new Date());
      
      // Update stats
      setRealtimeStats(prev => ({
        ...prev,
        totalTrades: count || data.length,
        lastTradeTime: data.length > 0 ? data[0].evt_block_time : null,
        connectionStatus: 'fetched'
      }));
      
      console.log('📊 === INITIAL DATA FETCH COMPLETE ===');
      
    } catch (error) {
      console.error('❌ === INITIAL DATA FETCH ERROR ===');
      console.error('📋 Error details:', error);
      console.error('📋 Error message:', error.message);
      setErrorTradeHistory(error.message);
      setRealtimeStats(prev => ({ ...prev, connectionStatus: 'error' }));
    } finally {
      setLoadingTradeHistory(false);
    }
  };

  // SETUP REALTIME SUBSCRIPTION FOR TRADE HISTORY
  const setupTradeHistoryRealtime = (targetAddress = null) => {
    const addressToQuery = targetAddress || walletAddress;
    
    console.log('🚀 === REALTIME SETUP START ===');
    console.log('🔍 Target address:', addressToQuery);
    console.log('🔍 Realtime enabled:', tradeHistoryRealtimeEnabled);
    
    if (!tradeHistoryRealtimeEnabled || !addressToQuery) {
      console.log('⏸️ Realtime disabled or no address - cleaning up existing channel');
      if (tradeHistoryChannel) {
        supabase.removeChannel(tradeHistoryChannel);
        setTradeHistoryChannel(null);
        setRealtimeStats(prev => ({ ...prev, connectionStatus: 'disconnected' }));
      }
      return;
    }

    // Clean up existing channel first
    if (tradeHistoryChannel) {
      console.log('🧹 Cleaning up existing trade history channel');
      supabase.removeChannel(tradeHistoryChannel);
    }

    console.log(`🔗 Setting up trade history realtime for: ${addressToQuery} with proposal filter`);
    console.log('🔍 DEBUG: Supabase URL:', supabaseUrl);
    console.log('🔍 DEBUG: Supabase Key exists:', !!supabaseKey);
    console.log('🔍 DEBUG: Filter will be:', `user_address=eq.${addressToQuery.toLowerCase()}.and.proposal_id=eq.0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919`);

    // Create new realtime channel with simple approach
    console.log('📡 Creating WebSocket channel...');
    const channel = supabase
      .channel(`trades-${addressToQuery.slice(-6)}`) // Channel name is just an identifier - can be anything unique
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'trade_history',
          filter: `user_address=eq.${addressToQuery.toLowerCase()}`
        },
        (payload) => {
          console.log('🔥 === WEBSOCKET DATA RECEIVED ===');
          console.log('📊 Full payload:', JSON.stringify(payload, null, 2));
          console.log('📋 Event type:', payload.eventType);
          console.log('📋 Table:', payload.table);
          console.log('📋 Schema:', payload.schema);
          console.log('📋 New data:', payload.new);
          console.log('📋 Old data:', payload.old);
          console.log('📋 Timestamp:', new Date().toISOString());
          console.log('✅ Update matches server filters - processing...');
          
          setLastTradeHistoryUpdate(new Date());
          
          // Update trade history state directly based on event type
          if (payload.eventType === 'INSERT' && payload.new) {
            console.log('➕ Processing INSERT event');
            console.log('📋 New trade data:', payload.new);
            // Add new trade to the beginning of the array
            setTradeHistory(prev => {
              console.log('📊 Current trade history length:', prev.length);
              const newHistory = [payload.new, ...prev];
              console.log('📊 New trade history length:', newHistory.length);
              return newHistory;
            });
            setRealtimeStats(prev => ({
              ...prev,
              newTradesCount: prev.newTradesCount + 1,
              totalTrades: prev.totalTrades + 1,
              lastTradeTime: payload.new.evt_block_time,
              connectionStatus: 'live'
            }));
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            console.log('✏️ Processing UPDATE event');
            console.log('📋 Updated trade data:', payload.new);
            // Update existing trade
            setTradeHistory(prev => 
              prev.map(trade => {
                if (trade.id === payload.new.id) {
                  console.log('🔄 Updating trade with ID:', trade.id);
                  return payload.new;
                }
                return trade;
              })
            );
            setRealtimeStats(prev => ({
              ...prev,
              lastTradeTime: payload.new.evt_block_time,
              connectionStatus: 'live'
            }));
          } else if (payload.eventType === 'DELETE' && payload.old) {
            console.log('🗑️ Processing DELETE event');
            console.log('📋 Deleted trade data:', payload.old);
            // Remove deleted trade
            setTradeHistory(prev => {
              const filtered = prev.filter(trade => trade.id !== payload.old.id);
              console.log('📊 Removed trade, new length:', filtered.length);
              return filtered;
            });
            setRealtimeStats(prev => ({
              ...prev,
              totalTrades: Math.max(0, prev.totalTrades - 1),
              connectionStatus: 'live'
            }));
          }
          console.log('🔥 === WEBSOCKET PROCESSING COMPLETE ===');
        }
      )
      .on('presence', { event: 'sync' }, () => {
        console.log('✅ === WEBSOCKET PRESENCE SYNCED ===');
        console.log('📡 Realtime connection established successfully');
        console.log('🔍 Channel state:', channel.state);
        console.log('🔍 Channel topic:', channel.topic);
        setRealtimeStats(prev => ({ ...prev, connectionStatus: 'connected' }));
      })
      .on('error', (err) => {
        console.error('❌ === WEBSOCKET ERROR ===');
        console.error('📋 Error details:', err);
        console.error('📋 Error message:', err.message);
        console.error('📋 Error code:', err.code);
        setErrorTradeHistory(`Realtime error: ${err.message}`);
        setRealtimeStats(prev => ({ ...prev, connectionStatus: 'error' }));
      })
      .subscribe((status, err) => {
        console.log('📡 === WEBSOCKET SUBSCRIPTION STATUS ===');
        console.log('📋 Status:', status);
        console.log('📋 Timestamp:', new Date().toISOString());
        if (err) {
          console.error('❌ Subscription error:', err);
          setErrorTradeHistory(`Subscription error: ${err.message}`);
        }
        setRealtimeStats(prev => ({ 
          ...prev, 
          connectionStatus: status === 'SUBSCRIBED' ? 'connected' : status.toLowerCase() 
        }));
        
        if (status === 'SUBSCRIBED') {
          console.log('🎉 === WEBSOCKET FULLY CONNECTED ===');
          console.log('🔍 Listening for changes on trade_history table');
          console.log('🔍 Filter active:', `user_address=eq.${addressToQuery.toLowerCase()}.and.proposal_id=eq.0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919`);
        }
      });

    console.log('📡 WebSocket channel created, storing reference...');
    setTradeHistoryChannel(channel);
    
    // Add debugging timeout to check connection after 5 seconds
    setTimeout(() => {
      console.log('🔍 === 5-SECOND CONNECTION CHECK ===');
      console.log('🔍 Channel state:', channel.state);
      console.log('🔍 Channel topic:', channel.topic);
      console.log('🔍 Channel bindings:', channel.bindings);
      console.log('🔍 Connection status:', realtimeStats.connectionStatus);
    }, 5000);
    
    console.log('🚀 === REALTIME SETUP COMPLETE ===');
    return channel;
  };

  // Check if user's wallet is verified
  const checkWalletVerification = async (userId, address) => {
    try {
      const { data, error } = await supabase
        .from('wallet_associations')
        .select('*')
        .match({ user_id: userId, wallet_address: address.toLowerCase() })
        .single();
      
      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "row not found" error, which is expected if not verified
        console.error('Error checking verification:', error);
        return false;
      }
      
      if (data) {
        setLinkedUserData(data);
        setIsVerified(true);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error in verification check:', error);
      return false;
    }
  };

  // Generate a nonce and message for signing
  const generateSignatureMessage = (address, userId) => {
    const timestamp = new Date().toISOString();
    return `Please sign this message to verify your wallet ownership:\n\nWallet: ${address}\nUser ID: ${userId}\nTimestamp: ${timestamp}`;
  };

  // Verify wallet ownership by signing a message
  const verifyWalletOwnership = async () => {
    if (!walletAddress || !session) {
      setWalletError('You need both a connected wallet and to be signed in to verify ownership');
      return;
    }
    
    setIsVerifying(true);
    setWalletError(null);
    
    try {
      // First check if already verified
      const isAlreadyVerified = await checkWalletVerification(session.user.id, walletAddress);
      
      if (isAlreadyVerified) {
        setVerificationMessage('This wallet is already verified for your account!');
        setIsVerifying(false);
        return;
      }
      
      // Generate message to sign
      const message = generateSignatureMessage(walletAddress, session.user.id);
      console.log('Message to sign:', message);
      
      // Get provider and signer
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      // Request signature
      const signature = await signer.signMessage(message);
      console.log('Signature:', signature);
      
      // Verify the signature on-chain
      const signerAddress = ethers.utils.verifyMessage(message, signature);
      console.log('Recovered address:', signerAddress);
      
      // Verify that the recovered address matches the connected address
      if (signerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new Error('Signature verification failed: address mismatch');
      }
      
      // Store the verification in Supabase
      const { data, error } = await supabase
        .from('wallet_associations')
        .insert([
          {
            user_id: session.user.id,
            wallet_address: walletAddress.toLowerCase(),
            signature: signature,
            message: message,
            chain_id: chainId
          }
        ]);
        
      if (error) {
        // If the insert fails, check if the table exists
        if (error.code === '42P01') { // Relation does not exist
          console.log('Creating wallet_associations table...');
          
          // Try to create the table
          const { error: createError } = await supabase.rpc('create_wallet_associations_table');
          
          if (createError) {
            throw new Error(`Failed to create table: ${createError.message}`);
          }
          
          // Try insert again
          const { data: retryData, error: retryError } = await supabase
            .from('wallet_associations')
            .insert([
              {
                user_id: session.user.id,
                wallet_address: walletAddress.toLowerCase(),
                signature: signature,
                message: message,
                chain_id: chainId
              }
            ]);
            
          if (retryError) throw retryError;
          setLinkedUserData(retryData);
        } else {
          throw error;
        }
      } else {
        setLinkedUserData(data);
      }
      
      setIsVerified(true);
      setVerificationMessage('Wallet successfully verified and linked to your account!');
      
    } catch (error) {
      console.error('Error verifying wallet ownership:', error);
      setWalletError(`Verification failed: ${error.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  // Check if MetaMask is installed
  const checkIfMetaMaskInstalled = () => {
    const { ethereum } = window;
    return Boolean(ethereum && ethereum.isMetaMask);
  };

  // Function to add Gnosis Chain to MetaMask
  const addGnosisChainToMetaMask = async () => {
    try {
      if (!checkIfMetaMaskInstalled()) {
        throw new Error('MetaMask is not installed');
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      
      try {
        await provider.send('wallet_addEthereumChain', [GNOSIS_CHAIN_CONFIG]);
        console.log('Gnosis Chain added to MetaMask');
      } catch (addError) {
        // If user rejects or chain already exists
        console.log('Failed to add Gnosis Chain or it already exists:', addError);
      }
      
      return provider;
    } catch (error) {
      console.error('Error adding Gnosis Chain to MetaMask:', error);
      setWalletError(error.message);
      throw error;
    }
  };

  // Connect to MetaMask and switch to Gnosis Chain
  const connectWallet = async () => {
    setWalletConnecting(true);
    setWalletError(null);
    
    try {
      if (!checkIfMetaMaskInstalled()) {
        throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
      }
      
      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const account = accounts[0];
      
      // Add Gnosis Chain to MetaMask and get provider
      const provider = await addGnosisChainToMetaMask();
      
      // Switch to Gnosis Chain
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: GNOSIS_CHAIN_CONFIG.chainId }],
        });
      } catch (switchError) {
        console.error('Error switching to Gnosis Chain:', switchError);
        // If user rejected the request, don't treat as error
        if (switchError.code !== 4001) {
          throw switchError;
        }
      }
      
      // Get current chain ID
      const network = await provider.getNetwork();
      setChainId(network.chainId);
      
      // Get account balance
      const balance = await provider.getBalance(account);
      const formattedBalance = ethers.utils.formatEther(balance);
      
      setWalletAddress(account);
      setWalletBalance(formattedBalance);
      console.log(`Connected to wallet: ${account} with balance: ${formattedBalance} xDAI`);
      
      // If user is already signed in, check if this wallet is verified
      if (session) {
        await checkWalletVerification(session.user.id, account);
      }
      
    } catch (error) {
      console.error('Error connecting to wallet:', error);
      setWalletError(error.message);
    } finally {
      setWalletConnecting(false);
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    setWalletAddress(null);
    setWalletBalance(null);
    setChainId(null);
    setIsVerified(false);
    setLinkedUserData(null);
    console.log('Wallet disconnected');
  };

  // Listen for chain changes
  useEffect(() => {
    if (window.ethereum) {
      const handleChainChanged = (chainId) => {
        const chainIdNumber = parseInt(chainId, 16);
        setChainId(chainIdNumber);
        console.log(`Chain changed to: ${chainIdNumber}`);
        
        // If the chain was changed to something other than Gnosis, display a warning
        if (chainIdNumber !== GNOSIS_CHAIN_ID && walletAddress) {
          setWalletError(`Warning: Connected to chain ID ${chainIdNumber}, but Gnosis Chain (ID 100) is recommended`);
        } else {
          setWalletError(null);
        }
      };
      
      const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
          // User disconnected their wallet
          disconnectWallet();
        } else if (walletAddress !== accounts[0]) {
          setWalletAddress(accounts[0]);
          setIsVerified(false);
          console.log(`Account changed to: ${accounts[0]}`);
          
          // If user is signed in, check if new wallet is verified
          if (session) {
            checkWalletVerification(session.user.id, accounts[0]);
          }
        }
      };
      
      window.ethereum.on('chainChanged', handleChainChanged);
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      
      return () => {
        window.ethereum.removeListener('chainChanged', handleChainChanged);
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, [walletAddress, session]);

  // Try to sign in anonymously with Supabase
  const signInAnonymously = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      
      console.log('Anonymous sign-in successful:', data);
      setSession(data.session);
      setUseAuth(true);
      
      // If wallet is connected, check if it's verified
      if (walletAddress) {
        await checkWalletVerification(data.session.user.id, walletAddress);
      }
      
      await fetchData();
    } catch (error) {
      console.error('Error signing in anonymously:', error);
      setError(error.message);
      setLoading(false);
    }
  };

  // Sign out from Supabase
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUseAuth(false);
      setIsVerified(false);
      setLinkedUserData(null);
      console.log('Signed out successfully');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Check for existing Supabase session on component mount
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        console.log('Found existing session');
        setSession(data.session);
        
        // If wallet is already connected, check verification
        if (walletAddress) {
          await checkWalletVerification(data.session.user.id, walletAddress);
        }
      }
    };
    
    checkSession();
    // Always fetch data on initial load regardless of auth status
    fetchData();
  }, []);

  // TRADE HISTORY REALTIME MANAGEMENT
  useEffect(() => {
    setupTradeHistoryRealtime();
    
    // Cleanup on unmount
    return () => {
      if (tradeHistoryChannel) {
        console.log('🧹 Component unmount - cleaning up trade history channel');
        supabase.removeChannel(tradeHistoryChannel);
      }
    };
  }, [tradeHistoryRealtimeEnabled, walletAddress]);

  // FETCH TRADE HISTORY WHEN WALLET CONNECTS OR CHANGES
  useEffect(() => {
    if (walletAddress) {
      console.log(`👛 Wallet connected: ${walletAddress} - fetching trade history`);
      fetchAllTradeHistoryRealtime();
      // Reset new trades counter when wallet changes
      setRealtimeStats(prev => ({ ...prev, newTradesCount: 0 }));
    } else {
      console.log('👛 No wallet - clearing trade history');
      setTradeHistory([]);
      setRealtimeStats({
        totalTrades: 0,
        newTradesCount: 0,
        lastTradeTime: null,
        connectionStatus: 'no_address'
      });
    }
  }, [walletAddress]);

  // Set up realtime subscription for Supabase
  useEffect(() => {
    if (!realtimeEnabled) return;

    // Enable realtime for the users table
    const channel = supabase.channel('users-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
        },
        (payload) => {
          console.log('Realtime update received:', payload);
          // Refresh the data when there's a change
          fetchData();
        }
      )
      .subscribe();

    // Cleanup function to remove subscription
    return () => {
      supabase.removeChannel(channel);
    };
  }, [realtimeEnabled]);

  const toggleRealtime = () => {
    setRealtimeEnabled(!realtimeEnabled);
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchData();
  };

  // Fetch pool_candles from Supabase
  const fetchPoolCandles = async () => {
    setLoadingPoolCandles(true);
    setErrorPoolCandles(null);
    try {
      const { data, error } = await supabase
        .from('pool_candles')
        .select('*')
        .eq('address', '0x14C89bDd16F08065d3B5Bc990A6011135B52421C'); // Added filter here
      
      if (error) throw error;
      setPoolCandles(data);
    } catch (error) {
      setErrorPoolCandles(error.message);
    } finally {
      setLoadingPoolCandles(false);
    }
  };

  // TRADE HISTORY CONTROL FUNCTIONS
  const toggleTradeHistoryRealtime = () => {
    const newState = !tradeHistoryRealtimeEnabled;
    setTradeHistoryRealtimeEnabled(newState);
    console.log(`🔄 Trade history realtime toggled: ${newState ? 'ENABLED' : 'DISABLED'}`);
  };

  const handleTradeHistoryRefresh = () => {
    console.log('🔄 Manual trade history refresh requested');
    setLoadingTradeHistory(true);
    fetchAllTradeHistoryRealtime();
  };

  const resetTradeHistoryStats = () => {
    setRealtimeStats(prev => ({ ...prev, newTradesCount: 0 }));
    console.log('📊 Trade history stats reset');
  };

  // Function to manually test realtime with a specific address
  const testTradeHistoryWithAddress = async (testAddress) => {
    if (!testAddress) {
      alert('Please enter a valid address');
      return;
    }
    console.log(`🧪 Testing trade history with address: ${testAddress}`);
    await fetchAllTradeHistoryRealtime(testAddress);
    setupTradeHistoryRealtime(testAddress);
  };

  // DEBUGGING FUNCTIONS FOR REALTIME
  const debugRealtimeConnection = () => {
    console.log('🔍 === REALTIME DEBUG INFO ===');
    console.log('Supabase URL:', supabaseUrl);
    console.log('Supabase Key exists:', !!supabaseKey);
    console.log('Realtime enabled:', tradeHistoryRealtimeEnabled);
    console.log('Wallet address:', walletAddress);
    console.log('Channel exists:', !!tradeHistoryChannel);
    console.log('Channel state:', tradeHistoryChannel?.state);
    console.log('Channel topic:', tradeHistoryChannel?.topic);
    console.log('Connection status:', realtimeStats.connectionStatus);
    console.log('=== END DEBUG INFO ===');
  };

  const testRealtimeWithManualInsert = async () => {
    if (!walletAddress) {
      alert('Please connect your wallet first');
      return;
    }
    
    console.log('🧪 Testing realtime with manual insert...');
    
    // Try to insert a test record (this will fail if you don't have write permissions, but it will test the connection)
    try {
      const testRecord = {
        user_address: walletAddress.toLowerCase(),
        proposal_id: '0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919',
        amount0: '1000000000000000000',
        amount1: '-500000000000000000',
        pool_id: '0x67750A4c9E8d4987286DF84d351bAE8fC9EeF865',
        evt_block_number: 99999999,
        evt_block_time: new Date().toISOString(),
        token0: '0x839454be590e3f6f593ebb38179388d19f2e9cb0',
        token1: '0xaf204776c7245bf4147c2612bf6e5972ee483701',
        evt_tx_hash: `0xtest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
      
      const { data, error } = await supabase
        .from('trade_history')
        .insert([testRecord]);
        
      if (error) {
        console.log('❌ Insert failed (expected if no write permissions):', error.message);
        alert(`Insert test failed: ${error.message}\n\nThis is normal if you don't have write permissions. The realtime connection should still work for existing data changes.`);
      } else {
        console.log('✅ Test record inserted successfully:', data);
        alert('Test record inserted! You should see a realtime update.');
      }
    } catch (err) {
      console.error('❌ Test insert error:', err);
      alert(`Test error: ${err.message}`);
    }
  };

  const checkSupabaseRealtimeStatus = async () => {
    try {
      console.log('🔍 Checking Supabase realtime status...');
      
      // Test basic connection
      const { data, error } = await supabase
        .from('trade_history')
        .select('count')
        .limit(1);
        
      if (error) {
        console.error('❌ Basic query failed:', error);
        setErrorTradeHistory(`Connection test failed: ${error.message}`);
        return false;
      }
      
      console.log('✅ Basic Supabase connection working');
      
      // Check if realtime is enabled on the table
      console.log('ℹ️ To enable realtime:');
      console.log('1. Go to Supabase Dashboard');
      console.log('2. Database > Table Editor');
      console.log('3. Select "trade_history" table');
      console.log('4. Click "..." menu > Enable Realtime');
      
      return true;
    } catch (err) {
      console.error('❌ Connection check failed:', err);
      setErrorTradeHistory(`Connection check failed: ${err.message}`);
      return false;
    }
  };

  // Alternative simpler realtime setup for debugging
  const setupSimpleRealtimeTest = () => {
    console.log('🧪 Setting up SIMPLE realtime test (no filters)...');
    
    if (tradeHistoryChannel) {
      supabase.removeChannel(tradeHistoryChannel);
    }

    const channel = supabase
      .channel('simple_test_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trade_history'
          // NO FILTERS - listen to ALL changes
        },
        (payload) => {
          console.log('🔥 SIMPLE REALTIME UPDATE (NO FILTERS):', payload);
          alert('🔥 Realtime working! Got update: ' + payload.eventType);
        }
      )
      .subscribe((status) => {
        console.log('📡 Simple realtime status:', status);
        if (status === 'SUBSCRIBED') {
          alert('✅ Simple realtime connected! Try inserting data in Supabase dashboard.');
        }
      });

    setTradeHistoryChannel(channel);
  };

  // Alternative function using fetch directly (backup method)
  // ✅ THIS METHOD WORKS - Uses direct fetch API that correctly sends the body
  const fetchCompanyInfoByIdDirect = async (id = 9) => {
    const companyId = id || 9;
    
    setLoadingCompanyInfo(true);
    setErrorCompanyInfo(null);
    setCompanyInfo(null);

    console.log(`Direct fetch to company-info with id: ${companyId}`);
    
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/company-info`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({ id: companyId })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('Direct fetch response:', data);
      setCompanyInfo(data);
    } catch (err) {
      console.error('Error with direct fetch:', err);
      setErrorCompanyInfo(err.message || 'Failed to fetch company info with direct method.');
    } finally {
      setLoadingCompanyInfo(false);
    }
  };

  // ❌ ISSUE: Supabase client method - NOT sending body correctly
  // The supabase.functions.invoke() method has problems sending the request body
  // Even with JSON.stringify(), the body is not being sent (content-length: 0)
  // Function to call the 'company-info' Supabase Edge Function
  // const fetchCompanyInfoById = async (id = 9) => {
  //   // Default to ID 9 if no ID provided
  //   const companyId = id || 9;
  //   
  //   setLoadingCompanyInfo(true);
  //   setErrorCompanyInfo(null);
  //   setCompanyInfo(null);
  //
  //   console.log(`Calling Supabase function 'company-info' with id: ${companyId}`);
  //   console.log('Request body:', JSON.stringify({ id: companyId }));
  //   
  //   try {
  //     const { data, error } = await supabase.functions.invoke('company-info', {
  //       body: JSON.stringify({ id: companyId }),
  //       headers: {
  //         'Authorization': `Bearer ${supabaseKey}`,
  //         'Content-Type': 'application/json'
  //       }
  //     });
  //
  //     if (error) {
  //       console.error('Error invoking Supabase function:', error);
  //       
  //       // If the error is about missing ID, retry with default ID 9
  //       if (error.message && error.message.toLowerCase().includes('missing id')) {
  //         console.log('Missing ID error detected, retrying with default ID 9...');
  //         if (companyId !== 9) {
  //           // Recursive call with ID 9 if we weren't already using it
  //           return await fetchCompanyInfoById(9);
  //         }
  //       }
  //       
  //       throw error;
  //     }
  //
  //     console.log('Supabase function response:', data);
  //     setCompanyInfo(data);
  //   } catch (err) {
  //     console.error('Detailed error calling company-info function:', err);
  //     setErrorCompanyInfo(err.message || 'Failed to fetch company info.');
  //   } finally {
  //     setLoadingCompanyInfo(false);
  //   }
  // };

  if (loading) return <div style={styles.loadingMessage}>Loading data from Supabase...</div>;
  if (error) return <div style={styles.errorMessage}>Error: {error}</div>;

  const renderUserData = (item) => {
    // Check if the item has a data field (jsonb structure)
    if (item.data && typeof item.data === 'object') {
      return (
        <div>
          <p><strong>ID:</strong> {item.id}</p>
          <p><strong>Name:</strong> {item.data.name || 'N/A'}</p>
          <p><strong>Balance:</strong> {item.data.balance || '0.00'}</p>
          <p><strong>Created:</strong> {item.data.created_at || 'N/A'}</p>
          <details>
            <summary style={styles.detailsSummary}>Full JSON Data</summary>
            <pre style={styles.jsonPre}>{JSON.stringify(item.data, null, 2)}</pre>
          </details>
        </div>
      );
    } else {
      // Handle flat structure or other formats
      return (
        <div>
          <p><strong>ID:</strong> {item.id || 'N/A'}</p>
          <p><strong>Name:</strong> {item.name || 'N/A'}</p>
          <details>
            <summary style={styles.detailsSummary}>Full Data</summary>
            <pre style={styles.jsonPre}>{JSON.stringify(item, null, 2)}</pre>
          </details>
        </div>
      );
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={styles.logo}>
          <path fillRule="evenodd" clipRule="evenodd" d="M21.0002 12C21.0002 16.9706 16.9708 21 12.0002 21C7.02968 21 3.00024 16.9706 3.00024 12C3.00024 7.02944 7.02968 3 12.0002 3C16.9708 3 21.0002 7.02944 21.0002 12ZM12.0002 13.9982C10.3434 13.9982 9.00024 12.6551 9.00024 10.9982C9.00024 9.34139 10.3434 7.99824 12.0002 7.99824C13.6571 7.99824 15.0002 9.34139 15.0002 10.9982C15.0002 11.4835 15.4479 11.9313 15.9333 11.9313C16.4186 11.9313 16.8663 11.4835 16.8663 10.9982C16.8663 8.36407 14.6344 6.13211 12.0002 6.13211C9.36607 6.13211 7.13411 8.36407 7.13411 10.9982C7.13411 13.6324 9.36607 15.8644 12.0002 15.8644C12.4855 15.8644 12.9333 15.4166 12.9333 14.9313C12.9333 14.4459 12.4855 13.9982 12.0002 13.9982Z" fill="#3ECF8E"/>
        </svg>
        Supabase Demo
      </h1>
      
      <div style={styles.header}>
        <h2 style={styles.title}>Supabase & Web3 Integration Demo</h2>
        <p>
          Connected to: <code>{supabaseUrl}</code>
          {!session && <span style={styles.statusBadge}>Using Public Access</span>}
          {session && <span style={styles.authBadge}>Signed In Anonymously</span>}
          {realtimeEnabled && <span style={styles.realtimeBadge}>Realtime Updates</span>}
          {walletAddress && <span style={styles.walletBadge}>Wallet Connected</span>}
          {isVerified && <span style={styles.verifiedBadge}>Wallet Verified</span>}
        </p>
        
        {/* Anonymous sign-in and wallet connection section */}
        <div style={{marginTop: '25px', display: 'flex', flexDirection: 'column', gap: '20px'}}>
          {/* Supabase Authentication Section */}
          <div style={styles.walletContainer}>
            <h3 style={{fontSize: '18px', marginTop: 0}}>Supabase Authentication</h3>
            
            {!session ? (
              <button 
                style={{
                  ...styles.refreshButton,
                  backgroundColor: '#F59E0B'
                }} 
                onClick={signInAnonymously}
              >
                Sign In Anonymously
              </button>
            ) : (
              <div>
                <p><strong>User ID:</strong> <code>{session.user.id}</code></p>
                <button 
                  style={{
                    ...styles.refreshButton,
                    backgroundColor: '#6B7280'
                  }} 
                  onClick={signOut}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
          
          {/* Wallet Connection Section */}
          <div style={styles.walletContainer}>
            <h3 style={{fontSize: '18px', marginTop: 0}}>MetaMask Connection (Gnosis Chain)</h3>
            
            {walletError && <div style={styles.errorMessage}>{walletError}</div>}
            {verificationMessage && <div style={styles.successMessage}>{verificationMessage}</div>}
            
            {walletAddress ? (
              <div style={styles.walletInfo}>
                <p><strong>Connected Address:</strong></p>
                <div style={styles.walletAddress}>{walletAddress}</div>
                
                <p><strong>Balance:</strong> {walletBalance} xDAI</p>
                <p><strong>Chain ID:</strong> {chainId} {chainId === GNOSIS_CHAIN_ID ? '(Gnosis Chain)' : ''}</p>
                
                <div style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
                  <button 
                    style={{
                      ...styles.walletButton,
                      backgroundColor: '#6B7280'
                    }} 
                    onClick={disconnectWallet}
                  >
                    Disconnect Wallet
                  </button>
                  
                  {session && !isVerified && (
                    <button 
                      style={styles.verifyButton} 
                      onClick={verifyWalletOwnership}
                      disabled={isVerifying}
                    >
                      {isVerifying ? 'Verifying...' : 'Verify Wallet Ownership'}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button 
                style={styles.walletButton} 
                onClick={connectWallet}
                disabled={walletConnecting}
              >
                {walletConnecting ? 'Connecting...' : 'Connect to MetaMask (Gnosis Chain)'}
              </button>
            )}
          </div>
          
          {/* Wallet-Account Linking Section */}
          {session && walletAddress && (
            <div style={styles.linkContainer}>
              <h3 style={{fontSize: '18px', marginTop: 0}}>Account Verification Status</h3>
              
              {isVerified ? (
                <div>
                  <p style={{color: '#059669', fontWeight: 'bold'}}>
                    ✓ This wallet address is verified for your account
                  </p>
                  <p>
                    You've proven ownership of this Ethereum address and it's now linked to your Supabase anonymous account.
                  </p>
                  <details>
                    <summary style={styles.detailsSummary}>Verification Details</summary>
                    <pre style={styles.jsonPre}>{JSON.stringify(linkedUserData, null, 2)}</pre>
                  </details>
                </div>
              ) : (
                <div>
                  <p>
                    Your wallet address is not yet verified. Click "Verify Wallet Ownership" above to cryptographically 
                    prove you own this wallet address and link it to your anonymous Supabase account.
                  </p>
                  <p style={{fontStyle: 'italic', marginTop: '10px'}}>
                    This will ask you to sign a message using your wallet, which doesn't cost any gas fees.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div style={styles.buttonContainer}>
          <button 
            style={styles.refreshButton} 
            onClick={handleRefresh}
          >
            Refresh Data Manually
          </button>
          
          <button 
            style={{
              ...styles.refreshButton,
              backgroundColor: realtimeEnabled ? '#DC2626' : '#10B981'
            }} 
            onClick={toggleRealtime}
          >
            {realtimeEnabled ? 'Disable Realtime' : 'Enable Realtime'}
          </button>
        </div>
        
        <p style={styles.updatedAt}>
          Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
      </div>
      
      <h3 style={styles.subtitle}>Data from Supabase Users Table:</h3>
      {data.length === 0 ? (
        <p>No data found in the users table. Please make sure you have created some records.</p>
      ) : (
        <div style={styles.userList}>
          {data.map((item) => (
            <div key={item.id} style={styles.userCard}>
              {renderUserData(item)}
            </div>
          ))}
        </div>
      )}
      
      {/* POOL CANDLES SECTION */}
      <div style={styles.section}>
        <h3 style={styles.subtitle}>Pool Candles Table (Supabase)</h3>
        <button style={styles.refreshButton} onClick={fetchPoolCandles} disabled={loadingPoolCandles}>
          {loadingPoolCandles ? 'Loading...' : 'Fetch Pool Candles'}
        </button>
        {errorPoolCandles && <div style={styles.errorMessage}>Error: {errorPoolCandles}</div>}
        {poolCandles.length === 0 && !loadingPoolCandles ? (
          <p>No data found in the pool_candles table.</p>
        ) : (
          <div style={styles.userList}>
            {poolCandles.map((item) => (
              <div key={item.id || item.timestamp || Math.random()} style={styles.userCard}>
                <pre style={styles.jsonPre}>{JSON.stringify(item, null, 2)}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* TRADE HISTORY REALTIME SECTION */}
      <div style={styles.section}>
        <h3 style={styles.subtitle}>
          🔥 Trade History Realtime Demo
          {walletAddress && <span style={styles.walletBadge}>Wallet Connected</span>}
          {tradeHistoryRealtimeEnabled && tradeHistoryChannel && <span style={styles.realtimeBadge}>Realtime Active</span>}
          {realtimeStats.connectionStatus === 'live' && <span style={styles.verifiedBadge}>Live Updates</span>}
        </h3>
        
        {/* Realtime Stats Dashboard */}
        <div style={{
          ...styles.walletContainer,
          backgroundColor: '#F0F9FF',
          border: '1px solid #0EA5E9',
          marginBottom: '20px'
        }}>
          <h4 style={{fontSize: '16px', marginTop: 0, color: '#0369A1'}}>📊 Realtime Statistics</h4>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px'}}>
            <div>
              <strong>Connection Status:</strong>
              <div style={{
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 'bold',
                marginTop: '4px',
                backgroundColor: 
                  realtimeStats.connectionStatus === 'connected' || realtimeStats.connectionStatus === 'live' ? '#10B981' :
                  realtimeStats.connectionStatus === 'error' ? '#EF4444' :
                  realtimeStats.connectionStatus === 'no_address' ? '#6B7280' : '#F59E0B',
                color: 'white',
                display: 'inline-block'
              }}>
                {realtimeStats.connectionStatus.toUpperCase()}
              </div>
            </div>
            <div>
              <strong>Total Trades:</strong> {realtimeStats.totalTrades}
            </div>
            <div>
              <strong>New Trades (Session):</strong> 
              <span style={{
                backgroundColor: realtimeStats.newTradesCount > 0 ? '#10B981' : '#6B7280',
                color: 'white',
                padding: '2px 6px',
                borderRadius: '4px',
                marginLeft: '5px',
                fontSize: '12px'
              }}>
                {realtimeStats.newTradesCount}
              </span>
            </div>
            <div>
              <strong>Last Trade:</strong> 
              <div style={{fontSize: '12px', color: '#6B7280'}}>
                {realtimeStats.lastTradeTime ? new Date(realtimeStats.lastTradeTime).toLocaleString() : 'None'}
              </div>
            </div>
          </div>
        </div>

        {/* Control Panel */}
        <div style={styles.buttonContainer}>
          <button 
            style={styles.refreshButton} 
            onClick={handleTradeHistoryRefresh}
            disabled={loadingTradeHistory}
          >
            {loadingTradeHistory ? '🔄 Loading...' : '🔄 Refresh All Trades'}
          </button>
          
          <button 
            style={{
              ...styles.refreshButton,
              backgroundColor: tradeHistoryRealtimeEnabled ? '#DC2626' : '#10B981'
            }} 
            onClick={toggleTradeHistoryRealtime}
          >
            {tradeHistoryRealtimeEnabled ? '⏸️ Disable Realtime' : '▶️ Enable Realtime'}
          </button>

          <button 
            style={{
              ...styles.refreshButton,
              backgroundColor: '#8B5CF6'
            }} 
            onClick={resetTradeHistoryStats}
          >
            📊 Reset Stats
          </button>

          <button 
            style={{
              ...styles.refreshButton,
              backgroundColor: '#F59E0B'
            }} 
            onClick={() => {
              const testAddr = prompt('Enter address to test (e.g., 0x2403Cc666aFf9EE68467e097bB494ceE8cEEBD9F):');
              if (testAddr) testTradeHistoryWithAddress(testAddr);
            }}
          >
            🧪 Test Address
          </button>
        </div>

        {/* Debugging Control Panel */}
        <div style={{
          ...styles.buttonContainer,
          marginTop: '10px',
          padding: '15px',
          backgroundColor: '#FEF3C7',
          borderRadius: '8px',
          border: '1px solid #F59E0B'
        }}>
          <h4 style={{margin: '0 0 10px 0', color: '#92400E'}}>🔧 Debugging Tools</h4>
          <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
            <button 
              style={{
                ...styles.refreshButton,
                backgroundColor: '#EF4444',
                marginTop: '0'
              }} 
              onClick={debugRealtimeConnection}
            >
              🔍 Debug Connection
            </button>

            <button 
              style={{
                ...styles.refreshButton,
                backgroundColor: '#10B981',
                marginTop: '0'
              }} 
              onClick={checkSupabaseRealtimeStatus}
            >
              ✅ Test Connection
            </button>

            <button 
              style={{
                ...styles.refreshButton,
                backgroundColor: '#F59E0B',
                marginTop: '0'
              }} 
              onClick={testRealtimeWithManualInsert}
            >
              🧪 Test Insert
            </button>

            <button 
              style={{
                ...styles.refreshButton,
                backgroundColor: '#6366F1',
                marginTop: '0'
              }} 
              onClick={setupSimpleRealtimeTest}
            >
              🧪 Simple Realtime Test
            </button>

            <button 
              style={{
                ...styles.refreshButton,
                backgroundColor: '#6B7280',
                marginTop: '0'
              }} 
              onClick={() => {
                window.open('https://supabase.com/dashboard/project/nvhqdqtlsdboctqjcelq/database/tables', '_blank');
              }}
            >
              🌐 Open Supabase Dashboard
            </button>
          </div>
        </div>
        
        {/* Status Information */}
        <div style={styles.updatedAt}>
          <strong>Current Address:</strong> <code>{walletAddress || 'Not connected'}</code><br/>
          <strong>Proposal Filter:</strong> <code>0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919</code><br/>
          <strong>Last Updated:</strong> {lastTradeHistoryUpdate.toLocaleTimeString()}<br/>
          <strong>Realtime Channel:</strong> {tradeHistoryChannel ? '🟢 Active' : '🔴 Inactive'}<br/>
          <strong>Auto-refresh:</strong> {tradeHistoryRealtimeEnabled ? '✅ Enabled' : '❌ Disabled'}
        </div>
        
        {/* Error Display */}
        {errorTradeHistory && (
          <div style={styles.errorMessage}>
            <strong>Error:</strong> {errorTradeHistory}
          </div>
        )}
        
        {/* Trade History Display */}
        {!walletAddress ? (
          <div style={{
            ...styles.walletContainer,
            backgroundColor: '#FEF3C7',
            border: '1px solid #F59E0B',
            textAlign: 'center'
          }}>
            <h4>👛 Connect Your Wallet</h4>
            <p>Connect your MetaMask wallet above to see your trade history with live realtime updates.</p>
          </div>
        ) : loadingTradeHistory ? (
          <div style={styles.loadingMessage}>
            🔄 Loading trade history for {walletAddress}...
          </div>
        ) : tradeHistory.length === 0 ? (
          <div style={{
            ...styles.walletContainer,
            backgroundColor: '#F3F4F6',
            textAlign: 'center'
          }}>
            <h4>📭 No Trades Found</h4>
            <p>No trade history found for address: <code>{walletAddress}</code></p>
            <p style={{fontSize: '14px', color: '#6B7280'}}>
              Try the "🧪 Test Address" button with a known address that has trades.
            </p>
          </div>
        ) : (
          <div>
            <h4 style={{color: '#059669'}}>
              📈 Found {tradeHistory.length} trades for {walletAddress}
            </h4>
            
            {/* Show first 5 trades in detail */}
            <div style={styles.userList}>
              {tradeHistory.slice(0, 5).map((trade, index) => (
                <div key={trade.id || index} style={{
                  ...styles.userCard,
                  border: index === 0 && realtimeStats.newTradesCount > 0 ? '2px solid #10B981' : styles.userCard.border
                }}>
                  {index === 0 && realtimeStats.newTradesCount > 0 && (
                    <div style={{
                      backgroundColor: '#10B981',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      marginBottom: '8px',
                      fontWeight: 'bold'
                    }}>
                      🆕 LATEST TRADE
                    </div>
                  )}
                  
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px'}}>
                    <div>
                      <strong>🔗 TX Hash:</strong><br/>
                      <code style={{fontSize: '11px', wordBreak: 'break-all'}}>{trade.evt_tx_hash}</code>
                    </div>
                    <div>
                      <strong>⏰ Block Time:</strong><br/>
                      <span style={{fontSize: '12px'}}>{new Date(trade.evt_block_time).toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <div style={{marginBottom: '10px'}}>
                    <strong>📋 Proposal ID:</strong><br/>
                    <code style={{fontSize: '11px', wordBreak: 'break-all', backgroundColor: '#E0F2FE', padding: '2px 4px', borderRadius: '3px'}}>
                      {trade.proposal_id}
                    </code>
                  </div>
                  
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px'}}>
                    <div>
                      <strong>🪙 Token0:</strong><br/>
                      <code style={{fontSize: '11px'}}>{trade.token0}</code><br/>
                      <strong>Amount0:</strong> {trade.amount0}
                    </div>
                    <div>
                      <strong>🪙 Token1:</strong><br/>
                      <code style={{fontSize: '11px'}}>{trade.token1}</code><br/>
                      <strong>Amount1:</strong> {trade.amount1}
                    </div>
                  </div>
                  
                  <details>
                    <summary style={styles.detailsSummary}>📋 Full Trade Data</summary>
                    <pre style={styles.jsonPre}>{JSON.stringify(trade, null, 2)}</pre>
                  </details>
                </div>
              ))}
            </div>
            
            {/* Summary for remaining trades */}
            {tradeHistory.length > 5 && (
              <div style={{
                ...styles.walletContainer,
                backgroundColor: '#F9FAFB',
                textAlign: 'center',
                marginTop: '15px'
              }}>
                <p style={{color: '#6B7280', margin: 0}}>
                  📊 ... and <strong>{tradeHistory.length - 5}</strong> more trades
                </p>
                <p style={{fontSize: '12px', color: '#9CA3AF', margin: '5px 0 0 0'}}>
                  Showing latest 5 trades. All {tradeHistory.length} trades are being monitored for realtime updates.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Add the Web3 Authentication section */}
      <div style={styles.walletContainer || styles.section}>
        <h2 style={styles.sectionHeading}>Web3 Authentication</h2>
        <MetaMaskLogin />
      </div>

      {/* SUPABASE EDGE FUNCTION CALL SECTION */}
      <div style={styles.section}>
        <h3 style={styles.subtitle}>📞 Supabase Edge Function: Company Info</h3>
        <div style={styles.buttonContainer}>
          {/* ✅ WORKING METHOD: Direct fetch API correctly sends the body */}
          <button
            style={{...styles.refreshButton, backgroundColor: '#10B981'}}
            onClick={() => fetchCompanyInfoByIdDirect(9)} // Direct fetch method that works
            disabled={loadingCompanyInfo}
          >
            {loadingCompanyInfo ? 'Fetching Info...' : 'Fetch Company Info (ID: 9) ✅'}
          </button>
          
          <button
            style={{...styles.refreshButton, backgroundColor: '#059669'}}
            onClick={() => fetchCompanyInfoByIdDirect()} // Direct fetch with default ID
            disabled={loadingCompanyInfo}
          >
            {loadingCompanyInfo ? 'Fetching Info...' : 'Fetch Company Info (Default ID) ✅'}
          </button>
        </div>

        {loadingCompanyInfo && <div style={styles.loadingMessage}>Loading company information...</div>}
        
        {errorCompanyInfo && (
          <div style={styles.errorMessage}>
            <strong>Error fetching company info:</strong> {errorCompanyInfo}
          </div>
        )}

        {companyInfo && (
          <div style={{ marginTop: '15px' }}>
            <h4 style={{ color: '#059669' }}>📄 Company Information Received:</h4>
            <pre style={styles.jsonPre}>{JSON.stringify(companyInfo, null, 2)}</pre>
          </div>
        )}
      </div>

      {/* MARKET EVENTS FETCH SECTION */}
      <div style={styles.section}>
        <h3 style={styles.subtitle}>📈 Market Events (by Company ID)</h3>
        <div style={styles.buttonContainer}>
          <button
            style={styles.refreshButton}
            onClick={() => fetchMarketEventsByCompanyId()} // Uses default company_id 9
            disabled={loadingMarketEvents}
          >
            {loadingMarketEvents ? 'Fetching Events...' : 'Fetch Market Events (Company ID: 9)'}
          </button>
          {/* Optional: Add an input to specify companyId if needed later */}
          {/* <button style={styles.refreshButton} onClick={() => fetchMarketEventsByCompanyId(PROMPT_FOR_ID_OR_OTHER_ID)}>Fetch for different ID</button> */}
        </div>

        {loadingMarketEvents && <div style={styles.loadingMessage}>Loading market events...</div>}

        {errorMarketEvents && (
          <div style={styles.errorMessage}>
            <strong>Error fetching market events:</strong> {errorMarketEvents}
          </div>
        )}

        {marketEvents.length > 0 && (
          <div style={{ marginTop: '15px' }}>
            <h4 style={{ color: '#059669' }}>📋 Market Events Received ({marketEvents.length}):</h4>
            <div style={{maxHeight: '300px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px'}}>
              {marketEvents.map((event, index) => (
                <div key={event.id || index} style={{...styles.userCard, marginBottom: '10px'}}>
                  <pre style={styles.jsonPre}>{JSON.stringify(event, null, 2)}</pre>
                </div>
              ))}
            </div>
          </div>
        )}
        {marketEvents.length === 0 && !loadingMarketEvents && !errorMarketEvents && (
          <p>No market events found for the specified company ID.</p>
        )}
      </div>
      {/* --- Realtime Pool Candles Section --- */}
      <PoolCandlesRealtime />
    </div>
  );
};

export default SupabaseComponent;