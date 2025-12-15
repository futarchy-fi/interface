import React, { useState } from 'react';
import SplitStep from './steps/SplitStep';
import WrapStep from './steps/WrapStep';
import SwapStep from './steps/SwapStep';
import UnwrapStep from './steps/UnwrapStep';
import MergeStep from './steps/MergeStep';
import TokenBalances from './TokenBalances';
import CompletionAnimation from './CompletionAnimation';
import ConfirmationModal from './ConfirmationModal';
import TokenBalance from './TokenBalance';
import MergeModal from './MergeModal';
import SplitModal from './SplitModal';
import ConditionalTokenBalance from './ConditionalTokenBalance';

const ArrowIcon = () => (
  <svg 
    className="w-5 h-5" 
    viewBox="0 0 20 20" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M3.333 10h13.334M11.667 5l5 5-5 5" 
      stroke="currentColor" 
      strokeWidth={2} 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

const Step = ({ number, title, isActive, isCompleted }) => (
  <div className={`flex items-center ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
    <div className={`
      w-8 h-8 rounded-full flex items-center justify-center border-2
      ${isActive ? 'border-blue-600 bg-blue-50' : 
        isCompleted ? 'border-green-500 bg-green-50' : 'border-gray-300'}
    `}>
      {isCompleted ? '✓' : number}
    </div>
    <span className="ml-2 text-sm font-medium">{title}</span>
  </div>
);

const SpotMarketPanel = ({ selectedMarket }) => {
  const [side, setSide] = useState('buy'); // 'buy' or 'sell'
  const [outcome, setOutcome] = useState('approval'); // 'approval' or 'refusal'
  const [amount, setAmount] = useState('');
  const [balances, setBalances] = useState({
    usdc: 100,
    usdcYes: 0,
    usdcNo: 0,
    wUsdcYes: 0,
    wUsdcNo: 0,
    fao: 0,
    faoYes: 0,
    faoNo: 0,
    wFaoYes: 0,
    wFaoNo: 0
  });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationStep, setConfirmationStep] = useState(null); // null, 'wrap', 'buy'
  const [showCompletion, setShowCompletion] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);

  const handleConfirmationComplete = () => {
    setShowConfirmation(false);
    setShowCompletion(true);
    setTimeout(() => {
      setShowCompletion(false);
      setAmount('');
    }, 2000);
  };

  const handleAmountChange = (e) => {
    const value = e.target.value;
    
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  };

  const handleAmountBlur = () => {
    if (amount) {
      const formattedAmount = parseFloat(amount).toFixed(2);
      setAmount(formattedAmount);
    }
  };

  const getTotalAvailableBalance = () => {
    if (side === 'buy') {
      // When buying, show USDC + USDC_YES/NO depending on outcome
      return balances.usdc + (outcome === 'approval' ? balances.usdcYes : balances.usdcNo);
    } else {
      // When selling, show only FAO balance
      return outcome === 'approval' ? balances.faoYes : balances.faoNo;
    }
  };

  return (
    <div className="space-y-6">
      {/* Trading Panel */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl shadow-lg">
        {/* Buy/Sell Tabs */}
        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setSide('buy')}
            className={`flex-1 py-3 text-center transition-colors ${
              side === 'buy' 
                ? 'text-green-400 border-b-2 border-green-400' 
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => setSide('sell')}
            className={`flex-1 py-3 text-center transition-colors ${
              side === 'sell'
                ? 'text-red-400 border-b-2 border-red-400' 
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Sell
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Outcome Selection */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm text-gray-400">Outcome</label>
              <span className="text-xs text-gray-500">Slippage: 0.3%</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setOutcome('approval')}
                className={`p-4 rounded-lg border transition-all ${
                  outcome === 'approval'
                    ? 'bg-green-400/10 border-green-400 text-green-400'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                <div className="text-lg font-medium">Pass</div>
              </button>
              <button
                onClick={() => setOutcome('refusal')}
                className={`p-4 rounded-lg border transition-all ${
                  outcome === 'refusal'
                    ? 'bg-red-400/10 border-red-400 text-red-400'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                <div className="text-lg font-medium">Fail</div>
              </button>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Amount</label>
            <div className="flex items-center gap-2 p-2 border border-gray-700 rounded-lg">
              <button className="p-2 text-gray-400 hover:text-gray-300">-</button>
              <input
                type="text"
                value={amount}
                onChange={handleAmountChange}
                onBlur={handleAmountBlur}
                className="flex-1 bg-transparent text-center text-black"
                placeholder="0.00"
              />
              <button className="p-2 text-gray-400 hover:text-gray-300">+</button>
            </div>
          </div>

          {/* Token Balances Grid */}
          <div className="grid grid-cols-1 gap-4">
            {side === 'sell' && (
              <div className="space-y-2">
                <h4 className="text-sm text-gray-400">FAO</h4>
                <TokenBalance 
                  token={`FAO_${outcome === 'approval' ? 'YES' : 'NO'}`} 
                  balance={outcome === 'approval' ? balances.faoYes : balances.faoNo} 
                />
              </div>
            )}
            {side === 'buy' && (
              <div className="space-y-2">
                <h4 className="text-sm text-gray-400">Available USDC</h4>
                <TokenBalance 
                  token="USDC"
                  balance={getTotalAvailableBalance()}
                  subBalances={[
                    {
                      label: 'Regular USDC',
                      value: balances.usdc
                    },
                    {
                      label: `USDC_${outcome === 'approval' ? 'YES' : 'NO'}`,
                      value: outcome === 'approval' ? balances.usdcYes : balances.usdcNo
                    }
                  ]}
                />
              </div>
            )}
          </div>

          {/* Action Button */}
          <button
            onClick={() => setShowConfirmation(true)}
            disabled={!amount}
            className={`w-full py-3 rounded-lg font-medium transition-colors ${
              side === 'buy'
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-red-500 hover:bg-red-600 text-white'
            } disabled:opacity-50`}
          >
            {side === 'buy' ? 'Buy' : 'Sell'} {outcome === 'approval' ? 'FAO_YES' : 'FAO_NO'}
          </button>
        </div>
      </div>

      {/* Account Widget */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">Account</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowMergeModal(true)}
              className="text-sm px-3 py-1 rounded-md bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
            >
              Merge
            </button>
            <button
              onClick={() => setShowSplitModal(true)}
              className="text-sm px-3 py-1 rounded-md bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
            >
              Split
            </button>
          </div>
        </div>

        <div className="bg-black/20 rounded-lg p-4">
          <div className="space-y-3">
            <TokenBalance 
              token="USDC" 
              balance={balances.usdc}
              wrappedBalance={balances.wUsdcYes + balances.wUsdcNo} 
            />
            <ConditionalTokenBalance 
              type="USDC" 
              balances={balances}
            />
            <TokenBalance 
              token="FAO" 
              balance={balances.faoYes + balances.faoNo}
              wrappedBalance={balances.wFaoYes + balances.wFaoNo} 
            />
            <ConditionalTokenBalance 
              type="FAO" 
              balances={balances}
            />
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <ConfirmationModal
          side={side}
          outcome={outcome}
          amount={amount}
          balances={balances}
          setBalances={setBalances}
          onConfirm={handleConfirmationComplete}
          onClose={() => setShowConfirmation(false)}
        />
      )}

      {/* Add Completion Animation */}
      {showCompletion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
              <span className="text-white">✓</span>
            </div>
            <span className="font-medium">Transaction Complete!</span>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {showMergeModal && (
        <MergeModal
          balances={balances}
          setBalances={setBalances}
          onClose={() => setShowMergeModal(false)}
        />
      )}

      {/* Split Modal */}
      {showSplitModal && (
        <SplitModal
          balances={balances}
          setBalances={setBalances}
          onClose={() => setShowSplitModal(false)}
        />
      )}
    </div>
  );
};

export default SpotMarketPanel; 