import { useState } from 'react';
import { ProposalProvider, useProposalContext } from './context/ProposalContext';
import BalanceDisplay from './components/BalanceDisplay';
import EnhancedBalanceDisplay from './components/EnhancedBalanceDisplay';
import PoolPriceDisplay from './components/PoolPriceDisplay';
import CollateralManager from './components/CollateralManager';
import SmartSwapManager from './components/SmartSwapManager';
import CompanyInfoDisplay from './components/CompanyInfoDisplay';
import RealtimeDisplay from './components/RealtimeDisplay';
import ERC20DebugTest from './components/ERC20DebugTest';
import PoolSearchDemo from './components/PoolSearchDemo';
import CreateProposalComponent from './components/CreateProposalComponent';
import CompanyProposalVisualizerComponent from './components/CompanyProposalVisualizerComponent';
import TestHooksDisplay from './components/TestHooksDisplay';
import ArthurTests from './components/ArthurTests';

// Global Proposal Selector Component
const GlobalProposalSelector = () => {
  const { 
    proposalAddress, 
    changeProposal, 
    isLoading, 
    hasError, 
    error,
    moduleTitle,
    moduleDescription,
    getDisplayInfo,
    getOpeningTimeInfo,
    isOpenForVoting
  } = useProposalContext();
  
  const [newProposalAddress, setNewProposalAddress] = useState('');
  const [isChanging, setIsChanging] = useState(false);
  
  const displayInfo = getDisplayInfo();
  
  const handleProposalChange = async () => {
    if (!newProposalAddress.trim()) {
      alert('Please enter a proposal address');
      return;
    }

    setIsChanging(true);
    try {
      await changeProposal(newProposalAddress.trim());
      setNewProposalAddress('');
      alert('Proposal changed successfully! All components will now use the new proposal data.');
    } catch (err) {
      console.error('Error changing proposal:', err);
      alert(`Failed to change proposal: ${err.message}`);
    } finally {
      setIsChanging(false);
    }
  };

  const isCurrentlyLoading = isLoading() || isChanging;

  return (
    <div style={{ 
      marginBottom: '30px', 
      padding: '20px', 
      backgroundColor: '#F8FAFC', 
      border: '2px solid #E2E8F0', 
      borderRadius: '12px' 
    }}>
      {/* Module Title - Dynamic */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h1 style={{ 
          fontSize: '28px', 
          fontWeight: 'bold', 
          color: '#1A202C', 
          margin: '0 0 8px 0' 
        }}>
          🏛️ {moduleTitle}
        </h1>
        <p style={{ 
          fontSize: '16px', 
          color: '#4A5568', 
          margin: 0 
        }}>
          {moduleDescription}
        </p>
      </div>

      {/* Current Proposal Status */}
      <div style={{ 
        marginBottom: '20px', 
        padding: '15px', 
        backgroundColor: displayInfo.proposalAddress ? '#EDF7ED' : '#FEF3C7', 
        border: `2px solid ${displayInfo.proposalAddress ? '#10B981' : '#F59E0B'}`,
        borderRadius: '8px' 
      }}>
        <h3 style={{ 
          margin: '0 0 10px 0', 
          color: displayInfo.proposalAddress ? '#065F46' : '#92400E' 
        }}>
          📋 Current Proposal Status
        </h3>
        
        {displayInfo.proposalAddress ? (
          <div style={{ fontSize: '14px', color: '#065F46' }}>
            <div><strong>Market:</strong> {displayInfo.marketName}</div>
            <div><strong>Address:</strong> <code>{displayInfo.proposalAddress}</code></div>
            <div><strong>Status:</strong> ✅ Loaded & Ready - All components using dynamic data</div>
            {displayInfo.conditionId && (
              <div><strong>Condition ID:</strong> <code>{displayInfo.conditionId.slice(0, 10)}...</code></div>
            )}
            
            {/* Opening Time Display */}
            {(() => {
              const openingTimeInfo = getOpeningTimeInfo();
              
              // Temporary debugging
              console.log('🔍 Debug openingTimeInfo:', openingTimeInfo);
              console.log('🔍 Debug proposalData:', displayInfo);
              
              // Always show opening time section, even if null
              return (
                <div style={{ marginTop: '8px', padding: '8px', backgroundColor: openingTimeInfo ? '#F0FDF4' : '#FEF3C7', border: `1px solid ${openingTimeInfo ? '#10B981' : '#F59E0B'}`, borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      {openingTimeInfo ? (
                        <>
                          <div style={{ fontWeight: 'bold', color: '#065F46' }}>
                            📅 Voting Opens: {openingTimeInfo.utcString}
                          </div>
                          <div style={{ fontSize: '12px', color: '#047857', marginTop: '2px' }}>
                            Local: {openingTimeInfo.localString}
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontWeight: 'bold', color: '#92400E' }}>
                            📅 Voting Status: Unknown Opening Time
                          </div>
                          <div style={{ fontSize: '12px', color: '#92400E', marginTop: '2px' }}>
                            Opening time not set in Reality.io (returned 0)
                          </div>
                        </>
                      )}
                    </div>
                    <div>
                      {openingTimeInfo ? (
                        openingTimeInfo.isOpen ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            backgroundColor: '#10B981',
                            color: 'white'
                          }}>
                            🟢 OPEN FOR VOTING
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            backgroundColor: '#F59E0B',
                            color: 'white'
                          }}>
                            ⏳ {openingTimeInfo.daysUntilOpening > 0 
                              ? `${openingTimeInfo.daysUntilOpening}d until opening`
                              : openingTimeInfo.hoursUntilOpening > 0
                              ? `${openingTimeInfo.hoursUntilOpening}h until opening`  
                              : `${openingTimeInfo.minutesUntilOpening}m until opening`
                            }
                          </span>
                        )
                      ) : (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          backgroundColor: '#6B7280',
                          color: 'white'
                        }}>
                          ❓ UNKNOWN STATUS
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <div style={{ fontSize: '14px', color: '#92400E' }}>
            {isCurrentlyLoading ? (
              <div>⏳ Loading proposal data...</div>
            ) : hasError() ? (
              <div>❌ Error: {error}</div>
            ) : (
              <div>ℹ️ No proposal loaded - Enter address below</div>
            )}
          </div>
        )}
      </div>

      {/* Proposal Address Input */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <label style={{ 
          fontSize: '16px', 
          fontWeight: 'bold', 
          color: '#2D3748',
          minWidth: '140px' 
        }}>
          🔄 Change Proposal:
        </label>
        <input
          type="text"
          value={newProposalAddress}
          onChange={(e) => setNewProposalAddress(e.target.value)}
          placeholder="Enter proposal contract address (0x...)"
          style={{
            flex: 1,
            padding: '10px 12px',
            border: '2px solid #E2E8F0',
            borderRadius: '6px',
            fontSize: '14px',
            fontFamily: 'monospace',
            backgroundColor: 'white'
          }}
          disabled={isChanging}
        />
        <button
          onClick={handleProposalChange}
          disabled={!newProposalAddress.trim() || isChanging}
          style={{
            padding: '10px 20px',
            backgroundColor: '#3B82F6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: newProposalAddress.trim() && !isChanging ? 'pointer' : 'not-allowed',
            opacity: newProposalAddress.trim() && !isChanging ? 1 : 0.5,
            fontSize: '14px',
            fontWeight: 'bold',
            minWidth: '120px'
          }}
        >
          {isChanging ? 'Loading...' : 'Load Proposal'}
        </button>
      </div>

      {/* Global Impact Notice */}
      <div style={{ 
        marginTop: '15px', 
        padding: '10px', 
        backgroundColor: '#EBF4FF', 
        border: '1px solid #3B82F6',
        borderRadius: '6px',
        fontSize: '12px',
        color: '#1E40AF'
      }}>
        <strong>🌍 Global Impact:</strong> Changing the proposal here will update ALL components below 
        (Token Balances, Collateral Manager, Swap Manager, Realtime Data) to use the new proposal's tokens and data.
      </div>
    </div>
  );
};

// Main RefactorComponent Content (wrapped by provider)
const RefactorComponentContent = () => {
  const [activeTab, setActiveTab] = useState('enhanced-balances');

  const tabs = [
    { id: 'create-proposal', label: '🏛️ Create Proposal', component: CreateProposalComponent },
    { id: 'enhanced-balances', label: '💎 Enhanced Token Balances', component: EnhancedBalanceDisplay },
    { id: 'balances', label: 'Token Balances', component: BalanceDisplay },
    { id: 'pools', label: 'Pool Prices', component: PoolPriceDisplay },
    { id: 'collateral', label: 'Collateral Manager', component: CollateralManager },
    { id: 'swap', label: 'Smart Swap Manager', component: SmartSwapManager },
    { id: 'company', label: '🏢 Company Info', component: CompanyInfoDisplay },
    { id: 'realtime', label: '🔥 Realtime Demo', component: RealtimeDisplay },
    { id: 'erc20-debug', label: 'ERC20 Debug Test', component: ERC20DebugTest },
    { id: 'pool-search', label: '🏊 Pool Search & Create', component: PoolSearchDemo },
    { id: 'company-proposal-visualizer', label: '🏢 Company Proposal Visualizer', component: CompanyProposalVisualizerComponent },
    { id: 'testhooks', label: '🧪 Test Hooks', component: TestHooksDisplay },
    { id: 'arthur-tests', label: '🧪 Arthur Tests', component: ArthurTests }
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Global Proposal Selector */}
        <GlobalProposalSelector />

        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Active Component */}
        <div className="mb-8">
          {ActiveComponent && <ActiveComponent />}
        </div>

        {/* Documentation - Updated */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Enhanced Futarchy Module Documentation
          </h2>
          
          <div className="space-y-6">
            {/* Enhanced Token Display */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                💎 Enhanced Token Display
              </h3>
              <div className="border border-purple-200 bg-purple-50 rounded-lg p-3">
                <h4 className="font-medium text-purple-800">New Features</h4>
                <p className="text-sm text-purple-700 mb-2">
                  Complete token management with MetaMask integration, Gnosis Scan links, 
                  and visual token categorization.
                </p>
                <div className="text-xs text-purple-600">
                  <strong>Features:</strong> 🦊 MetaMask integration, 🔗 Gnosis Scan links, 
                  📋 Copy addresses, 🏷️ Token categorization, 🎨 Visual indicators
                </div>
              </div>
            </div>

            {/* Global Dynamic System */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                🌍 Global Dynamic Proposal System
              </h3>
              <div className="border border-purple-200 bg-purple-50 rounded-lg p-3">
                <h4 className="font-medium text-purple-800">Universal Contract Integration</h4>
                <p className="text-sm text-purple-700 mb-2">
                  The entire module now reads data dynamically from any FutarchyProposal contract. 
                  No more hardcoded token addresses - everything adapts to the loaded proposal.
                </p>
                <div className="text-xs text-purple-600">
                  <strong>Global Features:</strong> Market name as title, dynamic token addresses, 
                  ERC20 symbol reading, outcome token detection, universal component compatibility
                </div>
              </div>
            </div>

            {/* Architecture Overview */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Architecture Overview
              </h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Enhanced Structure:</h4>
                    <ul className="space-y-1 text-gray-600">
                      <li>• <code>context/</code> - Global ProposalProvider context</li>
                      <li>• <code>utils/tokenUtils.js</code> - MetaMask & Gnosis integration</li>
                      <li>• <code>hooks/useTokenManagement.js</code> - Token management hook</li>
                      <li>• <code>components/TokenDisplay.jsx</code> - Enhanced token UI</li>
                      <li>• All components use dynamic tokens via context</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Token Management:</h4>
                    <ul className="space-y-1 text-gray-600">
                      <li>• <strong>MetaMask Integration</strong> - Add tokens with one click</li>
                      <li>• <strong>Gnosis Scan Links</strong> - Direct blockchain explorer access</li>
                      <li>• <strong>Copy Addresses</strong> - Clipboard integration</li>
                      <li>• <strong>Visual Categories</strong> - Color-coded token types</li>
                      <li>• <strong>Chain Detection</strong> - Automatic Gnosis Chain switching</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Component Integration */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Component Integration Status
              </h3>
              <div className="space-y-3">
                <div className="border border-green-200 bg-green-50 rounded-lg p-3">
                  <h4 className="font-medium text-green-800">✅ Enhanced Components</h4>
                  <p className="text-sm text-green-700">
                    <strong>Enhanced Token Balances:</strong> Complete MetaMask integration, Gnosis Scan links, visual categorization.
                  </p>
                  <p className="text-sm text-green-700">
                    <strong>Realtime Demo:</strong> Uses dynamic pool addresses and market names from proposal contract.
                  </p>
                  <p className="text-sm text-green-700">
                    <strong>Pool Search & Create:</strong> Full Algebra/Swapr pool management with guided creation process.
                  </p>
                </div>
                <div className="border border-blue-200 bg-blue-50 rounded-lg p-3">
                  <h4 className="font-medium text-blue-800">🔄 Ready for Enhancement</h4>
                  <p className="text-sm text-blue-700">
                    <strong>Other Components:</strong> Can now access dynamic tokens and use enhanced display components 
                    for consistent MetaMask integration across the module.
                  </p>
                </div>
              </div>
            </div>

            {/* Token Management Guide */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Token Management Guide
              </h3>
              <div className="bg-gray-900 rounded-lg p-4 text-sm">
                <pre className="text-green-400">
{`// Using enhanced token display components
import { TokenDisplay, TokenGrid, TokenCategorySection } from '../components/TokenDisplay';
import { useTokenManagement } from '../hooks/useTokenManagement';

function MyTokenComponent() {
  const tokenManager = useTokenManagement();
  
  const handleAddToken = async (address, symbol) => {
    await tokenManager.addToMetaMask(address, symbol);
  };
  
  return (
    <TokenDisplay 
      tokenType="currencyYes"
      address="0x1234..."
      balance="1000.0"
      showBalance={true}
    />
  );
}`}
                </pre>
              </div>
            </div>

            {/* Features Overview */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Enhanced Features Overview
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <h4 className="font-medium text-orange-800">🦊 MetaMask Integration</h4>
                  <ul className="text-orange-700 text-xs mt-1 space-y-1">
                    <li>• One-click token addition</li>
                    <li>• Automatic chain switching</li>
                    <li>• Bulk token addition</li>
                    <li>• Network validation</li>
                  </ul>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h4 className="font-medium text-blue-800">🔗 Blockchain Integration</h4>
                  <ul className="text-blue-700 text-xs mt-1 space-y-1">
                    <li>• Gnosis Scan links</li>
                    <li>• Address copying</li>
                    <li>• Token validation</li>
                    <li>• Explorer integration</li>
                  </ul>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <h4 className="font-medium text-green-800">🎨 Enhanced UI</h4>
                  <ul className="text-green-700 text-xs mt-1 space-y-1">
                    <li>• Color-coded categories</li>
                    <li>• Visual token types</li>
                    <li>• Compact/full views</li>
                    <li>• Interactive elements</li>
                  </ul>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <h4 className="font-medium text-purple-800">🏊 Pool Management</h4>
                  <ul className="text-purple-700 text-xs mt-1 space-y-1">
                    <li>• Pool discovery by token pair</li>
                    <li>• Guided pool creation</li>
                    <li>• Automatic approvals</li>
                    <li>• Price calculation</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Pool Search & Create */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                🏊 Pool Search & Create
              </h3>
              <div className="border border-blue-200 bg-blue-50 rounded-lg p-3">
                <h4 className="font-medium text-blue-800">Algebra/Swapr Pool Management</h4>
                <p className="text-sm text-blue-700 mb-2">
                  Complete pool discovery and creation interface for Algebra/Swapr DEX. 
                  Search existing pools by token pair or create new ones with guided steps.
                </p>
                <div className="text-xs text-blue-600">
                  <strong>Features:</strong> 🔍 Pool search, 🏗️ Guided pool creation, 
                  💰 Automatic approvals, ⚡ Live balance checking, 🎯 Pool type detection
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main exported component with ProposalProvider wrapper
const RefactorComponent = () => {
  return (
    <ProposalProvider>
      <RefactorComponentContent />
    </ProposalProvider>
  );
};

export default RefactorComponent; 