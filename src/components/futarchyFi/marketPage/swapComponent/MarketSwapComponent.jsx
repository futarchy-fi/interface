import React, { useState, useMemo, useCallback } from 'react';
import { ethers } from 'ethers';
import TransactionModal from '../../../modals/transactionModal/TransactionModal';
import { SwapConfig } from '../../../modals/transactionModal/configs/SwapConfig';

// --- Mock Data ---
const MOCK_TOKEN_CONFIG = {
  currencyTokens: {
    baseToken: { symbol: 'SDAI', address: '0xBaseTokenAddressSDAI', decimals: 18, image: '/path/to/sdai.png', precision: 2 },
    yesToken: { symbol: 'YES-SDAI', address: '0xYesSDAITokenAddress', decimals: 18, image: '/path/to/yes-sdai.png', precision: 4 },
    noToken: { symbol: 'NO-SDAI', address: '0xNoSDAITokenAddress', decimals: 18, image: '/path/to/no-sdai.png', precision: 4 },
  },
  companyTokens: {
    baseToken: { symbol: 'GNO', address: '0xBaseTokenAddressGNO', decimals: 18, image: '/path/to/gno.png', precision: 2 },
    yesToken: { symbol: 'YES-GNO', address: '0xYesGNOTokenAddress', decimals: 18, image: '/path/to/yes-gno.png', precision: 4 },
    noToken: { symbol: 'NO-GNO', address: '0xNoGNOTokenAddress', decimals: 18, image: '/path/to/no-gno.png', precision: 4 },
  }
};
// This mock data is now more aligned with what the TransactionModal expects
// For now, we'll hardcode the active token set to currencyTokens.
// This would likely be a prop in a real implementation.

const MOCK_BALANCES = {
  currencyTokens: {
    baseTokenBalance: ethers.utils.parseUnits("1000", 18).toString(),
    yesTokenBalance: ethers.utils.parseUnits("150", 18).toString(),
    noTokenBalance: ethers.utils.parseUnits("75", 18).toString(),
  },
  companyTokens: {
    baseTokenBalance: ethers.utils.parseUnits("500", 18).toString(), // This would be the GNO balance if we were to use it.
    yesTokenBalance: ethers.utils.parseUnits("80", 18).toString(),
    noTokenBalance: ethers.utils.parseUnits("60", 18).toString(),
  }
};

const MOCK_PRICES = {
    yesAssetPrice: 0.6,
};

const formatDisplayBalance = (value, symbol, precision = 2) => {
  const num = parseFloat(value);
  if (isNaN(num)) return `${(0).toFixed(precision)} ${symbol || ''}`;
  return `${num.toFixed(precision)} ${symbol || ''}`; // we should select how many decimals to show
};

