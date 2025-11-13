import React, { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import { motion, AnimatePresence } from "framer-motion";
import { formatBalance } from "../../../../utils/formatters";
import { ethers } from "ethers";
import { usePublicClient, useWalletClient, useAccount } from "wagmi";
import {
  ERC20_ABI,
  FUTARCHY_ROUTER_ABI,
} from "../constants/contracts";

// MetaMask icon component
const MetamaskIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.171-1.52-.5-2.187l-3.955-7.97A11.81 11.81 0 0 0 12 0a11.81 11.81 0 0 0-6.105 2.093l-3.955 7.97c-.329.667-.5 1.407-.5 2.187s.171 1.52.5 2.187l3.955 7.97A11.81 11.81 0 0 0 12 24a11.81 11.81 0 0 0 6.105-2.093l3.955-7.97c.329-.667.5-1.407.5-2.187z"/>
  </svg>
);

// WalletInformation component
const WalletInformation = ({ walletAddress, walletIcon }) => {
  const truncateAddress = (address) => {
    if (!address) return "No Connected Wallet";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="flex flex-row bg-white dark:bg-futarchyDarkGray4 border border-futarchyGray6 rounded-lg p-3 md:p-4">
      <div className="flex flex-col gap-[2px]">
        <div className="text-futarchyGray11 text-xs md:text-sm font-normal">
          Connected Wallet
        </div>
        <div className="flex flex-row items-center gap-[6px] text-futarchyGray12 dark:text-futarchyGray3 text-sm md:text-base font-medium">
          {walletIcon} {truncateAddress(walletAddress)}
        </div>
      </div>
    </div>
  );
};

// Define redemption steps - will be customized based on winning outcome
// Note: Collateral1 = Company, Collateral2 = Currency in redeemProposal function
export const getRedemptionSteps = (winningTokens) => ({
  1: {
    title: "Redeeming Winning Tokens",
    substeps: [
      { id: 1, text: `Approving ${winningTokens?.companySymbol || 'company'} tokens for Router (Collateral1)`, completed: false },
      { id: 2, text: `Approving ${winningTokens?.currencySymbol || 'currency'} tokens for Router (Collateral2)`, completed: false },
      { id: 3, text: "Executing redemption", completed: false },
    ],
  },
});

const LoadingSpinner = ({ className = "" }) => (
  <svg className={`animate-spin h-4 w-4 ${className}`} viewBox="0 0 24 24">
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
      fill="none"
      opacity="0.15"
    />
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      d="M4 12a8 8 0 018-8"
    />
  </svg>
);

const CheckMark = () => (
  <svg
    className="w-4 h-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 13l4 4L19 7"
    />
  </svg>
);

