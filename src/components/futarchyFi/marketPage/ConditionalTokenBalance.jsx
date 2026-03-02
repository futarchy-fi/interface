import React, { useState } from 'react';

const ConditionalTokenBalance = ({ type, balances }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  const getBalances = () => {
    if (type === 'USDC') {
      return {
        unwrapped: {
          yes: balances.usdcYes || 0,
          no: balances.usdcNo || 0
        },
        wrapped: {
          yes: balances.wUsdcYes || 0,
          no: balances.wUsdcNo || 0
        }
      };
    }
    return {
      unwrapped: {
        yes: balances.faoYes || 0,
        no: balances.faoNo || 0
      },
      wrapped: {
        yes: balances.wFaoYes || 0,
        no: balances.wFaoNo || 0
      }
    };
  };

  const tokenBalances = getBalances();
  const totalYes = tokenBalances.unwrapped.yes + tokenBalances.wrapped.yes;
  const totalNo = tokenBalances.unwrapped.no + tokenBalances.wrapped.no;
  const totalBalance = Math.max(totalYes, totalNo);

  return (
    <div className="relative">
      <div 
        className="flex justify-between items-center p-2 hover:bg-gray-100/10 rounded-md cursor-pointer"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span className="text-sm text-gray-400">Conditional {type}:</span>
        <span className="text-white">{totalBalance.toFixed(2)}</span>
      </div>
      
      {showTooltip && totalBalance > 0 && (
        <div className="absolute z-10 right-0 mt-1 w-48 bg-gray-800 rounded-md shadow-lg p-3 text-sm">
          <div className="space-y-3">
            <div>
              <div className="text-gray-400 mb-1">Unwrapped:</div>
              <div className="pl-2 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400">{type}_YES:</span>
                  <span className="text-white">{tokenBalances.unwrapped.yes.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{type}_NO:</span>
                  <span className="text-white">{tokenBalances.unwrapped.no.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div>
              <div className="text-gray-400 mb-1">Wrapped:</div>
              <div className="pl-2 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400">w{type}_YES:</span>
                  <span className="text-white">{tokenBalances.wrapped.yes.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">w{type}_NO:</span>
                  <span className="text-white">{tokenBalances.wrapped.no.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-700">
              <span className="text-gray-300">Total:</span>
              <span className="text-white font-medium">{totalBalance.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 

export default ConditionalTokenBalance;