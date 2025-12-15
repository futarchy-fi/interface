import { useState, useEffect } from 'react';
import { useProposal } from '../hooks/useProposal';
import { useSimpleProposal, useProposalTitle, useProposalOpeningTime } from '../hooks/useSimpleProposal';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { useBalances } from '../hooks/useBalances';
import { useSimpleBalances, useFormattedBalances } from '../hooks/useSimpleBalances';
import { useProposalBalances } from '../hooks/useProposalBalances';
import { usePoolPrices } from '../hooks/usePoolPrices';
import { useProposalContext } from '../context/ProposalContext';
import { standardizePriceDisplay } from '../utils/priceFormatUtils';

const TestHooksDisplay = () => {
  const [testProposalAddress, setTestProposalAddress] = useState('0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919');
  const [companyId, setCompanyId] = useState(9);

  // Get the global proposal context to sync with input field
  const proposalContext = useProposalContext();

  // 🔧 FIX: Sync input field with global context when input changes
  useEffect(() => {
    const updateGlobalProposal = async () => {
      if (testProposalAddress && testProposalAddress !== proposalContext.proposalAddress) {
        console.log('🔄 Syncing global context with input field:', testProposalAddress);
        try {
          await proposalContext.changeProposal(testProposalAddress);
        } catch (error) {
          console.error('Error updating global proposal:', error);
        }
      }
    };
    
    updateGlobalProposal();
  }, [testProposalAddress, proposalContext.proposalAddress, proposalContext.changeProposal]);

  // 🎯 Super Simple Hook Usage Examples
  const proposal = useProposal(testProposalAddress);
  const simpleProposal = useSimpleProposal(testProposalAddress);
  const justTitle = useProposalTitle(testProposalAddress);
  const justOpeningTime = useProposalOpeningTime(testProposalAddress);
  const companyInfo = useCompanyInfo();
  const balances = useBalances();
  const simpleBalances = useSimpleBalances(testProposalAddress); // 🔥 NOW PROPOSAL-AWARE
  const proposalBalances = useProposalBalances();
  const formattedBalances = useFormattedBalances();
  const poolPrices = usePoolPrices(testProposalAddress); // 🔥 NOW PROPOSAL-AWARE

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">🧪 Test Hooks - Proposal-Aware Demo</h2>
        <p className="text-gray-600">🔥 ALL hooks now update when proposal changes - balances, pool prices, and proposal data are all context-aware!</p>
      </div>

      {/* Input Controls with Context Sync Info */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">🎛️ Test Inputs</h3>
        
        {/* Address Sync Status */}
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-800 mb-2">📍 Address Synchronization Status</h4>
          <div className="text-sm space-y-1">
            <div><strong>Input Field:</strong> <code className="bg-white px-1 rounded">{testProposalAddress}</code></div>
            <div><strong>Global Context:</strong> <code className="bg-white px-1 rounded">{proposalContext.proposalAddress || 'None'}</code></div>
            <div className="flex items-center gap-2">
              <strong>Status:</strong>
              {testProposalAddress === proposalContext.proposalAddress ? (
                <span className="text-green-600 font-medium">✅ Synced</span>
              ) : (
                <span className="text-yellow-600 font-medium">⏳ Syncing...</span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Proposal Address
            </label>
            <input
              type="text"
              value={testProposalAddress}
              onChange={(e) => setTestProposalAddress(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="0x..."
            />
            <p className="text-xs text-gray-500 mt-1">
              ⚡ Changing this automatically updates ALL hooks (direct + context-based)
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company ID
            </label>
            <input
              type="number"
              value={companyId}
              onChange={(e) => setCompanyId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="9"
            />
          </div>
        </div>
      </div>

      {/* Reactive Pattern Explanation */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg shadow-lg p-6 border-2 border-purple-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          🔄 **UNIFIED REACTIVE PATTERN** - <code className="text-sm bg-white px-2 py-1 rounded">All Hooks Synced</code>
        </h3>
        
        <div className="bg-gray-900 rounded-lg p-4 mb-4">
          <pre className="text-green-400 text-sm">
{`// 🔄 UNIFIED PATTERN - Input field controls EVERYTHING:

// 1. Input change → Updates both direct hooks AND global context
setTestProposalAddress('0xNEW...') // ← Single change point

// 2. Direct hooks use the address parameter
const proposal = useProposal(testProposalAddress);

// 3. Context hooks automatically sync via useEffect
useEffect(() => {
  proposalContext.changeProposal(testProposalAddress);
}, [testProposalAddress]);

// 4. All hooks now reflect the SAME proposal
// Current input: ${testProposalAddress.slice(0, 10)}...
// Global context: ${(proposalContext.proposalAddress || 'None').slice(0, 10)}...
// Status: ${testProposalAddress === proposalContext.proposalAddress ? 'SYNCED ✅' : 'SYNCING ⏳'}`}
          </pre>
        </div>

        <div className="grid grid-cols-1 gap-4 text-sm">
          {/* Primary Balance Display - useSimpleBalances (The Working One!) */}
          <div className="bg-white rounded-lg p-4 border-2 border-emerald-300">
            <h4 className="font-medium text-emerald-800 mb-3">💰 useSimpleBalances() - 🔥 WORKING & ACCURATE</h4>
            <div className="space-y-2 text-sm">
              <div className="bg-emerald-50 rounded p-2">
                <div className="font-medium text-emerald-700 mb-1">✅ Real-Time Token Balances for This Proposal:</div>
                <div className="text-xs space-y-1">
                  <div>Proposal: <span className="font-mono">{testProposalAddress.slice(0, 10)}...</span></div>
                  <div>Currency: <span className="font-mono">{simpleBalances.symbols.currency.base}</span></div>
                  <div>Company: <span className="font-mono">{simpleBalances.symbols.company.base}</span></div>
                </div>
              </div>

              {simpleBalances.isConnected ? (
                <div className="space-y-2">
                  <div className="bg-emerald-50 rounded p-3">
                    <div className="font-medium text-emerald-800 mb-2">💰 Current Live Balances:</div>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span>{simpleBalances.symbols.currency.base}:</span>
                        <span className="font-mono font-bold text-emerald-900">{simpleBalances.currency.base}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{simpleBalances.symbols.currency.yes}:</span>
                        <span className="font-mono font-bold text-emerald-900">{simpleBalances.currency.yes}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{simpleBalances.symbols.currency.no}:</span>
                        <span className="font-mono font-bold text-emerald-900">{simpleBalances.currency.no}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{simpleBalances.symbols.company.base}:</span>
                        <span className="font-mono font-bold text-emerald-900">{simpleBalances.company.base}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{simpleBalances.symbols.company.yes}:</span>
                        <span className="font-mono font-bold text-emerald-900">{simpleBalances.company.yes}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{simpleBalances.symbols.company.no}:</span>
                        <span className="font-mono font-bold text-emerald-900">{simpleBalances.company.no}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{simpleBalances.symbols.native}:</span>
                        <span className="font-mono font-bold text-emerald-900">{simpleBalances.native}</span>
                      </div>
                    </div>
                  </div>
                  
                                     <div className="text-xs text-emerald-600 bg-emerald-50 rounded p-2">
                     ✅ <strong>NOW TRULY PROPOSAL-AWARE!</strong> - Balances will change when you switch proposals • Last updated: {simpleBalances.lastUpdated?.toLocaleTimeString() || 'Just now'}
                   </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded p-2 text-center">
                  <div className="text-gray-600 text-xs">Connect wallet to see balances</div>
                </div>
              )}

              {simpleBalances.error && (
                <div className="bg-red-50 rounded p-2">
                  <div className="text-red-700 text-xs">Error: {simpleBalances.error}</div>
                </div>
              )}
            </div>
          </div>

          {/* Technical Note About Other Hook */}
          <div className="bg-yellow-50 rounded-lg p-4 border-2 border-yellow-300">
            <h4 className="font-medium text-yellow-800 mb-2">⚠️ Technical Note: useProposalBalances() Status</h4>
            <div className="text-sm text-yellow-700">
              <div className="mb-2">The <code>useProposalBalances()</code> hook is more complex and depends on multiple layers:</div>
              <ul className="text-xs space-y-1 ml-4">
                <li>• ProposalContext must be ready: <strong>{proposalBalances.proposalReady ? '✅ Ready' : '❌ Not Ready'}</strong></li>
                <li>• Token metadata must load: <strong>{proposalBalances.tokensReady ? '✅ Ready' : '❌ Loading...'}</strong></li>
                <li>• All dependencies synced: <strong>{proposalBalances.hasProposalTokens() ? '✅ All Set' : '⏳ Waiting...'}</strong></li>
              </ul>
              <div className="mt-2 text-xs bg-yellow-100 rounded p-2">
                <strong>Result:</strong> {proposalBalances.hasProposalTokens() ? 
                  `Shows balances (but may be delayed)` : 
                  `Waiting for all systems to sync - useSimpleBalances() is more reliable for immediate use`}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-purple-100 rounded-lg">
          <div className="flex items-center gap-2 text-purple-800">
            <span className="text-lg">🔄</span>
            <span className="font-medium">UNIFIED PATTERN: One input field → ALL hooks sync automatically!</span>
          </div>
        </div>
      </div>

      {/* Data Flow Explanation */}
      <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-blue-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">🏗️ Reactive Pattern Data Flow</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-blue-50 rounded p-3 text-center">
            <div className="font-medium text-blue-800 mb-2">1️⃣ Input Change</div>
            <div className="text-blue-700 text-xs">User changes proposal address</div>
            <div className="text-blue-600 text-xs mt-1">↓</div>
          </div>
          
          <div className="bg-green-50 rounded p-3 text-center">
            <div className="font-medium text-green-800 mb-2">2️⃣ Context Update</div>
            <div className="text-green-700 text-xs">ProposalContext detects change</div>
            <div className="text-green-600 text-xs mt-1">↓</div>
          </div>
          
          <div className="bg-yellow-50 rounded p-3 text-center">
            <div className="font-medium text-yellow-800 mb-2">3️⃣ Hooks Re-run</div>
            <div className="text-yellow-700 text-xs">useProposalBalances() re-executes</div>
            <div className="text-yellow-600 text-xs mt-1">↓</div>
          </div>
          
          <div className="bg-purple-50 rounded p-3 text-center">
            <div className="font-medium text-purple-800 mb-2">4️⃣ Fresh Data</div>
            <div className="text-purple-700 text-xs">New tokens fetched from contracts</div>
            <div className="text-purple-600 text-xs mt-1">✅</div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-800 mb-2">🎯 Key Benefits:</h4>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• **Dynamic Token Detection**: Fetches actual token symbols/names from contracts</li>
            <li>• **Automatic Updates**: No manual refresh needed when proposal changes</li>
            <li>• **Single Source of Truth**: ProposalContext manages all proposal-related state</li>
            <li>• **Type Safety**: Clean interfaces with proper TypeScript support</li>
            <li>• **Error Handling**: Graceful fallbacks when contract calls fail</li>
          </ul>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Hook Comparison: Static vs Reactive</h3>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hook</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Updates on Proposal Change</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token Source</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbols</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">useProposal(address)</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">✅ Yes</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Contract Reading</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Dynamic</td>
              </tr>
              <tr className="bg-purple-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-purple-900">useProposalBalances()</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">✅ Yes</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-900">Contract Reading</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-900">Dynamic from ERC20</td>
              </tr>
              <tr className="bg-emerald-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-emerald-900">useSimpleBalances()</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">✅ Yes</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-900">Proposal-Aware Contract Reading</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-900">Dynamic per Proposal</td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">usePoolPrices()</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600">⚠️ Partial</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Mixed</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Mixed</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Super Simple Hooks Demo */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg shadow-lg p-6 border-2 border-green-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          ⚡ SUPER SIMPLE HOOKS - <code className="text-sm bg-white px-2 py-1 rounded">useSimpleProposal()</code>
        </h3>
        
        <div className="bg-gray-900 rounded-lg p-4 mb-4">
          <pre className="text-green-400 text-sm">
{`// THE ABSOLUTE SIMPLEST WAY:
const { title, openingTime, isOpen } = useSimpleProposal('${testProposalAddress}');

// OR EVEN SIMPLER - JUST GET WHAT YOU NEED:
const title = useProposalTitle('${testProposalAddress}');
const { openingTime, isOpen } = useProposalOpeningTime('${testProposalAddress}');`}
          </pre>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Simple Proposal Hook */}
          <div className="bg-white rounded-lg p-4 border-2 border-green-300">
            <h4 className="font-medium text-green-800 mb-2">🎯 useSimpleProposal</h4>
            {simpleProposal.loading ? (
              <div className="text-green-600">Loading...</div>
            ) : simpleProposal.error ? (
              <div className="text-red-600 text-xs">{simpleProposal.error}</div>
            ) : (
              <div className="space-y-2 text-sm">
                <div><strong>Title:</strong> {simpleProposal.title || 'N/A'}</div>
                <div><strong>Opening:</strong> {simpleProposal.openingTime || 'N/A'}</div>
                <div><strong>Status:</strong> {simpleProposal.isOpen ? '✅ Open' : '⏳ Waiting'}</div>
              </div>
            )}
          </div>

          {/* Just Title Hook */}
          <div className="bg-white rounded-lg p-4 border-2 border-blue-300">
            <h4 className="font-medium text-blue-800 mb-2">📝 useProposalTitle</h4>
            <div className="text-sm">
              <div className="font-medium text-blue-900">
                {justTitle || 'Loading...'}
              </div>
            </div>
          </div>

          {/* Just Opening Time Hook */}
          <div className="bg-white rounded-lg p-4 border-2 border-purple-300">
            <h4 className="font-medium text-purple-800 mb-2">⏰ useProposalOpeningTime</h4>
            <div className="text-sm space-y-1">
              <div><strong>Time:</strong> {justOpeningTime.openingTime || 'N/A'}</div>
              <div><strong>Open:</strong> {justOpeningTime.isOpen ? 'Yes' : 'No'}</div>
              {justOpeningTime.daysUntilOpening && (
                <div><strong>Days:</strong> {justOpeningTime.daysUntilOpening}</div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-green-100 rounded-lg">
          <div className="flex items-center gap-2 text-green-800">
            <span className="text-lg">⚡</span>
            <span className="font-medium">LITERALLY ONE LINE OF CODE TO GET PROPOSAL INFO!</span>
          </div>
        </div>
      </div>

      {/* Simple Balances Hook Demo */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg shadow-lg p-6 border-2 border-emerald-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          💰 Simple Balances Hook - <code className="text-sm bg-white px-2 py-1 rounded">useSimpleBalances(proposalAddress)</code>
        </h3>
        
        {/* Proposal-Aware Status */}
        <div className="mb-4 p-3 bg-emerald-100 rounded-lg border border-emerald-300">
          <h4 className="font-medium text-emerald-800 mb-2">🔄 Proposal-Aware Balances</h4>
          <div className="text-sm space-y-1">
            <div><strong>Current Proposal:</strong> <code className="bg-white px-1 rounded">{testProposalAddress.slice(0, 10)}...</code></div>
            <div><strong>Currency:</strong> <span className="font-mono text-emerald-800">{simpleBalances.symbols.currency.base}</span></div>
            <div><strong>Company:</strong> <span className="font-mono text-emerald-800">{simpleBalances.symbols.company.base}</span></div>
            <div className="flex items-center gap-2">
              <strong>Status:</strong>
              {simpleBalances.loading ? (
                <span className="text-yellow-600 font-medium">⏳ Loading proposal tokens...</span>
              ) : simpleBalances.error ? (
                <span className="text-red-600 font-medium">❌ Error: {simpleBalances.error}</span>
              ) : (
                <span className="text-green-600 font-medium">✅ Tokens loaded for proposal</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="bg-gray-900 rounded-lg p-4 mb-4">
          <pre className="text-green-400 text-sm">
{`// 🔥 NOW PROPOSAL-AWARE - BALANCES UPDATE WHEN PROPOSAL CHANGES:
const { currency, company, native, symbols, refresh } = useSimpleBalances('${testProposalAddress}');
// OR use global context:
const { currency, company, native, symbols, refresh } = useSimpleBalances();

// Clean, intuitive access for THIS proposal:
currency.base    // ${simpleBalances.symbols.currency.base} (${simpleBalances.currency.base})
currency.yes     // ${simpleBalances.symbols.currency.yes} (${simpleBalances.currency.yes})
currency.no      // ${simpleBalances.symbols.currency.no} (${simpleBalances.currency.no})
company.base     // ${simpleBalances.symbols.company.base} (${simpleBalances.company.base})
company.yes      // ${simpleBalances.symbols.company.yes} (${simpleBalances.company.yes})
company.no       // ${simpleBalances.symbols.company.no} (${simpleBalances.company.no})
native           // ${simpleBalances.symbols.native} (${simpleBalances.native})`}
          </pre>
        </div>

        <div className="flex gap-4 mb-4">
          <button
            onClick={() => simpleBalances.refresh()}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
            disabled={simpleBalances.loading}
          >
            {simpleBalances.loading ? 'Refreshing...' : 'Refresh Simple Balances'}
          </button>
          <button
            onClick={() => formattedBalances.refresh()}
            className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
            disabled={formattedBalances.loading}
          >
            {formattedBalances.loading ? 'Loading...' : 'Refresh Formatted Balances'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Clean Structure Display */}
          <div className="bg-white rounded-lg p-4 border-2 border-emerald-300">
            <h4 className="font-medium text-emerald-800 mb-3">✨ useSimpleBalances() - Clean Structure</h4>
            {simpleBalances.isConnected ? (
              <div className="space-y-3 text-sm">
                {/* Currency Section */}
                <div className="bg-green-50 rounded p-3">
                  <div className="font-medium text-green-800 mb-2">💱 Currency ({simpleBalances.symbols.currency.base})</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span>Base:</span>
                      <span className="font-mono">{simpleBalances.currency.base} {simpleBalances.symbols.currency.base}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>YES:</span>
                      <span className="font-mono">{simpleBalances.currency.yes} {simpleBalances.symbols.currency.yes}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>NO:</span>
                      <span className="font-mono">{simpleBalances.currency.no} {simpleBalances.symbols.currency.no}</span>
                    </div>
                  </div>
                </div>

                {/* Company Section */}
                <div className="bg-blue-50 rounded p-3">
                  <div className="font-medium text-blue-800 mb-2">🏢 Company ({simpleBalances.symbols.company.base})</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span>Base:</span>
                      <span className="font-mono">{simpleBalances.company.base} {simpleBalances.symbols.company.base}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>YES:</span>
                      <span className="font-mono">{simpleBalances.company.yes} {simpleBalances.symbols.company.yes}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>NO:</span>
                      <span className="font-mono">{simpleBalances.company.no} {simpleBalances.symbols.company.no}</span>
                    </div>
                  </div>
                </div>

                {/* Native Section */}
                <div className="bg-purple-50 rounded p-3">
                  <div className="font-medium text-purple-800 mb-2">⛽ Native</div>
                  <div className="text-xs">
                    <div className="flex justify-between">
                      <span>Native:</span>
                      <span className="font-mono">{simpleBalances.native} {simpleBalances.symbols.native}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-center py-4">
                Connect wallet to see balances
              </div>
            )}
          </div>

          {/* Formatted Balances Display */}
          <div className="bg-white rounded-lg p-4 border-2 border-teal-300">
            <h4 className="font-medium text-teal-800 mb-3">🎯 useFormattedBalances() - Super Simple</h4>
            {formattedBalances.isConnected ? (
              <div className="space-y-2 text-sm">
                {Object.keys(formattedBalances.formatted).length > 0 ? (
                  <div>
                    <div className="font-medium text-teal-700 mb-2">Non-Zero Balances:</div>
                    {Object.entries(formattedBalances.formatted).map(([token, balance]) => (
                      <div key={token} className="flex justify-between bg-teal-50 rounded p-2">
                        <span className="text-teal-800">{token}:</span>
                        <span className="font-mono text-teal-900">{balance}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 text-center py-4">
                    No balances found
                  </div>
                )}

                {/* Quick Accessors */}
                <div className="mt-4 pt-3 border-t border-teal-200">
                  <div className="font-medium text-teal-700 mb-2">Quick Accessors:</div>
                  <div className="space-y-1 text-xs">
                    <div><strong>currencyBase:</strong> {formattedBalances.currencyBase}</div>
                    <div><strong>currencyYes:</strong> {formattedBalances.currencyYes}</div>
                    <div><strong>currencyNo:</strong> {formattedBalances.currencyNo}</div>
                    <div><strong>companyBase:</strong> {formattedBalances.companyBase}</div>
                    <div><strong>companyYes:</strong> {formattedBalances.companyYes}</div>
                    <div><strong>companyNo:</strong> {formattedBalances.companyNo}</div>
                    <div><strong>native:</strong> {formattedBalances.native}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-center py-4">
                Connect wallet to see formatted balances
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 p-3 bg-emerald-100 rounded-lg">
          <div className="flex items-center gap-2 text-emerald-800">
            <span className="text-lg">💰</span>
            <span className="font-medium">CLEAN, INTUITIVE BALANCE ACCESS: currency.yes, company.base!</span>
          </div>
        </div>
      </div>

      {/* Pool Prices Hook Demo */}
      <div className="bg-gradient-to-r from-indigo-50 to-cyan-50 rounded-lg shadow-lg p-6 border-2 border-indigo-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          🏊 Pool Prices Hook - <code className="text-sm bg-white px-2 py-1 rounded">usePoolPrices(proposalAddress)</code>
        </h3>
        
        {/* Proposal-Aware Status */}
        <div className="mb-4 p-3 bg-indigo-100 rounded-lg border border-indigo-300">
          <h4 className="font-medium text-indigo-800 mb-2">🔄 Proposal-Aware Pool Prices</h4>
          <div className="text-sm space-y-1">
            <div><strong>Current Proposal:</strong> <code className="bg-white px-1 rounded">{testProposalAddress.slice(0, 10)}...</code></div>
            <div className="flex items-center gap-2">
              <strong>Status:</strong>
              {poolPrices.loading ? (
                <span className="text-yellow-600 font-medium">⏳ Loading proposal pools...</span>
              ) : poolPrices.error ? (
                <span className="text-red-600 font-medium">❌ Error: {poolPrices.error}</span>
              ) : (
                <span className="text-green-600 font-medium">✅ Pools loaded for proposal</span>
              )}
            </div>
            <div className="text-xs text-indigo-600 mt-1">
              💡 Pools automatically update when proposal changes
            </div>
          </div>
        </div>
        
        <div className="bg-gray-900 rounded-lg p-4 mb-4">
          <pre className="text-green-400 text-sm">
{`// 🔥 NOW PROPOSAL-AWARE - POOL PRICES UPDATE WHEN PROPOSAL CHANGES:
const { getFormattedPoolData, refreshPrices, loading } = usePoolPrices('${testProposalAddress}');
// OR use global context:
const { getFormattedPoolData, refreshPrices, loading } = usePoolPrices();

// Get all pool prices automatically classified with proper convention FOR THIS PROPOSAL
const poolData = getFormattedPoolData();

// Prices show "currency per company" convention:
// 1 YES_GNO = 111.039 YES_sDAI (not raw token ratios)`}
          </pre>
        </div>

        <div className="flex gap-4 mb-4">
          <button
            onClick={() => poolPrices.refreshPrices()}
            className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
            disabled={poolPrices.loading}
          >
            {poolPrices.loading ? 'Refreshing...' : 'Refresh Pool Prices'}
          </button>
          <button
            onClick={() => poolPrices.fetchAllKnownPoolPrices()}
            className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
            disabled={poolPrices.loading}
          >
            {poolPrices.loading ? 'Loading...' : 'Fetch All Pools'}
          </button>
        </div>

        {(() => {
          const formattedData = poolPrices.getFormattedPoolData();
          const hasPools = formattedData && (
            formattedData.prediction?.length > 0 || 
            formattedData.conditional?.length > 0 || 
            formattedData.unknown?.length > 0
          );

          return hasPools ? (
            <div className="space-y-4">
              {/* Prediction Pools */}
              {formattedData.prediction?.length > 0 && (
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <h4 className="font-medium text-green-800 mb-3">🎯 Prediction Pool Prices (Correct Convention)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {formattedData.prediction.slice(0, 2).map((pool, idx) => {
                      // Apply standardized price display to get correct convention
                      const standardizedPrice = standardizePriceDisplay({
                        classification: pool.classification,
                        token0: pool.token0,
                        token1: pool.token1,
                        prices: pool.prices
                      });

                      return (
                        <div key={idx} className="bg-white rounded p-3 text-sm border border-green-300">
                          <div className="font-medium text-gray-800 mb-2">{pool.description}</div>
                          {pool.prices ? (
                            <div className="space-y-2">
                              {/* Primary Price with Convention */}
                              <div className="bg-green-50 rounded p-2 border-l-4 border-green-500">
                                <div className="text-xs text-green-600 mb-1">Primary Price (Convention)</div>
                                <div className="font-medium text-green-800">{standardizedPrice.primaryLabel}</div>
                                {standardizedPrice.tag && (
                                  <div className="text-xs text-green-600 mt-1">{standardizedPrice.tag}</div>
                                )}
                              </div>
                              {/* Alternative Price */}
                              <div className="bg-gray-50 rounded p-2">
                                <div className="text-xs text-gray-500 mb-1">Alternative Price</div>
                                <div className="text-sm text-gray-700">{standardizedPrice.secondaryLabel}</div>
                              </div>
                              <div className="text-xs text-green-600">Method: {pool.method}</div>
                            </div>
                          ) : (
                            <div className="text-gray-500 text-xs">
                              {pool.error ? `Error: ${pool.error}` : 'Loading...'}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Conditional Pools */}
              {formattedData.conditional?.length > 0 && (
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <h4 className="font-medium text-purple-800 mb-3">🔄 Conditional Pool Prices (Correct Convention)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {formattedData.conditional.slice(0, 2).map((pool, idx) => {
                      // Apply standardized price display to get correct convention
                      const standardizedPrice = standardizePriceDisplay({
                        classification: pool.classification,
                        token0: pool.token0,
                        token1: pool.token1,
                        prices: pool.prices
                      });

                      return (
                        <div key={idx} className="bg-white rounded p-3 text-sm border border-purple-300">
                          <div className="font-medium text-gray-800 mb-2">{pool.description}</div>
                          {pool.prices ? (
                            <div className="space-y-2">
                              {/* Primary Price with Convention */}
                              <div className="bg-purple-50 rounded p-2 border-l-4 border-purple-500">
                                <div className="text-xs text-purple-600 mb-1">Primary Price (Convention)</div>
                                <div className="font-medium text-purple-800">{standardizedPrice.primaryLabel}</div>
                                {standardizedPrice.tag && (
                                  <div className="text-xs text-purple-600 mt-1">{standardizedPrice.tag}</div>
                                )}
                              </div>
                              {/* Alternative Price */}
                              <div className="bg-gray-50 rounded p-2">
                                <div className="text-xs text-gray-500 mb-1">Alternative Price</div>
                                <div className="text-sm text-gray-700">{standardizedPrice.secondaryLabel}</div>
                              </div>
                              <div className="text-xs text-purple-600">Method: {pool.method}</div>
                            </div>
                          ) : (
                            <div className="text-gray-500 text-xs">
                              {pool.error ? `Error: ${pool.error}` : 'Loading...'}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Summary Stats */}
              <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                <h4 className="font-medium text-indigo-800 mb-2">📊 Pool Summary</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-bold text-green-600">{formattedData.prediction?.length || 0}</div>
                    <div className="text-gray-600">Prediction Pools</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-purple-600">{formattedData.conditional?.length || 0}</div>
                    <div className="text-gray-600">Conditional Pools</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-gray-600">{formattedData.unknown?.length || 0}</div>
                    <div className="text-gray-600">Unknown Pools</div>
                  </div>
                </div>
              </div>

              {/* Convention Explanation */}
              <div className="bg-cyan-50 rounded-lg p-4 border border-cyan-200">
                <h4 className="font-medium text-cyan-800 mb-2">💡 Price Convention Explained</h4>
                <div className="text-sm text-cyan-700 space-y-1">
                  <div><strong>Conditional Pools:</strong> Show "Currency per Company" (1 GNO-based = X sDAI-based)</div>
                  <div><strong>Prediction Pools:</strong> Show position tokens relative to base tokens</div>
                  <div><strong>Raw vs Convention:</strong> Raw ratios are converted to meaningful price conventions</div>
                  <div className="text-xs text-cyan-600 mt-2">
                    <strong>Example:</strong> Raw "Token0→Token1: 2.333" becomes "1 YES_GNO = 111.039 YES_sDAI"
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-indigo-50 rounded-lg p-4 text-center text-indigo-600">
              {poolPrices.loading ? 'Loading pool prices...' : 'Click "Refresh Pool Prices" to load all known pools'}
            </div>
          );
        })()}

        <div className="mt-4 p-3 bg-indigo-100 rounded-lg">
          <div className="flex items-center gap-2 text-indigo-800">
            <span className="text-lg">🏊</span>
            <span className="font-medium">AUTOMATIC POOL CLASSIFICATION AND PRICE CONVENTION!</span>
          </div>
        </div>
      </div>

      {/* Original Proposal Hook Demo */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          🎯 Full Proposal Hook - <code className="text-sm bg-gray-100 px-2 py-1 rounded">useProposal()</code>
        </h3>
        
        <div className="bg-gray-900 rounded-lg p-4 mb-4">
          <pre className="text-green-400 text-sm">
{`// More detailed usage:
const proposal = useProposal('${testProposalAddress}');

// Get title and opening time:
const title = proposal.getMarketName();
const openingInfo = proposal.getOpeningTimeInfo();`}
          </pre>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Title */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">📝 Proposal Title</h4>
            {proposal.loading ? (
              <div className="text-blue-600">Loading...</div>
            ) : proposal.error ? (
              <div className="text-red-600 text-sm">{proposal.error}</div>
            ) : (
              <div className="text-blue-900 font-medium">{proposal.getMarketName()}</div>
            )}
          </div>

          {/* Opening Time */}
          <div className="bg-green-50 rounded-lg p-4">
            <h4 className="font-medium text-green-800 mb-2">⏰ Opening Time</h4>
            {proposal.loading ? (
              <div className="text-green-600">Loading...</div>
            ) : proposal.error ? (
              <div className="text-red-600 text-sm">{proposal.error}</div>
            ) : (() => {
              const openingInfo = proposal.getOpeningTimeInfo();
              return openingInfo ? (
                <div className="space-y-1">
                  <div className="text-green-900 text-sm">📅 {openingInfo.localString}</div>
                  <div className="text-green-700 text-xs">
                    {openingInfo.isOpen ? '✅ Already Open' : `⏳ ${openingInfo.daysUntilOpening} days until opening`}
                  </div>
                </div>
              ) : (
                <div className="text-green-600">No opening time set</div>
              );
            })()}
          </div>
        </div>

        {/* Status */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Status:</span>
            <span className={`font-medium ${proposal.isReady ? 'text-green-600' : proposal.loading ? 'text-yellow-600' : 'text-red-600'}`}>
              {proposal.isReady ? '✅ Ready' : proposal.loading ? '⏳ Loading' : '❌ Not Ready'}
            </span>
          </div>
        </div>
      </div>

      {/* Company Info Hook Demo */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          🏢 Company Info Hook - <code className="text-sm bg-gray-100 px-2 py-1 rounded">useCompanyInfo()</code>
        </h3>
        
        <div className="bg-gray-900 rounded-lg p-4 mb-4">
          <pre className="text-green-400 text-sm">
{`// Super simple usage:
const { fetchCompanyInfo, companyInfo, loading } = useCompanyInfo();

// Fetch company info:
await fetchCompanyInfo(${companyId});`}
          </pre>
        </div>

        <div className="flex gap-4 mb-4">
          <button
            onClick={() => companyInfo.fetchCompanyInfo(companyId)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            disabled={companyInfo.loading}
          >
            {companyInfo.loading ? 'Fetching...' : `Fetch Company ${companyId}`}
          </button>
        </div>

        {companyInfo.companyInfo && (
          <div className="bg-purple-50 rounded-lg p-4">
            <h4 className="font-medium text-purple-800 mb-2">🏢 Company Data</h4>
            <div className="space-y-2 text-sm">
              <div><span className="font-medium">Name:</span> {companyInfo.companyInfo.name}</div>
              <div><span className="font-medium">Symbol:</span> {companyInfo.companyInfo.symbol}</div>
              <div><span className="font-medium">Market Cap:</span> ${companyInfo.companyInfo.market_cap?.toLocaleString()}</div>
              <div><span className="font-medium">Price:</span> ${companyInfo.companyInfo.current_price}</div>
            </div>
          </div>
        )}

        {companyInfo.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-red-800 text-sm">{companyInfo.error}</div>
          </div>
        )}
      </div>

      {/* Code Examples */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">💻 How Simple Is This?</h3>
        
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border-2 border-green-200">
            <h4 className="font-medium text-green-800 mb-2">⚡ ULTIMATE SIMPLICITY - Just 1 Line:</h4>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-green-400 text-sm">
{`const title = useProposalTitle('0x...');  // 🎯 That's it!
const { openingTime, isOpen } = useProposalOpeningTime('0x...');  // 🎯 Done!
const { currency, company, native } = useSimpleBalances();  // 💰 Clean balance access!
const poolData = usePoolPrices().getFormattedPoolData();  // 🏊 All pool prices with CORRECT conventions!`}
              </pre>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 mb-2">✨ Or Just 3 Lines for Everything:</h4>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-green-400 text-sm">
{`const { title, openingTime, isOpen } = useSimpleProposal('0x...');
const { currency, company, native } = useSimpleBalances();
const { getFormattedPoolData } = usePoolPrices();
// Now you have: proposal info, clean balances (currency.yes, company.base), and pool prices!`}
              </pre>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 mb-2">🎯 Available Super Simple Hooks:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium text-gray-700 mb-1">One-Line Hooks:</div>
                <ul className="text-gray-600 space-y-1">
                  <li>• <code>useProposalTitle(address)</code></li>
                  <li>• <code>useProposalOpeningTime(address)</code></li>
                  <li>• <code>useSimpleProposal(address)</code></li>
                  <li>• <code>useSimpleBalances()</code> 🆕</li>
                  <li>• <code>useFormattedBalances()</code> 🆕</li>
                  <li>• <code>usePoolPrices()</code></li>
                </ul>
              </div>
              <div>
                <div className="font-medium text-gray-700 mb-1">Clean Balance Access:</div>
                <ul className="text-gray-600 space-y-1">
                  <li>• <code>currency.base</code> - sDAI balance</li>
                  <li>• <code>currency.yes</code> - YES_sDAI balance</li>
                  <li>• <code>currency.no</code> - NO_sDAI balance</li>
                  <li>• <code>company.base</code> - GNO balance</li>
                  <li>• <code>company.yes</code> - YES_GNO balance</li>
                  <li>• <code>company.no</code> - NO_GNO balance</li>
                  <li>• <code>native</code> - xDAI balance</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-800">
              <span className="text-lg">🎉</span>
              <span className="font-medium">No complex setup, intuitive naming (currency.yes, company.base), proper price conventions!</span>
            </div>
          </div>
        </div>
      </div>

      {/* Debug Info */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">🔍 Debug Info</h3>
        <div className="text-sm space-y-2 font-mono bg-gray-50 p-3 rounded">
          <div><strong>Input Address:</strong> {testProposalAddress}</div>
          <div><strong>Context Address:</strong> {proposalContext.proposalAddress || 'None'}</div>
          <div><strong>Proposal Ready:</strong> {proposal.isReady ? 'Yes' : 'No'}</div>
          <div><strong>Context Ready:</strong> {proposalContext.isProposalReady() ? 'Yes' : 'No'}</div>
          <div><strong>Balances Proposal:</strong> {proposalBalances.proposalAddress || 'None'}</div>
          <div><strong>Balances Ready:</strong> {proposalBalances.tokensReady ? 'Yes' : 'No'}</div>
        </div>
      </div>
    </div>
  );
};

export default TestHooksDisplay; 