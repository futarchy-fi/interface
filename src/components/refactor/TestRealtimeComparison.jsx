import React, { useState } from 'react';
import RealtimeDisplay from './components/RealtimeDisplay';

/**
 * Test page to compare original vs refactored realtime systems
 */
export default function TestRealtimeComparison() {
  const [testAddress, setTestAddress] = useState('0x2403Cc666aFf9EE68467e097bB494ceE8cEEBD9F');
  const [proposalId, setProposalId] = useState('0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919');

  return (
    <div style={{ 
      maxWidth: '1400px', 
      margin: '0 auto', 
      padding: '20px',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>
        🔥 Realtime System Comparison
      </h1>
      
      <div style={{ 
        marginBottom: '30px', 
        padding: '20px', 
        backgroundColor: '#F0F9FF', 
        borderRadius: '8px',
        border: '1px solid #0EA5E9'
      }}>
        <h3 style={{ marginTop: 0 }}>Test Configuration</h3>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label><strong>Test Address:</strong></label>
            <input
              type="text"
              value={testAddress}
              onChange={(e) => setTestAddress(e.target.value)}
              style={{
                padding: '6px 8px',
                border: '1px solid #D1D5DB',
                borderRadius: '4px',
                fontSize: '14px',
                width: '400px',
                fontFamily: 'monospace'
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label><strong>Proposal ID:</strong></label>
            <input
              type="text"
              value={proposalId}
              onChange={(e) => setProposalId(e.target.value)}
              style={{
                padding: '6px 8px',
                border: '1px solid #D1D5DB',
                borderRadius: '4px',
                fontSize: '14px',
                width: '300px',
                fontFamily: 'monospace'
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '30px',
        minHeight: '800px'
      }}>
        {/* Original System */}
        <div style={{ 
          border: '2px solid #EF4444', 
          borderRadius: '8px',
          padding: '0'
        }}>
          <div style={{ 
            backgroundColor: '#EF4444', 
            color: 'white', 
            padding: '15px',
            borderRadius: '6px 6px 0 0',
            marginBottom: '0'
          }}>
            <h2 style={{ margin: 0, fontSize: '18px' }}>
              📊 Original SupabaseComponent
            </h2>
            <p style={{ margin: '5px 0 0 0', fontSize: '14px' }}>
              Monolithic approach - Working ✅
            </p>
          </div>
          
          <div style={{ padding: '20px' }}>
            <div style={{
              padding: '20px',
              backgroundColor: '#FEE2E2',
              borderRadius: '6px',
              textAlign: 'center',
              color: '#B91C1C'
            }}>
              <p style={{ margin: 0 }}>
                <strong>Original SupabaseComponent</strong><br/>
                Navigate to <code>/supabase</code> route to test the working version
              </p>
            </div>
          </div>
        </div>

        {/* Refactored System */}
        <div style={{ 
          border: '2px solid #10B981', 
          borderRadius: '8px',
          padding: '0'
        }}>
          <div style={{ 
            backgroundColor: '#10B981', 
            color: 'white', 
            padding: '15px',
            borderRadius: '6px 6px 0 0',
            marginBottom: '0'
          }}>
            <h2 style={{ margin: 0, fontSize: '18px' }}>
              🚀 Refactored Strategy System
            </h2>
            <p style={{ margin: '5px 0 0 0', fontSize: '14px' }}>
              Strategy pattern approach - Testing 🧪
            </p>
          </div>
          
          <div style={{ padding: '20px' }}>
            <RealtimeDisplay 
              userAddress={testAddress}
              proposalId={proposalId}
            />
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div style={{ 
        marginTop: '30px', 
        padding: '20px', 
        backgroundColor: '#FFFBEB', 
        borderRadius: '8px',
        border: '1px solid #F59E0B'
      }}>
        <h3 style={{ marginTop: 0, color: '#92400E' }}>🧪 Testing Instructions</h3>
        <ol style={{ margin: 0, color: '#92400E' }}>
          <li><strong>Connect Wallet:</strong> Make sure your MetaMask is connected to Gnosis Chain</li>
          <li><strong>Set Test Address:</strong> Use your connected wallet address or the default test address</li>
          <li><strong>Subscribe:</strong> Click "Subscribe" in the refactored system</li>
          <li><strong>Make a Trade:</strong> Execute a trade on the platform</li>
          <li><strong>Compare Results:</strong> Both systems should show the new trade in realtime</li>
        </ol>
        
        <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#FEF3C7', borderRadius: '4px' }}>
          <strong>Expected Behavior:</strong> When you make a trade, both the original SupabaseComponent 
          and the refactored RealtimeDisplay should immediately show the new trade data without manual refresh.
        </div>
      </div>

      {/* Debug Panel */}
      <details style={{ marginTop: '30px' }}>
        <summary style={{ 
          cursor: 'pointer', 
          fontWeight: 'bold', 
          padding: '10px',
          backgroundColor: '#F3F4F6',
          borderRadius: '4px'
        }}>
          🔍 Debug Information
        </summary>
        <div style={{ 
          marginTop: '10px', 
          padding: '15px', 
          backgroundColor: '#F9FAFB', 
          borderRadius: '4px',
          border: '1px solid #E5E7EB'
        }}>
          <h4>Current Configuration:</h4>
          <ul>
            <li><strong>Test Address:</strong> <code>{testAddress}</code></li>
            <li><strong>Proposal ID:</strong> <code>{proposalId}</code></li>
            <li><strong>Supabase URL:</strong> <code>https://nvhqdqtlsdboctqjcelq.supabase.co</code></li>
            <li><strong>Table:</strong> <code>trade_history</code></li>
          </ul>
          
          <h4>Key Differences:</h4>
          <ul>
            <li><strong>Original:</strong> Direct useState + useEffect, monolithic structure</li>
            <li><strong>Refactored:</strong> Strategy pattern + custom hooks, modular architecture</li>
            <li><strong>Filtering:</strong> Both use user_address filter in realtime, proposal_id client-side</li>
            <li><strong>Subscription:</strong> Both create channels and listen to postgres_changes events</li>
          </ul>
        </div>
      </details>
    </div>
  );
} 