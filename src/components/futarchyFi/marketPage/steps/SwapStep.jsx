import React, { useState } from 'react';

const SwapStep = ({ 
  direction, 
  wrappedAmount,
  setWrappedAmount,
  balances,
  setBalances,
  onNext,
  onBack 
}) => {
  const [confirmationStep, setConfirmationStep] = useState(null); // null, 'wrap', or 'buy'
  
  const handleWrap = () => {
    const amount = Number(wrappedAmount);
    setBalances(prev => ({
      ...prev,
      usdcYes: direction === 'increase' ? prev.usdcYes - amount : prev.usdcYes,
      usdcNo: direction === 'increase' ? prev.usdcNo : prev.usdcNo - amount,
      wUsdcYes: direction === 'increase' ? prev.wUsdcYes + amount : prev.wUsdcYes,
      wUsdcNo: direction === 'increase' ? prev.wUsdcNo : prev.wUsdcNo + amount
    }));
    setConfirmationStep('buy');
  };

  const handleBuyFao = () => {
    const amount = Number(wrappedAmount);
    setBalances(prev => ({
      ...prev,
      wUsdcYes: direction === 'increase' ? prev.wUsdcYes - amount : prev.wUsdcYes,
      wUsdcNo: direction === 'increase' ? prev.wUsdcNo : prev.wUsdcNo - amount,
      faoYes: direction === 'increase' ? prev.faoYes + amount : prev.faoYes,
      faoNo: direction === 'increase' ? prev.faoNo : prev.faoNo + amount
    }));
    onNext();
  };

  const maxAmount = direction === 'increase' ? balances.usdcYes : balances.usdcNo;

  if (confirmationStep) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 
              ${confirmationStep === 'wrap' ? 'border-blue-600 bg-blue-50' : 'border-green-500 bg-green-50'}`}>
              {confirmationStep === 'wrap' ? '1' : '✓'}
            </div>
            <span className="ml-2 text-sm font-medium">Wrap USDC</span>
          </div>
          <div className="flex-1 mx-4 border-t-2 border-gray-200" />
          <div className={`flex items-center ${confirmationStep === 'buy' ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2
              ${confirmationStep === 'buy' ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
              2
            </div>
            <span className="ml-2 text-sm font-medium">Buy FAO</span>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium mb-2">Confirm {confirmationStep === 'wrap' ? 'Wrap' : 'Buy'}:</h4>
          <div className="flex justify-between">
            <span>{wrappedAmount} {confirmationStep === 'wrap' 
              ? `USDC_${direction === 'increase' ? 'YES' : 'NO'}`
              : `wUSDC_${direction === 'increase' ? 'YES' : 'NO'}`}</span>
            <span>→</span>
            <span>{wrappedAmount} {confirmationStep === 'wrap' 
              ? `wUSDC_${direction === 'increase' ? 'YES' : 'NO'}`
              : `FAO_${direction === 'increase' ? 'YES' : 'NO'}`}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={() => setConfirmationStep(null)} 
            className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-md hover:bg-gray-200"
          >
            Back
          </button>
          <button
            onClick={confirmationStep === 'wrap' ? handleWrap : handleBuyFao}
            className="flex-1 bg-blue-500 text-white py-2 rounded-md"
          >
            Confirm {confirmationStep === 'wrap' ? 'Wrap' : 'Buy'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Buy FAO_{direction === 'increase' ? 'YES' : 'NO'}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={wrappedAmount}
            onChange={(e) => setWrappedAmount(Math.min(Number(e.target.value), maxAmount))}
            className="flex-1 p-2 border rounded-md"
            placeholder="Enter amount to buy"
            max={maxAmount}
          />
          <span className="text-sm text-gray-500">
            USDC_{direction === 'increase' ? 'YES' : 'NO'}
          </span>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium mb-2">You will receive:</h4>
        <div className="flex justify-between">
          <span>FAO_{direction === 'increase' ? 'YES' : 'NO'}</span>
          <span>{wrappedAmount || '0.00'}</span>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-md hover:bg-gray-200">
          Back
        </button>
        <button
          onClick={() => setConfirmationStep('wrap')}
          className="flex-1 bg-blue-500 text-white py-2 rounded-md"
        >
          Confirm Buy
        </button>
      </div>
    </div>
  );
};

export default SwapStep; 