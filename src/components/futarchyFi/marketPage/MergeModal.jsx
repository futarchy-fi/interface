import React, { useState } from 'react';

const MergeModal = ({ balances, setBalances, onClose }) => {
  const [selectedToken, setSelectedToken] = useState('Conditional USDC');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const getAvailableBalances = () => {
    if (selectedToken === 'Conditional USDC') {
      return {
        yes: balances.usdcYes || 0,
        no: balances.usdcNo || 0,
        max: Math.min(balances.usdcYes || 0, balances.usdcNo || 0)
      };
    }
    return {
      yes: balances.faoYes || 0,
      no: balances.faoNo || 0,
      max: Math.min(balances.faoYes || 0, balances.faoNo || 0)
    };
  };

  const handleMerge = () => {
    const numAmount = Number(amount);
    setBalances(prev => ({
      ...prev,
      usdcYes: selectedToken === 'Conditional SDAI' ? prev.usdcYes - numAmount : prev.usdcYes,
      usdcNo: selectedToken === 'Conditional SDAI' ? prev.usdcNo - numAmount : prev.usdcNo,
      faoYes: selectedToken === 'Conditional FAO' ? prev.faoYes - numAmount : prev.faoYes,
      faoNo: selectedToken === 'Conditional FAO' ? prev.faoNo - numAmount : prev.faoNo,
      usdc: selectedToken === 'Conditional SDAI' ? prev.usdc + numAmount : prev.usdc,
      fao: selectedToken === 'Conditional FAO' ? prev.fao + numAmount : prev.fao
    }));
    onClose();
  };

  const handleMaxClick = () => {
    setAmount(getAvailableBalances().max.toString());
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    if (value === '' || (!isNaN(value) && Number(value) >= 0)) {
      setAmount(value);
      setError('');
    }
  };

  const handleInputBlur = () => {
    if (amount === '') return;

    const numAmount = Number(amount);
    const maxAmount = availableBalances.max;

    if (numAmount > maxAmount) {
      setError(`Value exceeds maximum allowed: ${maxAmount}`);
      setAmount(maxAmount.toString());
    } else {
      const roundedAmount = Number(numAmount.toFixed(2));
      setAmount(roundedAmount.toString());
      setError('');
    }
  };

  const availableBalances = getAvailableBalances();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">Merge Tokens</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Token Type
            </label>
            <select
              value={selectedToken}
              onChange={(e) => {
                setSelectedToken(e.target.value);
                setAmount('');
              }}
              className="w-full p-2 border rounded-md"
            >
              <option value="Conditional USDC">Conditional USDC</option>
              <option value="Conditional FAO">Conditional FAO</option>
            </select>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium mb-3">Available Balances:</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{selectedToken.split(' ')[1]}_YES:</span>
                <span>{availableBalances.yes.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{selectedToken.split(' ')[1]}_NO:</span>
                <span>{availableBalances.no.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium pt-2 border-t">
                <span>Maximum Mergeable:</span>
                <span>{availableBalances.max.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount to Merge
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                className={`w-full p-2 pr-16 border rounded-md ${
                  error ? 'border-red-500' : ''
                }`}
                placeholder="Enter amount"
                min="0"
                step="0.01"
              />
              {error && (
                <p className="mt-1 text-sm text-red-500">{error}</p>
              )}
              <button
                onClick={handleMaxClick}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-blue-500 hover:text-blue-600 font-medium"
              >
                MAX
              </button>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium mb-2">You will receive:</h4>
            <div className="flex justify-between">
              <span>{selectedToken.split(' ')[1]}:</span>
              <span>{amount || '0.00'}</span>
            </div>
          </div>

          <button
            onClick={handleMerge}
            disabled={!amount || Number(amount) > availableBalances.max}
            className="w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            Merge
          </button>
        </div>
      </div>
    </div>
  );
};

export default MergeModal; 