import React, { useState, useEffect } from 'react';
import { getSwaprDebugStats } from '../../../utils/swaprSdk';

/**
 * Visual debug panel for Swapr SDK call tracking
 * Shows real-time stats about SDK calls, errors, and RPC usage
 */
export default function SwaprDebugPanel() {
  const [stats, setStats] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copyStatus, setCopyStatus] = useState('');

  // Refresh stats
  const refreshStats = () => {
    try {
      const debugStats = getSwaprDebugStats();
      console.log('[SwaprDebugPanel] Refreshed stats:', debugStats);
      setStats(debugStats);
    } catch (error) {
      console.error('[SwaprDebugPanel] Failed to get debug stats:', error);
      // Set default stats on error
      setStats({
        totalCalls: 0,
        callHistory: [],
        uniquePoolAddresses: [],
        uniqueTokenPairs: []
      });
    }
  };

  // Auto-refresh every 2 seconds
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(refreshStats, 2000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // Initial load
  useEffect(() => {
    console.log('[SwaprDebugPanel] Component mounted, loading initial stats...');
    refreshStats();
  }, []);

  // Copy stats to clipboard
  const copyToClipboard = () => {
    if (!stats) return;

    const text = `
🔍 SWAPR SDK DEBUG STATS
========================
Total Calls: ${stats.totalCalls}
Unique Pools: ${stats.uniquePoolAddresses.length}
Unique Token Pairs: ${stats.uniqueTokenPairs.length}

📊 TOKEN PAIRS:
${stats.uniqueTokenPairs.map(pair => `  - ${pair}`).join('\n')}

📊 POOL ADDRESSES:
${stats.uniquePoolAddresses.map(addr => `  - ${addr}`).join('\n')}

📊 RECENT 10 CALLS:
${stats.callHistory.slice(-10).map((call, i) => `
${i + 1}. [${call.timestamp}]
   Message: ${call.message}
   Token Pair: ${call.tokenPair || 'N/A'}
   Pool: ${call.poolAddress || 'N/A'}
`).join('\n')}
    `.trim();

    navigator.clipboard.writeText(text).then(() => {
      setCopyStatus('✅ Copied!');
      setTimeout(() => setCopyStatus(''), 2000);
    }).catch(err => {
      setCopyStatus('❌ Failed');
      console.error('Copy failed:', err);
    });
  };

  // Show loading state initially
  if (!stats) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 9999,
          fontFamily: 'monospace',
          fontSize: '12px'
        }}
      >
        <div
          style={{
            background: 'rgba(59, 130, 246, 0.9)',
            color: 'white',
            padding: '12px 16px',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
          }}
        >
          <span style={{ fontSize: '16px' }}>🔍</span> Loading debug panel...
        </div>
      </div>
    );
  }

  // Check for potential issues
  const hasIssues = stats.totalCalls > 10;
  const hasDuplicates = stats.callHistory.slice(-10).filter((call, i, arr) =>
    arr.filter(c => c.tokenPair === call.tokenPair).length > 2
  ).length > 0;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
        fontFamily: 'monospace',
        fontSize: '12px'
      }}
    >
      {/* Collapsed view */}
      {!isExpanded && (
        <div
          onClick={() => setIsExpanded(true)}
          style={{
            background: hasIssues ? 'rgba(220, 38, 38, 0.9)' : 'rgba(59, 130, 246, 0.9)',
            color: 'white',
            padding: '12px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <span style={{ fontSize: '16px' }}>🔍</span>
          <div>
            <div style={{ fontWeight: 'bold' }}>
              Swapr Calls: {stats.totalCalls}
            </div>
            {hasIssues && (
              <div style={{ fontSize: '10px', opacity: 0.9 }}>
                ⚠️ High call count detected
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expanded view */}
      {isExpanded && (
        <div
          style={{
            background: 'rgba(17, 24, 39, 0.95)',
            color: 'white',
            padding: '16px',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            width: '500px',
            maxHeight: '600px',
            overflow: 'auto',
            border: hasIssues ? '2px solid rgb(220, 38, 38)' : '2px solid rgb(59, 130, 246)'
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
            paddingBottom: '12px',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🔍</span>
              <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Swapr SDK Debug</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                style={{
                  background: autoRefresh ? 'rgb(34, 197, 94)' : 'rgb(107, 114, 128)',
                  color: 'white',
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                {autoRefresh ? '⏸️ Pause' : '▶️ Auto'}
              </button>
              <button
                onClick={refreshStats}
                style={{
                  background: 'rgb(59, 130, 246)',
                  color: 'white',
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                🔄 Refresh
              </button>
              <button
                onClick={copyToClipboard}
                style={{
                  background: 'rgb(168, 85, 247)',
                  color: 'white',
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                {copyStatus || '📋 Copy'}
              </button>
              <button
                onClick={() => setIsExpanded(false)}
                style={{
                  background: 'transparent',
                  color: 'white',
                  border: 'none',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Stats Summary */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '8px',
            marginBottom: '12px'
          }}>
            <div style={{
              background: hasIssues ? 'rgba(220, 38, 38, 0.2)' : 'rgba(59, 130, 246, 0.2)',
              padding: '8px',
              borderRadius: '6px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                {stats.totalCalls}
              </div>
              <div style={{ fontSize: '10px', opacity: 0.7 }}>Total Calls</div>
            </div>
            <div style={{
              background: 'rgba(34, 197, 94, 0.2)',
              padding: '8px',
              borderRadius: '6px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                {stats.uniquePoolAddresses.length}
              </div>
              <div style={{ fontSize: '10px', opacity: 0.7 }}>Unique Pools</div>
            </div>
            <div style={{
              background: 'rgba(168, 85, 247, 0.2)',
              padding: '8px',
              borderRadius: '6px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                {stats.uniqueTokenPairs.length}
              </div>
              <div style={{ fontSize: '10px', opacity: 0.7 }}>Token Pairs</div>
            </div>
          </div>

          {/* Warnings */}
          {hasIssues && (
            <div style={{
              background: 'rgba(220, 38, 38, 0.2)',
              border: '1px solid rgb(220, 38, 38)',
              padding: '8px',
              borderRadius: '6px',
              marginBottom: '12px',
              fontSize: '11px'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                ⚠️ High Call Count Detected
              </div>
              <div style={{ opacity: 0.9 }}>
                {stats.totalCalls} calls have been made. This may indicate duplicate calls or excessive SDK usage.
              </div>
            </div>
          )}

          {hasDuplicates && (
            <div style={{
              background: 'rgba(251, 146, 60, 0.2)',
              border: '1px solid rgb(251, 146, 60)',
              padding: '8px',
              borderRadius: '6px',
              marginBottom: '12px',
              fontSize: '11px'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                ⚠️ Duplicate Calls Detected
              </div>
              <div style={{ opacity: 0.9 }}>
                Same token pairs are being called multiple times in recent history.
              </div>
            </div>
          )}

          {/* Token Pairs */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{
              fontWeight: 'bold',
              marginBottom: '6px',
              fontSize: '11px',
              opacity: 0.7
            }}>
              📊 TOKEN PAIRS ({stats.uniqueTokenPairs.length})
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              padding: '8px',
              borderRadius: '6px',
              maxHeight: '100px',
              overflow: 'auto',
              fontSize: '11px'
            }}>
              {stats.uniqueTokenPairs.length > 0 ? (
                stats.uniqueTokenPairs.map((pair, i) => (
                  <div key={i} style={{
                    padding: '2px 0',
                    borderBottom: i < stats.uniqueTokenPairs.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                  }}>
                    → {pair}
                  </div>
                ))
              ) : (
                <div style={{ opacity: 0.5 }}>No calls yet</div>
              )}
            </div>
          </div>

          {/* Recent Calls */}
          <div>
            <div style={{
              fontWeight: 'bold',
              marginBottom: '6px',
              fontSize: '11px',
              opacity: 0.7
            }}>
              📝 RECENT CALLS (Last 10)
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              padding: '8px',
              borderRadius: '6px',
              maxHeight: '200px',
              overflow: 'auto',
              fontSize: '10px'
            }}>
              {stats.callHistory.slice(-10).reverse().map((call, i) => {
                const isDuplicate = stats.callHistory.slice(-10).filter(c =>
                  c.tokenPair === call.tokenPair
                ).length > 2;

                return (
                  <div
                    key={i}
                    style={{
                      padding: '6px',
                      marginBottom: '4px',
                      background: isDuplicate ? 'rgba(251, 146, 60, 0.1)' : 'rgba(255,255,255,0.02)',
                      borderRadius: '4px',
                      borderLeft: isDuplicate ? '2px solid rgb(251, 146, 60)' : '2px solid transparent'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                      #{call.callNumber} {call.message.includes('ENTRY') ? '🚀' :
                                        call.message.includes('COMPLETED') ? '✅' :
                                        call.message.includes('FAILED') ? '❌' : '📊'}
                    </div>
                    <div style={{ opacity: 0.7 }}>
                      {call.tokenPair && <div>Pair: {call.tokenPair}</div>}
                      {call.duration && <div>Duration: {call.duration}</div>}
                      <div style={{ fontSize: '9px', marginTop: '2px' }}>
                        {new Date(call.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            fontSize: '10px',
            opacity: 0.5,
            textAlign: 'center'
          }}>
            {autoRefresh ? '🔄 Auto-refreshing every 2s' : '⏸️ Auto-refresh paused'}
          </div>
        </div>
      )}
    </div>
  );
}
