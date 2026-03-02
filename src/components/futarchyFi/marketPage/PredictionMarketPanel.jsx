import React, { useState } from 'react';

const PredictionMarketPanel = ({ 
  marketPrice = 105000,
  outcomes = {
    yes: 0.39,
    no: 0.62
  }
}) => {
  const [amount, setAmount] = useState(7);
  const [selectedOutcome, setSelectedOutcome] = useState('yes');
  const [side, setSide] = useState('buy');

  const calculateShares = () => {
    return (amount / outcomes[selectedOutcome]).toFixed(2);
  };

  const calculatePotentialReturn = () => {
    const shares = calculateShares();
    const maxReturn = shares * 1;
    const investment = amount;
    const profit = maxReturn - investment;
    const percentage = ((profit / investment) * 100).toFixed(2);
    return {
      value: profit.toFixed(2),
      percentage
    };
  };

  return (
    <div className="bg-white rounded-xl shadow-lg">
      <div className="p-4 border-b border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900">Trade</h3>
      </div>

      <div className="p-4">
        {/* Buy/Sell Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setSide('buy')}
            className={`flex-1 py-2 px-4 rounded-md transition-all ${
              side === 'buy' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => setSide('sell')}
            className={`flex-1 py-2 px-4 rounded-md transition-all ${
              side === 'sell' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Sell
          </button>
        </div>

        {/* Outcome Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Outcome
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSelectedOutcome('yes')}
              className={`p-3 rounded-md border ${
                selectedOutcome === 'yes' 
                  ? 'border-blue-500 bg-blue-50 text-blue-700' 
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              Yes {(outcomes.yes * 100).toFixed(0)}¢
            </button>
            <button
              onClick={() => setSelectedOutcome('no')}
              className={`p-3 rounded-md border ${
                selectedOutcome === 'no' 
                  ? 'border-blue-500 bg-blue-50 text-blue-700' 
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              No {(outcomes.no * 100).toFixed(0)}¢
            </button>
          </div>
        </div>

        {/* Amount Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Amount
          </label>
          <div className="flex items-center bg-gray-50 rounded-md border border-gray-200">
            <button 
              onClick={() => setAmount(prev => Math.max(1, prev - 1))}
              className="p-3 text-gray-500 hover:text-gray-700"
            >
              −
            </button>
            <div className="flex-1 text-center font-medium">${amount}</div>
            <button 
              onClick={() => setAmount(prev => prev + 1)}
              className="p-3 text-gray-500 hover:text-gray-700"
            >
              +
            </button>
          </div>
        </div>

        {/* Trade Details */}
        <div className="space-y-2 text-sm text-gray-600 mb-6">
          <div className="flex justify-between">
            <span>Price</span>
            <span>{(outcomes[selectedOutcome] * 100).toFixed(0)}¢</span>
          </div>
          <div className="flex justify-between">
            <span>Shares</span>
            <span>{calculateShares()}</span>
          </div>
          <div className="flex justify-between text-green-600">
            <span>Max Return</span>
            <span>${calculatePotentialReturn().value} ({calculatePotentialReturn().percentage}%)</span>
          </div>
        </div>

        {/* Action Button */}
        <button className="w-full bg-blue-500 text-white py-3 rounded-md font-medium hover:bg-blue-600 transition-colors">
          {side === 'buy' ? 'Buy Shares' : 'Sell Shares'}
        </button>
      </div>
    </div>
  );
};

export default PredictionMarketPanel; 