const MarketSwapComponent = ({ marketStatus = 'open' }) => {
  const [selectedOutcome, setSelectedOutcome] = useState('yes'); // 'yes' or 'no'
  const [selectedAction, setSelectedAction] = useState('buy'); // 'buy' or 'sell'
  const [amount, setAmount] = useState('');
  const [mockAccountConnected, setMockAccountConnected] = useState(true);
  
  // State for managing the transaction modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  const activeTokenSet = useMemo(() => (
    selectedAction === 'buy' ? MOCK_TOKEN_CONFIG.currencyTokens : MOCK_TOKEN_CONFIG.companyTokens
  ), [selectedAction]);

  const activeBalances = useMemo(() => (
    selectedAction === 'buy' ? MOCK_BALANCES.currencyTokens : MOCK_BALANCES.companyTokens
  ), [selectedAction]);

  const { yesAssetPrice } = MOCK_PRICES;
  const noAssetPrice = useMemo(() => 1 - yesAssetPrice, [yesAssetPrice]);

  const handleOutcomeSelect = useCallback((outcome) => {
    setSelectedOutcome(outcome);
  }, []);

  const handleActionSelect = useCallback((action) => {
    setSelectedAction(action);
    setAmount('');
  }, []);

  const handleAmountChange = useCallback((e) => {
    const newAmount = e.target.value;
    if (/^\d*\.?\d*$/.test(newAmount)) {
        setAmount(newAmount);
    }
  }, []);

  const activeBalance = useMemo(() => {
    let token;
    let balanceBN;

    if (selectedAction === 'buy') {
        token = activeTokenSet.baseToken;
        balanceBN = activeBalances.baseTokenBalance;
    } else { // Selling
        if (selectedOutcome === 'yes') {
            token = activeTokenSet.yesToken;
            balanceBN = activeBalances.yesTokenBalance;
        } else {
            token = activeTokenSet.noToken;
            balanceBN = activeBalances.noTokenBalance;
        }
    }
    
    const bal = ethers.utils.formatUnits(balanceBN || '0', token.decimals);
    return { balance: bal, symbol: token.symbol, precision: token.precision };
  }, [selectedAction, selectedOutcome, activeTokenSet, activeBalances]);

  const handleMaxClick = useCallback(() => {
    setAmount(activeBalance.balance);
  }, [activeBalance]);

  const calculatedOutcomes = useMemo(() => {
    const inputAmount = parseFloat(amount) || 0;
    
    // Define outcome-specific configurations
    const outcomeConfigs = {
      yes: {
        label: 'If Yes',
        pulseColor: 'bg-futarchyBlue9',
        textColor: 'text-futarchyBlue9',
      },
      no: {
        label: 'If No',
        pulseColor: 'bg-futarchyGold7',
        textColor: 'text-futarchyGold9',
      },
    };

    let primaryOutcomeAmount = '0.00', primaryOutcomeSymbol = '', primaryOutcomePrecision;
    let secondaryOutcomeAmount = '0.00', secondaryOutcomeSymbol = '', secondaryOutcomePrecision;
    let yesAmount, noAmount, yesSymbol, noSymbol, yesPrecision, noPrecision;

    if (selectedAction === 'buy') {
      secondaryOutcomeAmount = inputAmount;
      secondaryOutcomeSymbol = activeTokenSet.baseToken.symbol;
      secondaryOutcomePrecision = activeTokenSet.baseToken.precision;

      if (selectedOutcome === 'yes') {
        primaryOutcomeAmount = yesAssetPrice > 0 ? (inputAmount / yesAssetPrice) : 0;
        primaryOutcomeSymbol = activeTokenSet.yesToken.symbol;
        primaryOutcomePrecision = activeTokenSet.yesToken.precision;
        
        yesAmount = primaryOutcomeAmount;
        yesSymbol = primaryOutcomeSymbol;
        yesPrecision = primaryOutcomePrecision;
        noAmount = 0; // Or some other representation of "not applicable"
        noSymbol = activeTokenSet.noToken.symbol;
        noPrecision = activeTokenSet.noToken.precision;
      } else { // buying 'no'
        primaryOutcomeAmount = noAssetPrice > 0 ? (inputAmount / noAssetPrice) : 0;
        primaryOutcomeSymbol = activeTokenSet.noToken.symbol;
        primaryOutcomePrecision = activeTokenSet.noToken.precision;
        
        noAmount = primaryOutcomeAmount;
        noSymbol = primaryOutcomeSymbol;
        noPrecision = primaryOutcomePrecision;
        yesAmount = 0;
        yesSymbol = activeTokenSet.yesToken.symbol;
        yesPrecision = activeTokenSet.yesToken.precision;
      }
    } else { // Sell
      primaryOutcomeAmount = selectedOutcome === 'yes'
        ? (inputAmount * yesAssetPrice)
        : (inputAmount * noAssetPrice);
      primaryOutcomeSymbol = activeTokenSet.baseToken.symbol;
      primaryOutcomePrecision = activeTokenSet.baseToken.precision;
      
      yesAmount = selectedOutcome === 'yes' ? primaryOutcomeAmount : 0;
      noAmount = selectedOutcome === 'no' ? primaryOutcomeAmount : 0;
      yesSymbol = selectedOutcome === 'yes' ? primaryOutcomeSymbol : activeTokenSet.baseToken.symbol;
      noSymbol = selectedOutcome === 'no' ? primaryOutcomeSymbol : activeTokenSet.baseToken.symbol;
      yesPrecision = primaryOutcomePrecision;
      noPrecision = primaryOutcomePrecision;

      secondaryOutcomeAmount = inputAmount;
      secondaryOutcomeSymbol = selectedOutcome === 'yes' ? activeTokenSet.yesToken.symbol : activeTokenSet.noToken.symbol;
      secondaryOutcomePrecision = selectedOutcome === 'yes' ? activeTokenSet.yesToken.precision : activeTokenSet.noToken.precision;
    }

    const outcomes = {
      yes: {
        ...outcomeConfigs.yes,
        amount: (selectedAction === 'buy' && selectedOutcome === 'yes') || (selectedAction === 'sell' && selectedOutcome !== 'yes') ? primaryOutcomeAmount : secondaryOutcomeAmount,
        symbol: (selectedAction === 'buy' && selectedOutcome === 'yes') || (selectedAction === 'sell' && selectedOutcome !== 'yes') ? primaryOutcomeSymbol : secondaryOutcomeSymbol,
        precision: (selectedAction === 'buy' && selectedOutcome === 'yes') || (selectedAction === 'sell' && selectedOutcome !== 'yes') ? primaryOutcomePrecision : secondaryOutcomePrecision,
        type: (selectedAction === 'buy' && selectedOutcome === 'yes') || (selectedAction === 'sell' && selectedOutcome !== 'yes') ? 'Receive' : 'Recover',
      },
      no: {
        ...outcomeConfigs.no,
        amount: (selectedAction === 'buy' && selectedOutcome === 'no') || (selectedAction === 'sell' && selectedOutcome !== 'no') ? primaryOutcomeAmount : secondaryOutcomeAmount,
        symbol: (selectedAction === 'buy' && selectedOutcome === 'no') || (selectedAction === 'sell' && selectedOutcome !== 'no') ? primaryOutcomeSymbol : secondaryOutcomeSymbol,
        precision: (selectedAction === 'buy' && selectedOutcome === 'no') || (selectedAction === 'sell' && selectedOutcome !== 'no') ? primaryOutcomePrecision : secondaryOutcomePrecision,
        type: (selectedAction === 'buy' && selectedOutcome === 'no') || (selectedAction === 'sell' && selectedOutcome !== 'no') ? 'Receive' : 'Recover',
      }
    };

    return {
      first: selectedOutcome === 'yes' ? outcomes.yes : outcomes.no,
      second: selectedOutcome === 'yes' ? outcomes.no : outcomes.yes,
    };
  }, [amount, selectedAction, selectedOutcome, yesAssetPrice, noAssetPrice, activeTokenSet]);

  const handleConfirmSwap = () => {
    // This function now opens the modal
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => {
      setIsModalOpen(false);
  };

  const currentInputSymbol = useMemo(() => {
    if (selectedAction === 'buy') {
      return activeTokenSet.baseToken.symbol;
    }
    return selectedOutcome === 'yes' ? activeTokenSet.yesToken.symbol : activeTokenSet.noToken.symbol;
  }, [selectedAction, selectedOutcome, activeTokenSet]);
  
  // This is the amount we want to get (if buying) or the amount we are giving (if selling)
  const desiredOutputAmount = selectedAction === 'buy' ? calculatedOutcomes.first.amount : amount; //if sell it will use company instead (sell mode)

  const isSwapValid = useMemo(() => {
    if (marketStatus !== 'open') return false;
    if (!amount || parseFloat(amount) <= 0) return false;
    return parseFloat(amount) <= parseFloat(activeBalance.balance);
  }, [amount, activeBalance, marketStatus]);

  const outcomeButtonConfigs = {
    yes: {
      label: 'If Yes',
      activeClasses: 'bg-futarchyBlue3 dark:bg-futarchyBlue6/40 text-futarchyBlue11 dark:text-futarchyBlue6 border-2 border-b-0 border-futarchyBlue7',
      icon: <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
    },
    no: {
      label: 'If No',
      activeClasses: 'bg-futarchyGold3 dark:bg-futarchyGold6/30 text-futarchyGold11 dark:text-futarchyGold6 border-2 border-b-0 border-futarchyGold9',
      icon: <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
    }
  };

  const actionButtonConfigs = {
    buy: {
      label: 'Buy',
      activeClasses: 'bg-futarchyTeal4 text-futarchyTeal11 border-futarchyTeal7 dark:bg-futarchyTeal6/50 dark:text-futarchyTeal4 dark:border-futarchyTeal6'
    },
    sell: {
      label: 'Sell',
      activeClasses: 'bg-futarchyCrimson4 text-futarchyCrimson11 border-futarchyCrimson9 dark:bg-futarchyCrimson9/60 dark:text-futarchyCrimson7 dark:border-futarchyCrimson9'
    }
  };

  return (
    <>
      <div className="flex flex-col bg-futarchyGray3 dark:bg-futarchyDarkGray3 rounded-3xl border-2 border-futarchyGray62 dark:border-futarchyGray11/70 overflow-hidden">
        {/* Yes/No Selector as Tabs */}
        <div className="h-16 px-4 pt-4 border-b-2 border-futarchyGray62 dark:border-futarchyGray112/40 bg-futarchyGray2 dark:bg-futarchyDarkGray2">
          <div className="grid grid-cols-2 gap-3 -mb-px">
            {Object.entries(outcomeButtonConfigs).map(([outcome, config]) => (
              <button
                key={outcome}
                onClick={() => handleOutcomeSelect(outcome)}
                className={`group relative overflow-hidden flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold transition-colors duration-200 ease-in-out rounded-t-2xl ${
                  selectedOutcome === outcome
                    ? config.activeClasses
                    : 'bg-transparent text-futarchyGray11 border-2 border-transparent'
                }`}
              >
                {config.icon}
                <span>{config.label}</span>
                <div className={`absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent ${selectedOutcome === outcome ? 'via-white/20' : 'via-black/10'} dark:via-white/20 to-transparent transform -translate-x-full -skew-x-12 group-hover:translate-x-full transition-transform duration-500 ease-in-out pointer-events-none`}></div>
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 space-y-3">
          {/* Buy/Sell Buttons */}
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(actionButtonConfigs).map(([action, config]) => (
              <button
                key={action}
                onClick={() => handleActionSelect(action)}
                className={`group relative overflow-hidden py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ease-in-out border-2 ${
                  selectedAction === action
                    ? config.activeClasses
                    : 'bg-futarchyGray2 text-futarchyGray11 border-futarchyGray62 dark:bg-futarchyDarkGray2 dark:text-futarchyGray112 dark:border-futarchyGray112/40'
                }`}
              >
                {config.label}
                <div className={`absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent ${selectedAction === action ? 'via-white/20' : 'via-black/10'} dark:via-white/20 to-transparent transform -translate-x-full -skew-x-12 group-hover:translate-x-full transition-transform duration-500 ease-in-out pointer-events-none`}></div>
              </button>
            ))}
          </div>

          {/* Amount Input */}
          <div>
            <label className="text-futarchyGray12 dark:text-futarchyGray3 text-xs font-semibold mb-1 block">
              Amount ({currentInputSymbol})
            </label>
            <div className="relative">
              <div className="flex items-center border-2 border-futarchyGray62 dark:border-futarchyGray112/40 bg-futarchyGray2 dark:bg-futarchyDarkGray2 rounded-xl h-12">
                <input
                  type="text"
                  value={amount}
                  onChange={handleAmountChange}
                  className="flex-1 h-full px-4 bg-transparent text-futarchyGray12 dark:text-futarchyGray3 focus:outline-none rounded-xl"
                  placeholder="0.00"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
                  <button
                    onClick={handleMaxClick}
                    className="px-2 py-1 bg-futarchyGray4 dark:bg-transparent text-futarchyGray11 rounded text-xs font-medium hover:bg-futarchyGray5 transition-colors"
                  >
                    Max
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-futarchyGray11 dark:text-futarchyGray112">Available</span>
              <span
                onClick={handleMaxClick}
                className="text-futarchyGray12 dark:text-futarchyGray112 font-medium cursor-pointer hover:text-futarchyGray11 transition-colors"
              >
                {formatDisplayBalance(activeBalance.balance, activeBalance.symbol, activeBalance.precision)}
              </span>
            </div>
          </div>

          {/* Outcomes Section */}
          <div>
            <h3 className="text-futarchyGray12 dark:text-futarchyGray3 text-xs font-semibold mb-1 block">
              Outcomes
            </h3>
            <div className="flex rounded-2xl border-2 border-futarchyGray62 dark:border-futarchyGray112/40 bg-futarchyGray2 dark:bg-futarchyDarkGray2 overflow-hidden">
              {[calculatedOutcomes.first, calculatedOutcomes.second].map((outcome, index) => (
                <div key={index} className={`flex-1 flex flex-col items-center p-3 ${index === 0 ? 'border-r-2 border-futarchyGray62 dark:border-futarchyGray112/40' : ''}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${outcome.pulseColor} animate-pulse`}></div>
                    <span className="text-sm text-futarchyGray11 dark:text-white/70 font-medium">{outcome.label}</span>
                  </div>
                  <span className={`text-sm font-semibold h-6 flex items-center ${outcome.textColor}`}>
                    {formatDisplayBalance(outcome.amount, outcome.symbol, outcome.precision)}
                  </span>
                  <span className="text-xs text-futarchyGray11 dark:text-futarchyGray112">{outcome.type}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Confirm Transaction Button */}
          {mockAccountConnected ? (
            <button
              onClick={handleConfirmSwap}
              className="group relative overflow-hidden w-full py-3 px-4 rounded-xl font-semibold transition-colors text-sm bg-futarchyGray2 dark:bg-futarchyDarkGray2 border-2 border-futarchyGray62 dark:border-futarchyGray112/40 text-black dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!isSwapValid}
            >
              <span className="relative z-10">Confirm Swap</span>
              {isSwapValid && (
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-black/10 dark:via-white/20 to-transparent transform -translate-x-full -skew-x-12 group-hover:translate-x-full transition-transform duration-500 ease-in-out pointer-events-none"></div>
              )}
            </button>
          ) : (
            <button
              onClick={() => { console.log("Connect Wallet clicked"); setMockAccountConnected(true); }}
              className="group relative overflow-hidden w-full py-3 px-4 rounded-xl font-semibold transition-colors text-sm bg-futarchyGray2 dark:bg-futarchyDarkGray2 border-2 border-futarchyGray62 dark:border-futarchyGray112/40 text-black dark:text-white"
            >
              <span className="relative z-10">Connect Wallet</span>
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-black/10 dark:via-white/20 to-transparent transform -translate-x-full -skew-x-12 group-hover:translate-x-full transition-transform duration-500 ease-in-out pointer-events-none"></div>
            </button>
          )}
        </div>
      </div>
      
      {isModalOpen && (
          <TransactionModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            config={SwapConfig}
            transactionType={selectedAction === 'buy' ? 'Buy' : 'Sell'}
            outcome={selectedOutcome === 'yes' ? 'YES' : 'NO'}
            swapMethod="cowswap" // Mocked for now
            tokenConfig={activeTokenSet}
            balances={activeBalances}
            desiredOutputAmount={desiredOutputAmount}
            isAmountValid={isSwapValid}
            requiresCollateral={false} // For a direct swap, we assume no collateral is needed upfront
          >
            <div className="bg-futarchyGray2 dark:bg-futarchyDarkGray2 border-2 border-futarchyGray62 dark:border-futarchyGray11/70 rounded-2xl p-4 text-sm text-futarchyDarkGray3 dark:text-futarchyGray112">
                <p>You are preparing to <strong>{selectedAction} {amount} {currentInputSymbol}</strong>.</p>
                <p>You will receive approximately <strong>{formatDisplayBalance(calculatedOutcomes.first.amount, calculatedOutcomes.first.symbol, calculatedOutcomes.first.precision)}</strong>.</p>
                <p className="mt-1 text-xs text-futarchyGray10">(Mock price & min received not shown yet)</p>
            </div>
          </TransactionModal>
      )}
    </>
  );
};

export default MarketSwapComponent;
