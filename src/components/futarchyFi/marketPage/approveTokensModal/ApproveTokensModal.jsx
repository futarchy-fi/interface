import React, { useState } from "react";
import PropTypes from "prop-types";
import { MetamaskIcon } from "../collateralModal/icons";

// Progress Bar Component
const ProgressBar = ({ currentStep, onStepClick, completedSteps }) => {
  const steps = [
    { icon: "🔒", label: "Approve" },
    { icon: "💰", label: "Add" },
    { icon: "↔️", label: "Swap" }
  ];

  return (
    <div className="w-full mb-6">
      <div className="relative flex justify-between items-center">
        {/* Connection lines - adjusted positioning */}
        <div className="absolute left-[5%] right-[5%] top-5 h-[2px] bg-futarchyGray6" />
        <div 
          className="absolute top-5 h-[2px] bg-futarchyGray12 transition-all duration-300"
          style={{ 
            left: '5%',
            width: currentStep === 1 ? '0%' : 
                   currentStep === 2 ? '45%' : '90%' 
          }}
        />

        {/* Step circles */}
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber <= currentStep;
          const isCurrent = stepNumber === currentStep;
          const isCompleted = completedSteps.includes(stepNumber);
          const canClick = isCompleted || stepNumber <= Math.max(...completedSteps) + 1;

          return (
            <div 
              key={index} 
              className="relative flex flex-col items-center z-10"
              onClick={() => canClick && onStepClick(stepNumber)}
              style={{ cursor: canClick ? 'pointer' : 'not-allowed' }}
            >
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  isActive 
                    ? 'bg-futarchyGray12 border-futarchyGray12 text-white'
                    : 'bg-white border-futarchyGray6 text-futarchyGray11'
                } ${
                  isCurrent ? 'ring-4 ring-futarchyGray6' : ''
                }`}
              >
                {step.icon}
              </div>
              <span className={`mt-2 text-sm ${
                isActive ? 'text-futarchyGray12' : 'text-futarchyGray11'
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Token Approval Switch Component
const TokenSwitch = ({ token, isApproved, onToggle }) => {
  const tokenIcons = {
    GNO: "🔵", // We can replace these with proper SVG icons
    sDAI: "🟡", // We can replace these with proper SVG icons
  };

  return (
    <div className="flex items-center justify-between p-4 border border-futarchyGray6 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-futarchyGray4 rounded-full flex items-center justify-center">
          {tokenIcons[token]}
        </div>
        <span className="text-futarchyGray12 font-medium">{token}</span>
      </div>
      <button
        onClick={onToggle}
        className={`px-4 py-2 rounded-full transition-all duration-300 ${
          isApproved 
            ? 'bg-futarchyGray12 text-white' 
            : 'bg-futarchyGray4 text-futarchyGray11'
        }`}
      >
        {isApproved ? 'Approved' : 'Approve'}
      </button>
    </div>
  );
};

// Wallet Information Component
const WalletInformation = ({ walletAddress, walletIcon }) => {
  const truncateAddress = (address) => {
    if (!address) return "No Connected Wallet";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="flex flex-row bg-white border border-futarchyGray6 rounded p-4">
      <div className="flex flex-col gap-[2px]">
        <div className="text-futarchyGray11 text-sm font-normal">Connected Wallet</div>
        <div className="flex flex-row items-center gap-[6px] text-futarchyGray12 text-base font-medium">
          {walletIcon} {truncateAddress(walletAddress)}
        </div>
      </div>
    </div>
  );
};

const ApproveTokensModal = ({
  handleClose,
  connectedWalletAddress,
  walletIcon = <MetamaskIcon />,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [approvedTokens, setApprovedTokens] = useState({
    GNO: false,
    sDAI: false,
  });

  const handleTokenApproval = (token) => {
    setApprovedTokens(prev => {
      const newState = { ...prev, [token]: !prev[token] };
      console.log(`Token ${token} ${newState[token] ? 'Approved' : 'Not Approved'}`);
      return newState;
    });
  };

  const canProceedToNextStep = () => {
    if (currentStep === 1) {
      return approvedTokens.GNO && approvedTokens.sDAI;
    }
    return true;
  };

  const handleStepClick = (stepNumber) => {
    // Can only click on completed steps or the next available step
    if (completedSteps.includes(stepNumber) || stepNumber <= Math.max(...completedSteps, 0) + 1) {
      setCurrentStep(stepNumber);
      console.log(`Navigated to step ${stepNumber}`);
    }
  };

  const handleNextStep = () => {
    if (canProceedToNextStep()) {
      // Mark current step as completed
      if (!completedSteps.includes(currentStep)) {
        setCompletedSteps(prev => [...prev, currentStep]);
      }
      // Move to next step
      setCurrentStep(prev => Math.min(prev + 1, 3));
      console.log(`Step ${currentStep} completed`);
    }
  };

  const handleSwapTokens = () => {
    console.log('Swap Tokens button clicked');
    handleClose();
  };

  // Get step title based on current step
  const getStepTitle = (step) => {
    switch(step) {
      case 1:
        return 'Approve Tokens';
      case 2:
        return 'Add Collateral';
      case 3:
        return 'Swap Tokens';
      default:
        return '';
    }
  };

  return (
    <div className="flex flex-col relative w-[393px] h-full max-h-[739px] md:w-[480px] md:h-[638px] bg-white rounded-lg shadow-lg gap-4 p-6">
      <div className="flex justify-between items-center mb-2">
        <div className="text-xl text-futarchyGray12 font-medium">
          {getStepTitle(currentStep)}
        </div>
        <button 
          onClick={handleClose}
          className="p-2 hover:bg-futarchyGray3 rounded-full transition-colors"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <ProgressBar 
        currentStep={currentStep} 
        onStepClick={handleStepClick}
        completedSteps={completedSteps}
      />

      {currentStep === 1 && (
        <>
          <div className="space-y-4">
            <TokenSwitch 
              token="GNO"
              isApproved={approvedTokens.GNO}
              onToggle={() => handleTokenApproval('GNO')}
            />
            <TokenSwitch 
              token="sDAI"
              isApproved={approvedTokens.sDAI}
              onToggle={() => handleTokenApproval('sDAI')}
            />
          </div>
        </>
      )}

      {currentStep === 2 && (
        <>
          <WalletInformation
            walletAddress={connectedWalletAddress}
            walletIcon={walletIcon}
          />
          <div className="flex flex-col gap-2 mt-4">
            <div className="text-futarchyGray12 text-base font-medium">
              Amount: 4.44 sDAI
            </div>
            <div className="text-futarchyGray11 text-sm font-normal">
              Please confirm the transaction to proceed
            </div>
          </div>
        </>
      )}

      {currentStep === 3 && (
        <div className="flex flex-col items-center justify-center flex-1">
          <div className="text-futarchyGray11 text-sm font-normal mb-4">
            Ready to swap tokens
          </div>
        </div>
      )}

      <button
        onClick={currentStep === 3 ? handleSwapTokens : handleNextStep}
        disabled={!canProceedToNextStep()}
        className={`w-full py-3 px-6 rounded-lg transition-colors font-medium mt-auto ${
          canProceedToNextStep()
            ? 'bg-futarchyGray12 hover:bg-futarchyGray11 text-white cursor-pointer'
            : 'bg-futarchyGray6 text-futarchyGray9 cursor-not-allowed'
        }`}
      >
        {currentStep === 3 ? 'Swap Tokens' : 'Next Step'}
      </button>
    </div>
  );
};

ApproveTokensModal.propTypes = {
  handleClose: PropTypes.func.isRequired,
  connectedWalletAddress: PropTypes.string,
  walletIcon: PropTypes.element,
};

export default ApproveTokensModal; 