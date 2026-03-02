import React from 'react';

const WrapStep = ({ 
  direction, 
  splitAmount,
  wrappedAmount,
  setWrappedAmount,
  balances,
  setBalances,
  onNext,
  onBack
}) => {
  const handleWrap = () => {
    const amount = Number(wrappedAmount);
    setBalances(prev => ({
      ...prev,
      usdcYes: direction === 'increase' ? prev.usdcYes - amount : prev.usdcYes,
      usdcNo: direction === 'increase' ? prev.usdcNo : prev.usdcNo - amount,
      wUsdcYes: direction === 'increase' ? prev.wUsdcYes + amount : prev.wUsdcYes,
      wUsdcNo: direction === 'increase' ? prev.wUsdcNo : prev.wUsdcNo + amount
    }));
    onNext();
  };

  const maxWrapAmount = direction === 'increase' ? balances.usdcYes : balances.usdcNo;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Wrap {direction === 'increase' ? 'USDC_YES' : 'USDC_NO'} into {direction === 'increase' ? 'wUSDC_YES' : 'wUSDC_NO'}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={wrappedAmount}
            onChange={(e) => setWrappedAmount(Math.min(Number(e.target.value), maxWrapAmount))}
            className="flex-1 p-2 border rounded-md"
            placeholder="Enter amount to wrap"
            max={maxWrapAmount}
          />
          <span className="text-sm text-gray-500">
            {direction === 'increase' ? 'USDC_YES' : 'USDC_NO'}
          </span>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium mb-2">You will receive:</h4>
        <div className="flex justify-between">
          <span>{direction === 'increase' ? 'wUSDC_YES' : 'wUSDC_NO'}:</span>
          <span>{wrappedAmount || '0.00'}</span>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-md hover:bg-gray-200"
        >
          Back
        </button>
        <button
          onClick={handleWrap}
          disabled={!wrappedAmount}
          className="flex-1 bg-blue-500 text-white py-2 rounded-md disabled:opacity-50"
        >
          Wrap Tokens
        </button>
      </div>
    </div>
  );
};

export default WrapStep; 