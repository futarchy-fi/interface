import React, { useState } from 'react';

const TokenBalance = ({ token, balance, subBalances }) => {
  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <div className="flex justify-between items-center">
        <span className="text-gray-300">{token}:</span>
        <span className="text-white font-medium">{balance.toFixed(2)}</span>
      </div>
      {subBalances && (
        <div className="mt-2 pt-2 border-t border-gray-700">
          {subBalances.map((sub, index) => (
            <div key={index} className="flex justify-between text-sm text-gray-400">
              <span>{sub.label}:</span>
              <span>{sub.value.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TokenBalance; 