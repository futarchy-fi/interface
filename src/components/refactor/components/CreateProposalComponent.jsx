import { useState, useEffect } from 'react';
import { useProposalContext } from '../context/ProposalContext';
import { useProposalCreation } from '../hooks/useProposalCreation';
import { getStatusStyle, formatInputClassName, formatMonoInputClassName } from '../utils/formUtils';

const LoadingSpinner = () => (
  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
);

const CreateProposalComponent = () => {
  const proposal = useProposalContext();
  const {
    // State from hook
    isSubmitting,
    submitStatus,
    transactionHash,
    createdProposalAddress,
    // Functions from hook
    getDefaultFormData,
    createProposal,
    switchToCreatedProposal,
    resetCreation
  } = useProposalCreation();
  
  // Form state
  const [formData, setFormData] = useState(() => getDefaultFormData());

  // Initialize form data when component mounts
  useEffect(() => {
    setFormData(getDefaultFormData());
  }, []);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await createProposal(formData);
  };

  const handleLoadCreatedProposal = async () => {
    try {
      const result = await switchToCreatedProposal();
      if (result.success) {
        // The hook handles the status message, no need for alert
        console.log('Successfully switched to new proposal');
      }
    } catch (error) {
      console.error('Failed to switch to proposal:', error);
    }
  };

  const handleReset = () => {
    setFormData(getDefaultFormData());
    resetCreation();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          🏛️ Create Futarchy Proposal
        </h2>
        <p className="text-gray-600">
          Create a new futarchy proposal with prediction markets for decision making
        </p>
      </div>

      {/* Current Proposal Status */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Current Proposal Context</h3>
        {proposal.isProposalReady() ? (
          <div className="text-sm text-blue-700">
            <div><strong>Loaded:</strong> {proposal.getMarketName()}</div>
            <div><strong>Address:</strong> <code>{proposal.proposalAddress}</code></div>
            <div className="text-blue-600 mt-1">
              ✅ You can create a new proposal and switch to it, or continue using the current one
            </div>
          </div>
        ) : (
          <div className="text-sm text-blue-700">
            ℹ️ No proposal currently loaded. Create one below to get started.
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Factory Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Futarchy Factory Address
          </label>
          <input
            type="text"
            value={formData.factoryAddress}
            onChange={(e) => handleInputChange('factoryAddress', e.target.value)}
            className={formatMonoInputClassName()}
            placeholder="0x..."
          />
          <p className="text-xs text-gray-500 mt-1">
            Default: Gnosis Chain Futarchy Factory
          </p>
        </div>

        {/* Market Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Market Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.marketName}
            onChange={(e) => handleInputChange('marketName', e.target.value)}
            className={formatInputClassName()}
            placeholder="e.g., Should we implement feature X by Q2 2024?"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            The question or decision that will be voted on
          </p>
        </div>

        {/* Token Addresses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company Token Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.companyToken}
              onChange={(e) => handleInputChange('companyToken', e.target.value)}
              className={formatMonoInputClassName()}
              placeholder="0x..."
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Default: GNO token
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency Token Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.currencyToken}
              onChange={(e) => handleInputChange('currencyToken', e.target.value)}
              className={formatMonoInputClassName()}
              placeholder="0x..."
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Default: sDAI token
            </p>
          </div>
        </div>

        {/* Category and Language */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
              className={formatInputClassName()}
              placeholder="e.g., crypto, tech, governance"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Language
            </label>
            <input
              type="text"
              value={formData.language}
              onChange={(e) => handleInputChange('language', e.target.value)}
              className={formatInputClassName()}
              placeholder="e.g., en, es, fr"
            />
          </div>
        </div>

        {/* Min Bond */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Minimum Bond (wei)
          </label>
          <input
            type="text"
            value={formData.minBond}
            onChange={(e) => handleInputChange('minBond', e.target.value)}
            className={formatMonoInputClassName()}
            placeholder="1000000000000000000"
          />
          <p className="text-xs text-gray-500 mt-1">
            Default: 1 ETH (1000000000000000000 wei)
          </p>
        </div>

        {/* Opening Time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Market Opening Time <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            value={formData.openingTime}
            onChange={(e) => handleInputChange('openingTime', e.target.value)}
            className={formatInputClassName()}
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            When the proposal will be available for resolution (default: 3 months from now)
          </p>
        </div>

        {/* Submit Buttons */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner />
                Creating Proposal...
              </>
            ) : (
              <>
                🚀 Create Proposal
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            🔄 Reset Form
          </button>

          {createdProposalAddress && (
            <button
              type="button"
              onClick={handleLoadCreatedProposal}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              🔄 Switch to New Proposal
            </button>
          )}
        </div>
      </form>

      {/* Status Messages */}
      {submitStatus && (
        <div className={`mt-6 p-4 rounded-lg border ${getStatusStyle(submitStatus.type)}`}>
          <div className="text-sm">
            {submitStatus.message}
          </div>
          
          {transactionHash && (
            <div className="mt-2">
              <a
                href={`https://gnosisscan.io/tx/${transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline text-sm"
              >
                View on Gnosisscan →
              </a>
            </div>
          )}
        </div>
      )}

      {/* Info Section */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">ℹ️ How It Works</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• <strong>Company Token:</strong> The asset whose price will be affected by the proposal (e.g., GNO)</li>
          <li>• <strong>Currency Token:</strong> The base currency for trading (e.g., sDAI)</li>
          <li>• <strong>Prediction Markets:</strong> Created automatically for YES/NO outcomes</li>
          <li>• <strong>Conditional Tokens:</strong> Generated for position trading</li>
          <li>• <strong>Opening Time:</strong> When the proposal becomes available for resolution</li>
        </ul>
        
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <h5 className="font-medium text-blue-900 mb-1">🏗️ Architecture</h5>
          <div className="text-xs text-blue-700 space-y-1">
            <div>• <strong>Constants:</strong> Default values and addresses in <code>/constants</code></div>
            <div>• <strong>Hook:</strong> Business logic in <code>useProposalCreation</code></div>
            <div>• <strong>Utils:</strong> Form validation and styling in <code>/utils</code></div>
            <div>• <strong>Component:</strong> Clean UI layer with minimal logic</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateProposalComponent; 