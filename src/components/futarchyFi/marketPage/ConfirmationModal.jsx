import React, { useState } from 'react';

const ConfirmationModal = ({ 
  side, 
  outcome, 
  amount, 
  onConfirm, 
  onClose,
  balances,
  setBalances 
}) => {
  const [step, setStep] = useState('split'); // 'split', 'wrap', or 'buy'

  const handleSplit = () => {
    const numAmount = Number(amount);
    setBalances(prev => ({
      ...prev,
      usdc: prev.usdc - numAmount,
      usdcYes: prev.usdcYes + numAmount,
      usdcNo: prev.usdcNo + numAmount
    }));
    setStep('wrap');
  };

  const handleWrap = () => {
    const numAmount = Number(amount);
    setBalances(prev => ({
      ...prev,
      usdcYes: outcome === 'approval' ? prev.usdcYes - numAmount : prev.usdcYes,
      usdcNo: outcome === 'refusal' ? prev.usdcNo - numAmount : prev.usdcNo,
    }));
    setStep('buy');
  };

  const handleBuy = () => {
    const numAmount = Number(amount);
    setBalances(prev => ({
      ...prev,
      usdcYes: outcome === 'approval' ? prev.usdcYes - numAmount : prev.usdcYes,
      usdcNo: outcome === 'refusal' ? prev.usdcNo - numAmount : prev.usdcNo,
      faoYes: outcome === 'approval' ? prev.faoYes + numAmount : prev.faoYes,
      faoNo: outcome === 'refusal' ? prev.faoNo + numAmount : prev.faoNo,
    }));
    onConfirm();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Confirm Transaction</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 
              ${step === 'split' ? 'border-blue-600 bg-blue-50' : 'border-green-500 bg-green-50'}`}>
              {step === 'split' ? '1' : '✓'}
            </div>
            <span className="ml-2 text-sm font-medium">Split USDC</span>
          </div>
          <div className="flex-1 mx-4 border-t-2 border-gray-200" />
          <div className={`flex items-center ${step === 'wrap' ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2
              ${step === 'wrap' ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
              2
            </div>
            <span className="ml-2 text-sm font-medium">Wrap USDC</span>
          </div>
          <div className="flex-1 mx-4 border-t-2 border-gray-200" />
          <div className={`flex items-center ${step === 'buy' ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2
              ${step === 'buy' ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
              3
            </div>
            <span className="ml-2 text-sm font-medium">Buy FAO</span>
          </div>
        </div>

        {/* Transaction Details */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="text-sm font-medium mb-2">
            {step === 'split' ? 'Split USDC' : step === 'wrap' ? 'Wrap USDC' : `Buy FAO_${outcome === 'approval' ? 'YES' : 'NO'}`}
          </h4>
          <div className="flex justify-between items-center">
            <span>{amount} {step === 'split' ? 'USDC' : step === 'wrap' ? 'USDC' : `USDC_${outcome === 'approval' ? 'YES' : 'NO'}`}</span>
            <span>→</span>
            <span>{amount} {step === 'split' ? 'USDC' : step === 'wrap' ? `USDC_${outcome === 'approval' ? 'YES' : 'NO'}` : `FAO_${outcome === 'approval' ? 'YES' : 'NO'}`}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={step === 'split' ? handleSplit : step === 'wrap' ? handleWrap : handleBuy}
            className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600"
          >
            Confirm {step === 'split' ? 'Split' : step === 'wrap' ? 'Wrap' : 'Buy'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal; 