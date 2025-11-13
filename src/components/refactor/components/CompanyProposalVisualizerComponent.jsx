import { useState, useEffect } from 'react';
import { useProposalContext } from '../context/ProposalContext';
import { useProposal } from '../hooks/useProposal';
import { useProposalPricing } from '../hooks/useProposalPricing';
import { SmallTokenGrid } from './SmallTokenDisplay';

const LoadingSpinner = ({ className = "" }) => (
  <div className={`animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 ${className}`}></div>
);

const ProposalCard = ({ proposal, onSwitchToProposal, isCurrentProposal }) => {
  const [proposalData, setProposalData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Use the existing useProposal hook for each proposal
  const proposalHook = useProposal(proposal.proposal_id, false); // Don't auto-load
  
  // Use the new pricing hook when proposal is loaded
  const pricingHook = useProposalPricing();
  
  const loadProposalData = async () => {
    setLoading(true);
    setError(null);
    try {
      await proposalHook.loadProposal();
      setProposalData(proposalHook);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToProposal = async () => {
    try {
      await onSwitchToProposal(proposal.proposal_id);
    } catch (err) {
      console.error('Failed to switch to proposal:', err);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending_review': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'approved': return 'bg-green-100 border-green-300 text-green-800';
      case 'rejected': return 'bg-red-100 border-red-300 text-red-800';
      default: return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const formatPrice = (price) => {
    return price ? `€${parseFloat(price).toFixed(2)}` : 'N/A';
  };

  // Get pricing data when this proposal is the current one
  const shouldShowPricing = isCurrentProposal && pricingHook.hasData;
  const conventionalPrices = pricingHook.getConventionalPrices();
  const tokens = pricingHook.getTokens();
  const tokenMetadata = pricingHook.getTokenMetadata();
  const confidence = pricingHook.getConfidence();

  return (
    <div className={`bg-white rounded-lg shadow-md border-2 p-6 ${isCurrentProposal ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {proposal.proposal_title}
          </h3>
          <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(proposal.approval_status)}`}>
            {proposal.approval_status.replace('_', ' ').toUpperCase()}
          </div>
        </div>
        
        {isCurrentProposal && (
          <div className="ml-4">
            <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium">
              ✓ CURRENT
            </span>
          </div>
        )}
      </div>

      {/* Enhanced Pricing Section */}
      {shouldShowPricing && (
        <div className="mb-4 p-3 bg-gradient-to-r from-green-50 to-red-50 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-900 text-sm">💹 Live Pricing Data</h4>
            {pricingHook.loading && <LoadingSpinner className="w-3 h-3" />}
            <div className="text-xs text-gray-600">
              Confidence: {confidence}%
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-green-100 border border-green-300 rounded p-2">
              <span className="text-green-800 font-medium">IF YES Price:</span>
              <div className="font-bold text-green-700 text-lg">{conventionalPrices.ifYes}</div>
            </div>
            <div className="bg-red-100 border border-red-300 rounded p-2">
              <span className="text-red-800 font-medium">IF NO Price:</span>
              <div className="font-bold text-red-700 text-lg">{conventionalPrices.ifNo}</div>
            </div>
          </div>
        </div>
      )}

      {/* Original Pricing (from API) */}
      <div className="space-y-3 mb-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Approval Price:</span>
            <div className="font-medium text-green-600">{formatPrice(proposal.prices?.approval)}</div>
          </div>
          <div>
            <span className="text-gray-600">Refusal Price:</span>
            <div className="font-medium text-red-600">{formatPrice(proposal.prices?.refusal)}</div>
          </div>
        </div>
        
        <div className="text-sm">
          <span className="text-gray-600">Proposal ID:</span>
          <div className="font-mono text-xs bg-gray-100 p-2 rounded mt-1">
            {proposal.proposal_id}
          </div>
        </div>

        <div className="text-sm">
          <span className="text-gray-600">End Time:</span>
          <div className="font-medium">{new Date(proposal.end_time).toLocaleDateString()}</div>
        </div>

        {proposal.tags && proposal.tags.length > 0 && (
          <div className="text-sm">
            <span className="text-gray-600">Tags:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {proposal.tags.map((tag, index) => (
                <span key={index} className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Token Grid - Show when this proposal is current */}
      {shouldShowPricing && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
          <div className="text-sm text-gray-600 mb-2">🏷️ Proposal Tokens:</div>
          <SmallTokenGrid 
            tokens={tokens} 
            tokenMetadata={tokenMetadata}
            className="mb-2"
          />
          <div className="text-xs text-gray-500">
            Click 🔗 for Gnosis Scan, 📋 to copy, 🦊 to add to MetaMask
          </div>
        </div>
      )}

      {/* Pool Addresses */}
      <div className="text-sm space-y-2 mb-4">
        <div>
          <span className="text-gray-600">YES Pool:</span>
          <div className="font-mono text-xs bg-green-50 p-2 rounded">{proposal.pool_yes}</div>
        </div>
        <div>
          <span className="text-gray-600">NO Pool:</span>
          <div className="font-mono text-xs bg-red-50 p-2 rounded">{proposal.pool_no}</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-4 border-t border-gray-200">
        <button
          onClick={handleSwitchToProposal}
          disabled={isCurrentProposal}
          className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            isCurrentProposal 
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isCurrentProposal ? '✓ Current Proposal' : '🔄 Switch to This'}
        </button>
        
        <button
          onClick={loadProposalData}
          disabled={loading}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 text-sm font-medium"
        >
          {loading ? <LoadingSpinner className="mx-auto" /> : '📊 Load Details'}
        </button>
        
        {shouldShowPricing && (
          <button
            onClick={pricingHook.refreshPricing}
            disabled={pricingHook.loading}
            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm font-medium"
            title="Refresh Pricing"
          >
            {pricingHook.loading ? <LoadingSpinner className="mx-auto" /> : '💹'}
          </button>
        )}
      </div>

      {/* Proposal Details */}
      {proposalData && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
          <h4 className="font-medium text-gray-900 mb-2">📋 Proposal Details</h4>
          <div className="text-sm space-y-1">
            <div><strong>Market Name:</strong> {proposalData.getMarketName()}</div>
            <div><strong>Condition ID:</strong> <code className="text-xs">{proposalData.getConditionId()}</code></div>
            <div><strong>Status:</strong> {proposalData.isReady ? '✅ Ready' : '⏳ Loading'}</div>
            
            {/* Add Opening Time Information */}
            {proposalData.getOpeningTimeInfo && proposalData.getOpeningTimeInfo() && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                <div><strong>📅 Opening Time:</strong></div>
                <div className="text-xs space-y-1 mt-1">
                  <div>Date: {proposalData.getOpeningTimeInfo().localString}</div>
                  <div>UTC: {proposalData.getOpeningTimeInfo().utcString}</div>
                  <div>Status: {proposalData.getOpeningTimeInfo().isOpen ? '🟢 Open for voting' : '🔴 Not yet open'}</div>
                  {!proposalData.getOpeningTimeInfo().isOpen && (
                    <div>Opens in: {proposalData.getOpeningTimeInfo().daysUntilOpening} days</div>
                  )}
                </div>
              </div>
            )}
            
            {/* Add Question ID if available */}
            {proposalData.proposalData?.questionId && (
              <div className="mt-2">
                <strong>Question ID:</strong> 
                <code className="text-xs ml-1">{proposalData.proposalData.questionId}</code>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-800 text-sm">❌ {error}</div>
        </div>
      )}
    </div>
  );
};

const CompanyProposalVisualizerComponent = () => {
  const { changeProposal, proposalAddress: currentProposalAddress } = useProposalContext();
  const proposal = useProposalContext(); // Add this to access full proposal context
  const [companyData, setCompanyData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [switching, setSwitching] = useState(false);

  // Mock data for now - you can replace this with actual API call
  const mockCompanyData = {
    "company_id": 9,
    "currency_token": "GNO",
    "description": "Gnosis builds innovative projects in payments, identity, and internet freedom, driving change and shaping the future of decentralized technology.",
    "logo": "/assets/gnosis-dao-logo.png",
    "name": "Gnosis DAO",
    "proposals": [
      {
        "approval_status": "pending_review",
        "condition_id": "0xf51abb7623759d517c99b7826a09fc3258ef7a461cc48100062df47532b34cfa",
        "countdown_finish": false,
        "end_time": "2026-03-15T18:00:00+00:00",
        "participating_users": [],
        "pool_no": "0xfbf1BE5CE2f9056dAaB1C368EC241ad7Be3507A8",
        "pool_yes": "0xF336F812Db1ad142F22A9A4dd43D40e64B478361",
        "prices": {
          "approval": "250.00",
          "refusal": "230.00"
        },
        "proposal_id": "0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919",
        "proposal_title": "Will GnosisPay achieve more than €2,000,000 in transaction volume during any single full calendar week (Monday 00:00 UTC to Sunday 23:59 UTC) ending on or before June 30, 2025?",
        "proposals_markdown_market": [
          {
            "proposal_markdown": "# Will reaching €2M in weekly GnosisPay transactions drive up the price of GNO?\nGNO powers governance and utility for the Gnosis ecosystem, while GnosisPay connects crypto with everyday spending. Predict how real-world adoption might impact the token's value.",
            "proposal_market": "proposal"
          }
        ],
        "question_id": "C78679457A7CFBA6B25C6AFF5A94C218F3D38A78BB560509302FE304F0079EA4",
        "tags": [
          "expansao",
          "global",
          "estrategia"
        ],
        "timestamp": "2025-05-26T22:17:47.210777+00:00",
        "tokens": "2500000"
      }
    ],
    "stats": {
      "active_traders": 0,
      "proposals": 1,
      "volume": ""
    },
    "fetchedAt": "2025-06-04T00:20:16.827Z",
    "displayName": "Gnosis DAO",
    "hasValidData": false
  };

  const loadCompanyData = async () => {
    setLoading(true);
    setError(null);
    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/companies/gnosis-dao');
      // const data = await response.json();
      
      // For now, use mock data
      setCompanyData(mockCompanyData);
    } catch (err) {
      setError(`Failed to load company data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToProposal = async (proposalId) => {
    setSwitching(true);
    try {
      await changeProposal(proposalId);
    } catch (err) {
      setError(`Failed to switch to proposal: ${err.message}`);
    } finally {
      setSwitching(false);
    }
  };

  useEffect(() => {
    loadCompanyData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner className="w-8 h-8" />
        <span className="ml-2">Loading company data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-red-800">{error}</div>
        <button 
          onClick={loadCompanyData}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!companyData) {
    return (
      <div className="p-6 text-center text-gray-500">
        No company data available
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* Company Header */}
      <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border">
        <div className="flex items-center gap-4 mb-4">
          {companyData.logo && (
            <img 
              src={companyData.logo} 
              alt={`${companyData.name} logo`}
              className="w-16 h-16 rounded-lg object-cover"
            />
          )}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{companyData.name}</h1>
            <div className="text-lg text-gray-600">{companyData.currency_token} Company</div>
          </div>
        </div>
        
        <p className="text-gray-700 mb-4">{companyData.description}</p>
        
        <div className="flex gap-6 text-sm">
          <div className="bg-white px-4 py-2 rounded-lg border">
            <span className="text-gray-600">Proposals:</span>
            <div className="font-bold text-blue-600">{companyData.stats.proposals}</div>
          </div>
          <div className="bg-white px-4 py-2 rounded-lg border">
            <span className="text-gray-600">Active Traders:</span>
            <div className="font-bold text-green-600">{companyData.stats.active_traders}</div>
          </div>
          <div className="bg-white px-4 py-2 rounded-lg border">
            <span className="text-gray-600">Volume:</span>
            <div className="font-bold text-purple-600">{companyData.stats.volume || 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* Current Proposal Status */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">🎯 Current Active Proposal</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div><strong>Address:</strong> <code>{currentProposalAddress || 'None selected'}</code></div>
          
          {/* Add proposal information from context */}
          {proposal.isProposalReady() && (
            <>
              <div><strong>Market Name:</strong> {proposal.getMarketName()}</div>
              <div><strong>Condition ID:</strong> <code className="text-xs">{proposal.getConditionId()}</code></div>
              
              {/* Opening time info */}
              {proposal.getOpeningTimeInfo && proposal.getOpeningTimeInfo() && (
                <div>
                  <strong>Opening Time:</strong> {proposal.getOpeningTimeInfo().localString}
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${
                    proposal.getOpeningTimeInfo().isOpen ? 
                    'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {proposal.getOpeningTimeInfo().isOpen ? '🟢 Open' : '🔴 Not Open'}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
        {switching && (
          <div className="mt-2 flex items-center gap-2 text-blue-600">
            <LoadingSpinner className="w-4 h-4" />
            <span>Switching proposal...</span>
          </div>
        )}
      </div>

      {/* Proposals Grid */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          📋 Company Proposals ({companyData.proposals.length})
        </h2>
        
        {companyData.proposals.length === 0 ? (
          <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            No proposals found for this company
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {companyData.proposals.map((proposal) => (
              <ProposalCard
                key={proposal.proposal_id}
                proposal={proposal}
                onSwitchToProposal={handleSwitchToProposal}
                isCurrentProposal={currentProposalAddress === proposal.proposal_id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">💡 How to Use</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• <strong>Switch Proposal:</strong> Click "🔄 Switch to This" to make any proposal the active one</li>
          <li>• <strong>Load Details:</strong> Click "📊 Load Details" to fetch detailed proposal data</li>
          <li>• <strong>Current Proposal:</strong> The blue-highlighted card shows the currently active proposal</li>
          <li>• <strong>Integration:</strong> All other components (balances, swaps, pools) will use the active proposal's data</li>
        </ul>
      </div>
    </div>
  );
};

export default CompanyProposalVisualizerComponent; 