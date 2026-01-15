import React from 'react';

const MergeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M8 3v18M16 3v18M3 16h18M3 8h18" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SplitIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12H3M16 7l5 5-5 5M8 7l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const TokenBalances = ({ balances, onMergeClick, onSplitClick }) => {
  const totalConditionalUsdc = Math.max(balances.usdcYes || 0, balances.usdcNo || 0);
  const totalConditionalFao = Math.max(balances.faoYes || 0, balances.faoNo || 0);

  return (
    <div className="bg-gray-50 rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-sm font-medium">Your Balances:</h4>
        <div className="flex gap-2">
          <button
            onClick={onMergeClick}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <MergeIcon />
            Merge
          </button>
          <button
            onClick={onSplitClick}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <SplitIcon />
            Split
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex justify-between text-sm">
            <span>USDC:</span>
            <span>{balances.usdc}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Conditional USDC:</span>
            <span>{totalConditionalUsdc}</span>
          </div>
          <div className="flex justify-between text-sm pl-4 text-gray-500">
            <span>YES:</span>
            <span>{balances.usdcYes || 0}</span>
          </div>
          <div className="flex justify-between text-sm pl-4 text-gray-500">
            <span>NO:</span>
            <span>{balances.usdcNo || 0}</span>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm">
            <span>FAO:</span>
            <span>{balances.fao}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Conditional FAO:</span>
            <span>{totalConditionalFao}</span>
          </div>
          <div className="flex justify-between text-sm pl-4 text-gray-500">
            <span>YES:</span>
            <span>{balances.faoYes || 0}</span>
          </div>
          <div className="flex justify-between text-sm pl-4 text-gray-500">
            <span>NO:</span>
            <span>{balances.faoNo || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenBalances; 