import React, { useState, useEffect } from 'react';

const MergeStep = ({ 
  direction, 
  wrappedAmount,
  balances,
  setBalances,
  onNext,
  onBack 
}) => {
  const [mergeAmount, setMergeAmount] = useState(wrappedAmount);
  
  // Get opposite token amount from balances
  const oppositeAmount = direction === 'increase' ? balances.faoNo : balances.faoYes;

  useEffect(() => {
    setMergeAmount(Math.min(wrappedAmount, oppositeAmount));
  }, [wrappedAmount, oppositeAmount]);

  const handleMerge = () => {
    const amount = Number(mergeAmount);
    setBalances(prev => ({
      ...prev,
      faoYes: direction === 'increase' ? prev.faoYes - amount : prev.faoYes - amount,
      faoNo: direction === 'increase' ? prev.faoNo - amount : prev.faoNo - amount,
      usdc: prev.usdc + amount
    }));
    onNext();
  };

  const remainingUnmerged = wrappedAmount - mergeAmount;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Merge FAO_{direction === 'increase' ? 'YES' : 'NO'} to claim USDC
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={mergeAmount}
            onChange={(e) => setMergeAmount(Math.min(Number(e.target.value), Math.min(wrappedAmount, oppositeAmount)))}
            className="flex-1 p-2 border rounded-md"
            max={Math.min(wrappedAmount, oppositeAmount)}
          />
          <span className="text-sm text-gray-500">
            FAO_{direction === 'increase' ? 'YES' : 'NO'}
          </span>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium mb-2">Result:</h4>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>SDAI to Claim:</span>
            <span>{mergeAmount || '0.00'}</span>
          </div>
          {remainingUnmerged > 0 && (
            <div className="flex justify-between text-amber-600">
              <span>Remaining FAO_{direction === 'increase' ? 'YES' : 'NO'}:</span>
              <span>{remainingUnmerged}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-md hover:bg-gray-200">
          Back
        </button>
        <button
          onClick={handleMerge}
          disabled={!mergeAmount}
          className="flex-1 bg-blue-500 text-white py-2 rounded-md disabled:opacity-50"
        >
          Merge Tokens
        </button>
      </div>
    </div>
  );
};

export default MergeStep; 