const StepWithSubsteps = ({
  step,
  title,
  substeps,
  expanded,
  onToggle,
  isProcessing,
  currentSubstep,
  processingStep,
  completedSubsteps,
  isWinningOutcomeYes,
}) => {
  const isStepActive = isProcessing && currentSubstep.step === parseInt(step);
  const isStepCompleted = processingStep === 'completed';
  const isStepWaiting = currentSubstep.step < parseInt(step);

  // Determine if any substep for THIS main step is currently processing
  const isAnySubstepCurrentlyProcessing = useMemo(() => {
    if (!isStepActive) return false;
    return substeps.some(sub => parseInt(currentSubstep.substep) === parseInt(sub.id));
  }, [isStepActive, substeps, currentSubstep.substep]);

  // Add debug logging
  console.log(`Step ${step} Status:`, {
    isStepActive,
    isStepCompleted,
    isStepWaiting,
    currentSubstep
  });

  const getStepIconContainerClasses = () => {
    const baseColors = getStepColors();
    if (isStepActive && isAnySubstepCurrentlyProcessing) {
      // If spinner is active for the main step, remove background for transparency
      return baseColors.split(' ').filter(cls => !cls.startsWith('bg-')).join(' ');
    }
    return baseColors;
  };

  const getStepColors = () => {
    if (isStepCompleted) {
      return isWinningOutcomeYes
        ? "text-futarchyBlue11 bg-futarchyBlue3"
        : "text-futarchyGold11 bg-futarchyGold3";
    }
    if (isStepActive) {
      return isWinningOutcomeYes
        ? "text-futarchyBlue11 bg-futarchyBlue3"
        : "text-futarchyGold11 bg-futarchyGold3";
    }
    return "text-futarchyGray8 bg-futarchyGray4";
  };

  const getSubstepColor = (isCompleted, isActive) => {
    if (isCompleted) {
      return isWinningOutcomeYes
        ? "text-futarchyBlue11"
        : "text-futarchyGold11";
    }
    if (isActive) {
      return isWinningOutcomeYes
        ? "text-futarchyBlue11"
        : "text-futarchyGold11";
    }
    return "text-futarchyGray8";
  };

  // Add debug logging
  console.log(`StepWithSubsteps ${step} rendered:`, {
    isStepActive,
    isStepCompleted,
    isStepWaiting,
    currentSubstep,
    processingStep,
    isProcessing
  });

  return (
    <motion.div
      initial={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0, marginBottom: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-4 overflow-hidden"
    >
      <div className="flex items-center gap-3 mb-2">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center ${getStepIconContainerClasses()}`}
        >
          {isStepCompleted ? (
            <CheckMark />
          ) : isStepActive && isAnySubstepCurrentlyProcessing ? (
            <LoadingSpinner className="h-6 w-6" />
          ) : (
            <span className="text-sm font-medium">{step}</span>
          )}
        </div>
        <span
          className={`flex-1 ${isStepCompleted
              ? "text-futarchyGray12 dark:text-futarchyGray112"
              : isStepActive
                ? "text-futarchyGray12 dark:text-futarchyGray112"
                : "text-futarchyGray11 dark:text-futarchyGray112"
            }`}
        >
          {title}
        </span>
        <button
          onClick={onToggle}
          className="text-futarchyBlue11 hover:text-futarchyBlue9 text-sm"
        >
          {expanded ? "Hide details" : "Show details"}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="ml-9 space-y-2 overflow-hidden"
          >
            {substeps.map((substep, index) => {
              // Fix how we determine if a substep is active
              const explicitlyActive = isStepActive && parseInt(currentSubstep.substep) === parseInt(substep.id);
              // Force active state for debugging if needed
              const isSubstepActive = explicitlyActive ||
                (isStepActive &&
                  parseInt(currentSubstep.substep) === parseInt(substep.id));

              const isSubstepCompleted =
                isStepCompleted ||
                completedSubsteps[step]?.substeps[substep.id] ||
                currentSubstep.step > parseInt(step);
              const isSubstepWaiting =
                isStepWaiting ||
                (isStepActive && currentSubstep.substep < substep.id);

              // Add debug logging for each substep
              console.log(`Step ${step} Substep ${substep.id} Status:`, {
                isSubstepActive,
                isSubstepCompleted,
                currentSubstep,
                substepId: substep.id,
                active: isStepActive && currentSubstep.substep === substep.id
              });

              return (
                <div key={substep.id} className="flex items-center gap-2">
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center ${getSubstepColor(isSubstepCompleted, isSubstepActive)
                      }`}
                  >
                    {isSubstepCompleted ? (
                      <CheckMark />
                    ) : isSubstepActive ? (
                      <>
                        {console.log(`Rendering SPINNER for step ${step} substep ${substep.id}`, {
                          isSubstepActive,
                          explicitlyActive,
                          isStepActive,
                          currentSubstep
                        })}
                        <LoadingSpinner />
                      </>
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-current" />
                    )}
                  </div>
                  <span
                    className={`text-sm ${isSubstepCompleted
                        ? "text-futarchyGray12 dark:text-futarchyGray112"
                        : isSubstepActive
                          ? "text-futarchyGray12 dark:text-futarchyGray112"
                          : "text-futarchyGray11 dark:text-futarchyGray112"
                      }`}
                  >
                    {substep.text}
                  </span>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Helper function to convert wagmi wallet client to ethers signer (same as CollateralModal)
const getEthersSigner = (walletClient, publicClient) => {
  console.log('[DEBUG] getEthersSigner called with:', {
    walletClient: !!walletClient,
    walletClientAccount: walletClient?.account?.address,
    publicClient: !!publicClient,
    connectorType: walletClient?.connector?.name || 'unknown'
  });
  
  if (!walletClient) {
    console.warn('[DEBUG] No walletClient provided to getEthersSigner');
    return null;
  }
  
  const isMetaMaskConnector = walletClient?.connector?.name?.toLowerCase().includes('metamask') || 
                              walletClient?.connector?.name?.toLowerCase().includes('injected');
  
  if (isMetaMaskConnector && typeof window !== 'undefined' && window.ethereum) {
    try {
      console.log('[DEBUG] User connected via MetaMask, attempting Web3Provider signer...');
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const connectedAddr = walletClient?.account?.address;
      const providerSigner = connectedAddr ? provider.getSigner(connectedAddr) : provider.getSigner();
      
      providerSigner.getAddress = async function () { 
        console.log('[DEBUG] getAddress called on Web3Provider signer, returning:', connectedAddr);
        return connectedAddr;
      };
      
      console.log('[DEBUG] Web3Provider signer setup complete for MetaMask connection');
      return providerSigner;
    } catch (error) {
      console.warn('[DEBUG] Failed to create Web3Provider signer, falling back to custom implementation:', error);
    }
  } else {
    console.log('[DEBUG] User connected via non-MetaMask wallet, using viem-based signer for:', walletClient?.connector?.name);
  }
  
  const customSigner = {
    _isSigner: true,
    provider: null,
    
    async getAddress() {
      const address = walletClient.account.address;
      console.log('[DEBUG] Custom signer getAddress called, returning:', address);
      return address;
    },
    async getChainId() {
      const chainId = walletClient.chain.id;
      console.log('[DEBUG] Custom signer getChainId called, returning:', chainId);
      return chainId;
    },
    async sendTransaction(transaction) {
      const hash = await walletClient.sendTransaction(transaction);
      console.log('Transaction sent via viem walletClient:', hash);
      
      return { 
        hash, 
        wait: async (confirmations = 1) => {
          try {
            console.log(`Waiting for transaction ${hash} confirmation...`);
            const receipt = await publicClient.waitForTransactionReceipt({ 
              hash,
              timeout: 60000,
              confirmations
            });
            console.log('Transaction confirmed:', receipt);
            return {
              status: receipt.status === 'success' ? 1 : 0,
              transactionHash: receipt.transactionHash,
              blockNumber: receipt.blockNumber,
              gasUsed: receipt.gasUsed,
              confirmations: confirmations,
              logs: receipt.logs
            };
          } catch (error) {
            console.error('Transaction confirmation error:', error);
            throw error;
          }
        }
      };
    },
    async signMessage(message) {
      return await walletClient.signMessage({ 
        account: walletClient.account,
        message 
      });
    }
  };

  return customSigner;
};

const RedemptionModal = ({
  title,
  handleClose,
  connectedWalletAddress,
  walletIcon = <MetamaskIcon />,
  config,
  winningTokens,
  processingStep,
  isProcessing = false,
  error,
}) => {
  const { address: account, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [expandedSteps, setExpandedSteps] = useState({ 1: true });
  // Update state management to match ConfirmSwapModal pattern
  const [currentSubstep, setCurrentSubstep] = useState({ step: 1, substep: 1 });
  const [completedSubsteps, setCompletedSubsteps] = useState({
    1: { completed: false, substeps: {} }
  });
  const [localProcessingStep, setLocalProcessingStep] = useState(undefined);
  const [localError, setLocalError] = useState(null);
  const [localIsProcessing, setLocalIsProcessing] = useState(false);

  // Determine if winning outcome is YES
  const isWinningOutcomeYes = config?.marketInfo?.finalOutcome?.toLowerCase() === 'yes';

  const signer = useMemo(() => {
    if (!walletClient) {
      console.log('No wallet client available for signer creation');
      return null;
    }
    
    const ethersSigner = getEthersSigner(walletClient, publicClient);
    
    console.log('RedemptionModal signer created:', {
      hasSigner: !!ethersSigner,
      signerType: ethersSigner?._isSigner ? 'custom' : 'web3provider'
    });
    
    return ethersSigner;
  }, [walletClient, publicClient]);

  const handleTokenApproval = async (tokenAddress, spenderAddress, amount, tokenName = '') => {
    if (!window.ethereum) {
      throw new Error("Please install MetaMask!");
    }

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const userAddress = await signer.getAddress();

    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

    const currentAllowance = await tokenContract.allowance(userAddress, spenderAddress);
    console.log(`Current ${tokenName} allowance for ${spenderAddress}:`, ethers.utils.formatEther(currentAllowance));

    if (currentAllowance.lt(amount)) {
      console.log(`Approving ${tokenName} for ${spenderAddress}...`);
      try {
        const approveTx = await tokenContract.approve(spenderAddress, ethers.constants.MaxUint256);
        console.log('Approval transaction sent:', approveTx.hash);
        await approveTx.wait();
        console.log(`${tokenName} approved successfully`);

        const newAllowance = await tokenContract.allowance(userAddress, spenderAddress);
        console.log(`New ${tokenName} allowance:`, ethers.utils.formatEther(newAllowance));

        if (newAllowance.lt(amount)) {
          throw new Error('Allowance is still insufficient after approval');
        }
      } catch (error) {
        console.error(`Failed to approve ${tokenName}:`, error);
        throw error;
      }
    }
  };

  // Update markSubstepCompleted to match ConfirmSwapModal pattern
  const markSubstepCompleted = (step, substepId) => {
    setCompletedSubsteps(prev => {
      // Make sure the step and substeps objects exist
      const ensuredPrev = {
        ...prev,
        [step]: prev[step] || { completed: false, substeps: {} }
      };

      // Now we can safely update
      const newState = {
        ...ensuredPrev,
        [step]: {
          ...ensuredPrev[step],
          substeps: {
            ...ensuredPrev[step].substeps,
            [substepId]: true
          }
        }
      };
      return newState;
    });
  };

  const handleRedemption = async () => {
    if (!isConnected || !account || !signer) {
      setLocalError("Please connect your wallet first");
      return;
    }

    try {
      console.log('[RedemptionModal] Starting redemption with:', {
        connectedAccount: account,
        walletType: walletClient?.connector?.name,
        isConnected,
        winningTokens
      });

      // Reset state and start processing
      setCompletedSubsteps({
        1: { completed: false, substeps: {} }
      });
      setLocalIsProcessing(true);
      setLocalProcessingStep("processing");
      setCurrentSubstep({ step: 1, substep: 1 });
      setLocalError(null);

      const routerAddress = config?.FUTARCHY_ROUTER_ADDRESS;
      const marketAddress = config?.MARKET_ADDRESS;

      if (!routerAddress || !marketAddress) {
        throw new Error("Missing router or market address from config");
      }

      // Convert amounts to wei
      const currencyAmountInWei = ethers.utils.parseUnits(winningTokens.currencyAmount.toString(), 18);
      const companyAmountInWei = ethers.utils.parseUnits(winningTokens.companyAmount.toString(), 18);

      // Step 1: Approve company tokens first (Collateral1)
      console.log('Approving company tokens (Collateral1)...');
      setCurrentSubstep({ step: 1, substep: 1 });
      
      await handleTokenApproval(
        winningTokens.companyTokenAddress,
        routerAddress,
        companyAmountInWei,
        `${winningTokens.companySymbol} (Collateral1)`
      );

      markSubstepCompleted(1, 1);
      setCurrentSubstep({ step: 1, substep: 2 });

      // Step 2: Approve currency tokens second (Collateral2)
      console.log('Approving currency tokens (Collateral2)...');
      await handleTokenApproval(
        winningTokens.currencyTokenAddress,
        routerAddress,
        currencyAmountInWei,
        `${winningTokens.currencySymbol} (Collateral2)`
      );

      markSubstepCompleted(1, 2);
      setCurrentSubstep({ step: 1, substep: 3 });

      // Execute redemption
      const routerContract = new ethers.Contract(
        routerAddress,
        FUTARCHY_ROUTER_ABI,
        signer
      );

      console.log('Executing redeemProposal...', {
        proposal: marketAddress,
        collateral1_company: companyAmountInWei.toString(),
        collateral2_currency: currencyAmountInWei.toString()
      });

      const redeemTx = await routerContract.redeemProposal(
        marketAddress,
        companyAmountInWei,     // collateral1 = company amount
        currencyAmountInWei,    // collateral2 = currency amount
        { gasLimit: 700000 }
      );

      console.log('Redemption transaction sent:', redeemTx.hash);
      await redeemTx.wait();
      console.log('Redemption completed');

      markSubstepCompleted(1, 3);
      
      // Set completed
      setCompletedSubsteps(prev => ({
        ...prev,
        1: { ...prev[1], completed: true }
      }));
      
      setLocalProcessingStep("completed");
      setLocalIsProcessing(false);

    } catch (error) {
      console.error('Redemption failed:', error);
      let errorMessage = error.message || "Unknown error occurred.";
      if (error.code === 4001 || error.code === "ACTION_REJECTED") {
        errorMessage = "Transaction rejected by the user.";
      } else if (error.message?.includes("user rejected")) {
        errorMessage = "Transaction rejected by the user.";
      }
      setLocalError(errorMessage);
      setLocalProcessingStep(undefined);
      setLocalIsProcessing(false);
      setCurrentSubstep({ step: 1, substep: 1 });
      setCompletedSubsteps({
        1: { completed: false, substeps: {} }
      });
    }
  };

  const toggleStepExpansion = (step) => {
    setExpandedSteps(prev => ({
      ...prev,
      [step]: !prev[step]
    }));
  };

  const getUpdatedSteps = () => {
    const steps = getRedemptionSteps(winningTokens);
    return {
      ...steps,
      1: {
        ...steps[1],
        substeps: steps[1].substeps.map((substep) => ({
          ...substep,
          completed: completedSubsteps[1]?.substeps[substep.id] || localProcessingStep === "completed",
        })),
      },
    };
  };

  // Add useEffect for auto-expanding current step
  useEffect(() => {
    if (localIsProcessing && currentSubstep.step) {
      // Automatically expand the current step and collapse others
      setExpandedSteps({ 1: true });
    }
  }, [localIsProcessing, currentSubstep.step]);

  // Create portal container if it doesn't exist
  useEffect(() => {
    let portalRoot = document.getElementById('modal-root');
    if (!portalRoot) {
      portalRoot = document.createElement('div');
      portalRoot.id = 'modal-root';
      document.body.appendChild(portalRoot);
    }
  }, []);

  let buttonContent;
  let buttonAction = () => {};
  let buttonIsEnabled = false;
  let buttonClasses = "w-full py-2 md:py-3 px-4 rounded-lg font-semibold transition-colors";

  if (localProcessingStep === "completed") {
    buttonContent = "Redemption Complete - Close";
    buttonAction = handleClose;
    buttonIsEnabled = true;
    const completedColors = isWinningOutcomeYes
      ? "bg-futarchyBlue9 hover:bg-futarchyBlue11 text-white"
      : "bg-futarchyGold9 hover:bg-futarchyGold11 text-black";
    buttonClasses += ` flex ${completedColors} items-center justify-center gap-2`;
  } else if (localIsProcessing) {
    buttonContent = "Processing Redemption...";
    buttonIsEnabled = false;
    buttonClasses += " bg-futarchyGray6 text-futarchyGray112/40 cursor-not-allowed";
  } else {
    buttonContent = "Redeem Winning Tokens";
    buttonAction = handleRedemption;
    buttonIsEnabled = true;
    const actionColors = isWinningOutcomeYes
      ? "bg-futarchyBlue9 hover:bg-futarchyBlue11 text-white"
      : "bg-futarchyGold9 hover:bg-futarchyGold11 text-black";
    buttonClasses += ` ${actionColors}`;
  }

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="flex flex-col relative w-11/12 max-w-[393px] max-h-[85vh] md:w-[480px] md:h-auto md:max-h-[638px] bg-white dark:bg-futarchyDarkGray3 dark:border dark:border-futarchyGray112/20 rounded-xl shadow-lg gap-4 p-4 md:p-6 overflow-y-auto">
        <div className="flex justify-between items-center">
          <div className="text-lg md:text-xl text-futarchyGray12 dark:text-futarchyGray3 font-medium">
            {title}
          </div>
          <button
            onClick={handleClose}
            disabled={localIsProcessing && localProcessingStep !== "completed"}
            className="text-futarchyGray11 hover:text-futarchyGray12 dark:text-futarchyGray112 dark:hover:text-futarchyGray3"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <WalletInformation
          walletAddress={connectedWalletAddress}
          walletIcon={walletIcon}
        />

        <AnimatePresence mode="wait">
          {!localProcessingStep ? (
            <motion.div
              initial={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Redemption Summary */}
              <div className="mb-6">
                <div className="bg-futarchyGray3 dark:bg-futarchyDarkGray4 dark:border dark:border-futarchyGray112/20 rounded-lg p-3 md:p-4">
                  <h4 className="font-medium mb-2 text-black dark:text-futarchyGray112 text-sm">Redemption Summary</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-futarchyGray11 text-sm">Winning Outcome</span>
                      <span className="text-futarchyGreen11 font-medium text-sm">
                        {config?.marketInfo?.finalOutcome || 'Unknown'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-futarchyGray11 text-sm">Currency Tokens</span>
                      <span className="text-futarchyGray12 dark:text-futarchyGray3 font-medium text-sm">
                        {formatBalance(winningTokens?.currencyAmount || '0', winningTokens?.currencySymbol || 'CURRENCY')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-futarchyGray11 text-sm">Company Tokens</span>
                      <span className="text-futarchyGray12 dark:text-futarchyGray3 font-medium text-sm">
                        {formatBalance(winningTokens?.companyAmount || '0', winningTokens?.companySymbol || 'COMPANY')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Info Container */}
              <div className="bg-futarchyGray3 dark:bg-futarchyDarkGray4 dark:border dark:border-futarchyGray112/20 rounded-lg p-3 md:p-4">
                <h4 className="font-medium mb-1 text-black dark:text-futarchyGray112 text-xs">Redemption Information</h4>
                <p className="text-xs text-black dark:text-futarchyGray112">
                  You are redeeming your winning outcome tokens. This will convert your position tokens back to the underlying collateral tokens based on the market resolution.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              className="mb-6 relative"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent dark:from-futarchyDarkGray3 dark:to-transparent pointer-events-none z-10" />
              <div className="max-h-[240px] overflow-y-auto pr-2 -mr-2">
                <AnimatePresence>
                  {Object.entries(getUpdatedSteps() || {}).map(([step, data]) => (
                    <StepWithSubsteps
                      key={step}
                      step={parseInt(step)}
                      title={data.title}
                      substeps={data.substeps}
                      expanded={expandedSteps[step]}
                      onToggle={() => toggleStepExpansion(step)}
                      isProcessing={localIsProcessing}
                      currentSubstep={currentSubstep}
                      processingStep={localProcessingStep}
                      completedSubsteps={completedSubsteps}
                      isWinningOutcomeYes={isWinningOutcomeYes}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Button */}
        <div className="">
          <button
            onClick={buttonAction}
            disabled={!buttonIsEnabled}
            className={buttonClasses}
          >
            {buttonContent}
          </button>
        </div>

        {(error || localError) && (
          <div className="mb-2 p-1 bg-red-50 border border-red-200 rounded-lg text-red-400 text-sm">
            {error || localError}
          </div>
        )}
      </div>
    </div>
  );

  // Return portal or null if no portal root
  const portalRoot = document.getElementById('modal-root');
  if (!portalRoot) return null;

  return ReactDOM.createPortal(modalContent, portalRoot);
};

RedemptionModal.propTypes = {
  title: PropTypes.string.isRequired,
  handleClose: PropTypes.func.isRequired,
  connectedWalletAddress: PropTypes.string,
  walletIcon: PropTypes.element,
  config: PropTypes.object.isRequired,
  winningTokens: PropTypes.object.isRequired,
  processingStep: PropTypes.string,
  isProcessing: PropTypes.bool,
  error: PropTypes.string,
};

export default RedemptionModal; 