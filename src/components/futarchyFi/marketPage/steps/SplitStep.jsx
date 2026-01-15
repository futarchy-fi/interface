import React from 'react';

const SplitStep = ({ 
  direction, 
  splitAmount, 
  setSplitAmount, 
  onNext, 
  setBalances 
}) => {
  const handleSplit = () => {
    const amount = Number(splitAmount);
    setBalances(prev => ({
      ...prev,
      usdc: prev.usdc - amount,
      usdcYes: prev.usdcYes + amount,
      usdcNo: prev.usdcNo + amount
    }));
    onNext();
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Amount to Split
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={splitAmount}
            onChange={(e) => setSplitAmount(e.target.value)}
            className="flex-1 p-2 border rounded-md"
            placeholder="Enter SDAI amount"
          />
          <span className="text-sm text-gray-500">USDC</span>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium mb-2">You will receive:</h4>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>USDC_YES:</span>
            <span>{splitAmount || '0.00'}</span>
          </div>
          <div className="flex justify-between">
            <span>USDC_NO:</span>
            <span>{splitAmount || '0.00'}</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleSplit}
        disabled={!splitAmount}
        className="w-full bg-blue-500 text-white py-2 rounded-md disabled:opacity-50"
      >
        Split Tokens
      </button>
    </div>
  );
};

export default SplitStep; 