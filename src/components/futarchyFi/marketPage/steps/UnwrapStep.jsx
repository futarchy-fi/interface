import React from 'react';

const UnwrapStep = ({ 
  direction, 
  wrappedAmount,
  balances,
  setBalances,
  onNext,
  onBack 
}) => {
  const handleUnwrap = () => {
    const amount = Number(wrappedAmount);
    setBalances(prev => ({
      ...prev,
      wFaoYes: direction === 'increase' ? prev.wFaoYes - amount : prev.wFaoYes,
      wFaoNo: direction === 'increase' ? prev.wFaoNo : prev.wFaoNo - amount,
      faoYes: direction === 'increase' ? prev.faoYes + amount : prev.faoYes,
      faoNo: direction === 'increase' ? prev.faoNo : prev.faoNo + amount
    }));
    onNext();
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Convert wFAO_{direction === 'increase' ? 'YES' : 'NO'} to FAO_{direction === 'increase' ? 'YES' : 'NO'}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={wrappedAmount}
            disabled
            className="flex-1 p-2 border rounded-md bg-gray-50"
          />
          <span className="text-sm text-gray-500">
            wFAO_{direction === 'increase' ? 'YES' : 'NO'}
          </span>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium mb-2">You will receive:</h4>
        <div className="flex justify-between">
          <span>FAO_{direction === 'increase' ? 'YES' : 'NO'}:</span>
          <span>{wrappedAmount || '0.00'}</span>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-md hover:bg-gray-200">
          Back
        </button>
        <button
          onClick={handleUnwrap}
          disabled={!wrappedAmount}
          className="flex-1 bg-blue-500 text-white py-2 rounded-md disabled:opacity-50"
        >
          Convert Tokens
        </button>
      </div>
    </div>
  );
};

export default UnwrapStep; 