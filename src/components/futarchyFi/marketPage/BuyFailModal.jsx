import React, { useState } from "react";
import PropTypes from "prop-types";
import { MetamaskIcon } from "./collateralModal/icons";

// ProcessingSteps component
const ProcessingSteps = ({ currentStep }) => {
  const steps = [
    { id: 'checkingBalance', label: 'Checking Balance' },
    { id: 'approvingBaseToken', label: 'Approving Base Token' },
    { id: 'splitting', label: 'Splitting Position' },
    { id: 'approvingWrapper', label: 'Approving Wrapper' },
    { id: 'wrappingYes', label: 'Wrapping YES Position' },
    { id: 'wrappingNo', label: 'Wrapping NO Position' },
    { id: 'approvingSwap', label: 'Approving Swap' },
    { id: 'swapping', label: 'Swapping to Company NO' }
  ];

  return (
    <div className="absolute inset-0 bg-white/95 flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-6 p-8">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center gap-3">
            {currentStep === step.id ? (
              <div className="w-5 h-5 border-2 border-futarchyGray12 border-t-transparent rounded-full animate-spin" />
            ) : currentStep === 'done' || steps.findIndex(s => s.id === currentStep) > index ? (
              <svg className="w-5 h-5 text-futarchyEmerald11" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-futarchyGray6" />
            )}
            <span className={`text-sm ${
              currentStep === step.id 
                ? 'text-futarchyGray12 font-medium'
                : currentStep === 'done' || steps.findIndex(s => s.id === currentStep) > index
                ? 'text-futarchyGray11'
                : 'text-futarchyGray9'
            }`}>
              {step.label}
            </span>
          </div>
        ))}
        {currentStep === 'done' && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <div className="w-12 h-12 bg-futarchyEmerald3 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-futarchyEmerald11" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-futarchyGray12 font-medium">Operation Complete!</p>
            <p className="text-futarchyGray11 text-sm text-center">
              Successfully bought your fail position.
              <br />
              The modal will close in a moment.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const BuyFailModal = ({
  title = 'Buy NO',
  supportText = 'Buy a NO position by adding collateral and swapping to company NO token.',
  handleClose,
  handleBuyFail,
  connectedWalletAddress,
  walletIcon = <MetamaskIcon />,
  alertContainerTitle = 'NO Position Information',
  alertSupportText = 'This will add collateral and swap to company NO token in one transaction.',
  tokenConfig,
  balances,
  processingStep
}) => {
  const [amount, setAmount] = useState('');

  // Get max amount based on available balance
  const getMaxAmount = () => {
    return balances?.wxdai || '0';
  };

  // Handle max button click
  const handleMaxClick = () => {
    const maxAmount = getMaxAmount();
    setAmount(maxAmount);
  };

  // Validate amount
  const isValidAmount = () => {
    const inputAmount = parseFloat(amount);
    const maxAmount = parseFloat(getMaxAmount());
    return inputAmount > 0 && inputAmount <= maxAmount;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center" onClick={handleClose}>
      <div className="flex flex-col relative w-[393px] h-full max-h-[739px] md:w-[480px] md:h-[638px] bg-white rounded-lg shadow-lg gap-4 p-6" onClick={(e) => e.stopPropagation()}>
        {processingStep && <ProcessingSteps currentStep={processingStep} />}
        
        <div className="flex justify-between items-center">
          <div className="text-xl text-futarchyGray12 font-medium">{title}</div>
          <button 
            onClick={handleClose}
            className="p-2 hover:bg-futarchyGray3 rounded-full transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="text-futarchyGray11 text-sm font-normal">{supportText}</div>

        <div className="flex flex-row bg-white border border-futarchyGray6 rounded p-4">
          <div className="flex flex-col gap-[2px]">
            <div className="text-futarchyGray11 text-sm font-normal">Connected Wallet</div>
            <div className="flex flex-row items-center gap-[6px] text-futarchyGray12 text-base font-medium">
              {walletIcon} {connectedWalletAddress ? `${connectedWalletAddress.slice(0, 6)}...${connectedWalletAddress.slice(-4)}` : 'No Connected Wallet'}
            </div>
          </div>
        </div>

        {/* Amount Input */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm text-futarchyGray11">Amount</label>
            <span className="text-sm text-futarchyGray11">
              Available: {Number(getMaxAmount()).toFixed(2)} {tokenConfig?.currency?.symbol || 'WXDAI'}
            </span>
          </div>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="w-full px-4 py-3 rounded-lg border border-futarchyGray4 focus:outline-none focus:ring-2 focus:ring-futarchyLavender"
            />
            <button
              onClick={handleMaxClick}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-futarchyLavender font-medium hover:text-futarchyLavender/90"
            >
              MAX
            </button>
          </div>
        </div>

        {/* Alert Container */}
        <div className="bg-futarchyGray3 rounded-lg p-4 mb-6">
          <h4 className="font-medium mb-1">{alertContainerTitle}</h4>
          <p className="text-sm text-futarchyGray11">{alertSupportText}</p>
        </div>

        {/* Action Button */}
        {processingStep ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {processingStep === 'done' ? (
                <div className="w-6 h-6 bg-futarchyEmerald3 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-futarchyEmerald11" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              ) : (
                <div className="w-5 h-5 border-2 border-futarchyGray12 border-t-transparent rounded-full animate-spin" />
              )}
              <span className="text-sm font-medium text-futarchyGray12">
                {processingStep === 'checkingBalance' && 'Checking Balance...'}
                {processingStep === 'approvingBaseToken' && 'Approving Base Token...'}
                {processingStep === 'splitting' && 'Splitting Position...'}
                {processingStep === 'approvingWrapper' && 'Approving Wrapper...'}
                {processingStep === 'wrappingYes' && 'Wrapping YES Position...'}
                {processingStep === 'wrappingNo' && 'Wrapping NO Position...'}
                {processingStep === 'approvingSwap' && 'Approving Swap...'}
                {processingStep === 'swapping' && 'Swapping to Company NO...'}
                {processingStep === 'done' && 'Operation Complete!'}
              </span>
            </div>
          </div>
        ) : (
          <button
            onClick={() => handleBuyFail(amount)}
            disabled={!isValidAmount()}
            className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
              isValidAmount()
                ? 'bg-futarchyRed hover:bg-futarchyRed/90 text-white'
                : 'bg-futarchyGray6 text-futarchyGray9 cursor-not-allowed'
            }`}
          >
            Buy NO
          </button>
        )}
      </div>
    </div>
  );
};

BuyFailModal.propTypes = {
  title: PropTypes.string,
  supportText: PropTypes.string,
  handleClose: PropTypes.func.isRequired,
  handleBuyFail: PropTypes.func.isRequired,
  connectedWalletAddress: PropTypes.string,
  walletIcon: PropTypes.element,
  alertContainerTitle: PropTypes.string,
  alertSupportText: PropTypes.string,
  tokenConfig: PropTypes.object.isRequired,
  balances: PropTypes.object.isRequired,
  processingStep: PropTypes.oneOf([
    'checkingBalance',
    'approvingBaseToken',
    'splitting',
    'approvingWrapper',
    'wrappingYes',
    'wrappingNo',
    'approvingSwap',
    'swapping',
    'done',
    null
  ]),
};

export default BuyFailModal; 