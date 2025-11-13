import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import { ethers } from 'ethers';
import { motion, AnimatePresence } from 'framer-motion';
import { useMetaMask } from '../../../hooks/useMetaMask';
import { useSwapNativeToCurrency } from '../../../hooks/useSwapNativeToCurrency'; // Using the updated hook
import { useBalanceManager } from '../../../hooks/useBalanceManager'; // Import centralized balance manager
import { formatBalance } from '../../../utils/formatters';
import { MetamaskIcon } from './collateralModal/icons';
import { executeAlgebraExactSingle, checkAndApproveTokenForV3Swap, SWAPR_V3_ROUTER } from '../../../utils/sushiswapV3Helper';
import { useContractConfig } from '../../../hooks/useContractConfig';
import ProviderStatus from '../../common/ProviderStatus';

// WXDAI address (needed for balance check)
const WXDAI_ADDRESS = '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d';

// Algebra pool address for WXDAI → SDAI
const ALGEBRA_WXDAI_SDAI_POOL = '0xfd24c5c19df9f124f385b3c0f38f8c6c72f5a137';

// WXDAI contract ABI with deposit function
const WXDAI_ABI = [
  "function deposit() external payable",
  "function withdraw(uint256 amount) external",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)"
];

// --- Reusable UI Components - Match ConfirmSwapModal exactly ---
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
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
        />
  </svg>
);

// Collapsible section component
const CollapsibleSection = ({ title, isExpanded, onToggle, children, showIndicator = false }) => (
    <div className="bg-futarchyGray2 dark:bg-futarchyDarkGray3 rounded-lg mb-4">
        <button
            onClick={onToggle}
            className="w-full flex items-center justify-between p-3 text-left hover:bg-futarchyGray3 dark:hover:bg-futarchyDarkGray4 rounded-lg transition-colors"
        >
            <h3 className="font-medium text-futarchyGray12 dark:text-futarchyGray112 text-sm flex items-center gap-2">
                {title}
                {showIndicator && (
                    <div className="w-2 h-2 bg-futarchyBlue9 rounded-full"></div>
                )}
            </h3>
            <svg 
                className={`w-4 h-4 text-futarchyGray11 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </button>
        <AnimatePresence>
            {isExpanded && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                >
                    <div className="px-3 pb-3">
                        {children}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
);

// Step component for conversion process
const ConversionStep = ({ stepNumber, title, isActive, isCompleted, isWaiting }) => {
    const getStepColors = () => {
        if (isCompleted) return 'text-futarchyGreen11 bg-futarchyGreen3';
        if (isActive) return 'text-futarchyBlue11 bg-futarchyBlue3';
        return 'text-futarchyGray8 bg-futarchyGray4';
    };

    return (
        <div className="flex items-center gap-2 mb-1.5 mx-2">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${getStepColors()}`}>
                {isCompleted ? (
                    <CheckMark />
                ) : isActive ? (
                    <LoadingSpinner className="h-5 w-5" />
                ) : (
                    <span className="text-xs font-medium">{stepNumber}</span>
                )}
            </div>
            <span className={`flex-1 text-xs ${
                isCompleted || isActive 
                    ? 'text-futarchyGray12 dark:text-futarchyGray112' 
                    : 'text-futarchyGray11 dark:text-futarchyGray112'
            }`}>
                {title}
            </span>
        </div>
    );
};

// Updated WalletInfo to show both WXDAI and native xDAI balances
const WalletInfo = ({ address, wxdaiBalance, nativeBalance, wxdaiSymbol }) => {
    const truncateAddress = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : 'N/A';
    return (
        <div className="bg-futarchyGray3 dark:bg-futarchyDarkGray3 p-3 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
                <MetamaskIcon />
                <span className="text-sm font-medium text-futarchyGray12 dark:text-futarchyGray112">{truncateAddress(address)}</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <span className="text-futarchyGray11 dark:text-futarchyGray112">WXDAI:</span>
                    <div className="font-medium text-futarchyGray12 dark:text-futarchyGray112">
                        {formatBalance(wxdaiBalance, wxdaiSymbol)}
                    </div>
                </div>
                <div>
                    <span className="text-futarchyGray11 dark:text-futarchyGray112">Native xDAI:</span>
                    <div className="font-medium text-futarchyGray12 dark:text-futarchyGray112">
                        {formatBalance(nativeBalance, 'xDAI')}
                    </div>
                </div>
            </div>
        </div>
    );
};

const SwapNativeToCurrencyModal = ({ 
    isOpen, 
    onClose, 
    initialAmount = null,
    // Add new props for chaining
    onComplete = () => {}, // Default to empty function
    nextStepOutcome = null,
    nextStepAction = null
}) => {
    const { account, provider, chainId, signer, isMetaMaskDetected } = useMetaMask(); // Need signer for balance check
    
    // Use contract config hook to get dynamic configuration
    const { config } = useContractConfig();
    
    // Use centralized balance manager
    const { balances, isLoading: isLoadingBalances, refetch: refetchBalances } = useBalanceManager(config, account, !!account);
    
    const {
        isLoading,
        error,
        quoteData,
        orderId,
        orderStatus,
        fetchQuote,
        executeSwap, // Now includes approval
        resetSwapState,
        currencyTokenSymbol,
        sellTokenSymbol, // Now explicitly WXDAI
        currencyTokenDecimals,
        sellTokenDecimals, // WXDAI decimals
        executedBuyAmount
    } = useSwapNativeToCurrency();
    
    // Add state for Algebra swap tracking
    const [algebraTxHash, setAlgebraTxHash] = useState(null);
    const [algebraStatus, setAlgebraStatus] = useState(null); // Local status for Algebra swaps
    const [isTransitioning, setIsTransitioning] = useState(false); // Prevent double-clicks during transitions
    
    // Get currency token address from contract config
    const currencyTokenAddress = config?.BASE_TOKENS_CONFIG?.currency?.address;

    const [amount, setAmount] = useState('');
    const [fetchedQuoteForAmount, setFetchedQuoteForAmount] = useState(null);
    const [wxdaiBalance, setWxdaiBalance] = useState('0'); // WXDAI balance (fetched separately)
    
    // Get balances from balance manager
    const nativeBalance = balances.native || '0'; // Native xDAI balance from balance manager
    const sellTokenBalance = wxdaiBalance; // Use WXDAI balance as sell token balance
    const [displayError, setDisplayError] = useState(null);
    const [isConvertingToWXDAI, setIsConvertingToWXDAI] = useState(false);
    const [conversionNeeded, setConversionNeeded] = useState(false);
    const [conversionStep, setConversionStep] = useState(null); // 'converting' | 'completed' | null
    
    // Swap method selection (similar to ConfirmSwapModal)
    const [selectedSwapMethod, setSelectedSwapMethod] = useState(() => {
        if (typeof window !== 'undefined') {
            const lastUsedMethod = localStorage.getItem('lastNativeSwapMethod');
            if (['cowswap', 'algebra'].includes(lastUsedMethod)) {
                return lastUsedMethod;
            }
        }
        return 'algebra'; // Default to Algebra (Swapr) for more direct swaps
    });
    
    // Substep tracking for conversion process (similar to ConfirmSwapModal)
    const [currentSubstep, setCurrentSubstep] = useState({ step: 1, substep: 1 });
    const [processingStep, setProcessingStep] = useState(null);
    const [completedSubsteps, setCompletedSubsteps] = useState({
        1: { completed: false, substeps: {} }
    });
    
    // Collapsible section states
    const [expandedSections, setExpandedSections] = useState({
        balance: false,
        quote: false,
        steps: false
    });

    // Effect to save the selected swap method to localStorage
    useEffect(() => {
        if (typeof window !== 'undefined' && selectedSwapMethod) {
            localStorage.setItem('lastNativeSwapMethod', selectedSwapMethod);
        }
    }, [selectedSwapMethod]);

    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    // Substep helper functions (similar to ConfirmSwapModal)
    const markSubstepCompleted = (step, substepId) => {
        setCompletedSubsteps(prev => {
            const ensuredPrev = {
                ...prev,
                [step]: prev[step] || { completed: false, substeps: {} }
            };
            
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

    // Define amountInWei and hasSufficientBalance first (before useEffect that depends on them)
    const amountInWei = useMemo(() => {
        if (!amount || isNaN(amount) || parseFloat(amount) <= 0) return ethers.BigNumber.from(0);
        try {
            return ethers.utils.parseUnits(amount, sellTokenDecimals);
        } catch {
            return ethers.BigNumber.from(0);
        }
    }, [amount, sellTokenDecimals]);

    const hasSufficientBalance = useMemo(() => {
        if (amountInWei.isZero()) return true;
        try {
            const wxdaiBalanceWei = ethers.utils.parseUnits(sellTokenBalance, sellTokenDecimals);
            const nativeBalanceWei = ethers.utils.parseUnits(nativeBalance, 18);
            
            // Use the quote's sellAmount if available (includes fees), otherwise use user input
            const requiredAmountWei = fetchedQuoteForAmount?.sellAmount 
                ? ethers.BigNumber.from(fetchedQuoteForAmount.sellAmount)
                : amountInWei;
            
            console.log('=== BALANCE CHECK DEBUG ===');
            console.log('User input amount:', ethers.utils.formatEther(amountInWei));
            console.log('Required amount (with fees):', ethers.utils.formatEther(requiredAmountWei));
            console.log('WXDAI balance:', sellTokenBalance);
            console.log('Native balance:', nativeBalance);
            
            // Check if we have enough WXDAI directly
            if (wxdaiBalanceWei.gte(requiredAmountWei)) {
                console.log('✅ Sufficient WXDAI balance');
                setConversionNeeded(false);
                return true;
            }
            
            // Check if we can cover the shortfall with native xDAI conversion
            const shortfall = requiredAmountWei.sub(wxdaiBalanceWei);
            const gasBuffer = ethers.utils.parseEther('0.001'); // Gas buffer for conversion
            
            console.log('Shortfall:', ethers.utils.formatEther(shortfall));
            console.log('Gas buffer:', ethers.utils.formatEther(gasBuffer));
            console.log('Total needed from native:', ethers.utils.formatEther(shortfall.add(gasBuffer)));
            
            if (nativeBalanceWei.gte(shortfall.add(gasBuffer))) {
                console.log('✅ Can cover with native xDAI conversion');
                setConversionNeeded(true);
                return true;
            }
            
            console.log('❌ Insufficient total balance');
            setConversionNeeded(false);
            return false;
        } catch (error) {
            console.error('Error in balance check:', error);
            setConversionNeeded(false);
            return false;
        }
    }, [amountInWei, sellTokenBalance, nativeBalance, sellTokenDecimals, fetchedQuoteForAmount]);

    // Auto-expand the most relevant section
    useEffect(() => {
        if (conversionStep === 'converting' || (orderId && orderStatus) || (algebraTxHash && algebraStatus)) {
            // If conversion is happening OR order is submitted/tracking (CoW or Algebra), expand steps only
            setExpandedSections(prev => ({ ...prev, steps: true, balance: false, quote: false }));
        } else if (quoteData && !orderId && !algebraTxHash && !conversionStep) {
            // If quote is available but not submitted and no conversion happening, expand quote details
            setExpandedSections(prev => ({ ...prev, quote: true, balance: false, steps: false }));
        } else if (hasSufficientBalance && !amountInWei.isZero() && !conversionNeeded) {
            // If user has sufficient balance and no conversion needed, show steps (conversion completed)
            setExpandedSections(prev => ({ ...prev, steps: true, balance: false, quote: false }));
        } else if (conversionNeeded && !quoteData && selectedSwapMethod === 'cowswap') {
            // If conversion is needed but no quote yet (CoW only), expand balance summary
            setExpandedSections(prev => ({ ...prev, balance: true, steps: false, quote: false }));
        } else if (selectedSwapMethod === 'algebra' && !algebraTxHash && !conversionStep) {
            // For Algebra without active transaction, show balance summary
            setExpandedSections(prev => ({ ...prev, balance: true, steps: false, quote: false }));
        }
    }, [orderId, orderStatus, algebraTxHash, algebraStatus, conversionNeeded, conversionStep, quoteData, selectedSwapMethod, hasSufficientBalance, amountInWei]);

    // --- Fetch WXDAI Balance (Native xDAI comes from balance manager) --- 
    const updateWxdaiBalance = useCallback(async () => {
        if (account && signer) {
            try {
                const wxdaiContract = new ethers.Contract(WXDAI_ADDRESS, WXDAI_ABI, signer);
                const wxdaiBalanceWei = await wxdaiContract.balanceOf(account);
                const formattedBalance = ethers.utils.formatUnits(wxdaiBalanceWei, sellTokenDecimals);
                setWxdaiBalance(formattedBalance);
                
                console.log('[SwapNativeToCurrency] Updated WXDAI balance:', formattedBalance);
            } catch (err) {
                console.error("Failed to fetch WXDAI balance:", err);
                setWxdaiBalance('0');
            }
        } else {
            setWxdaiBalance('0');
        }
    }, [account, signer, sellTokenDecimals]);

    useEffect(() => {
        if (isOpen) {
            updateWxdaiBalance(); // Fetch WXDAI balance
            resetModalState(); // Keep the call
            setDisplayError(null); // Keep the call
            // Pre-fill amount if initialAmount is provided and valid
            if (initialAmount && !isNaN(parseFloat(initialAmount)) && parseFloat(initialAmount) > 0) {
                console.log("NativeSwapModal: Pre-filling amount from prop:", initialAmount);
                setAmount(initialAmount);
            }
        }
        // Correct dependency array: remove resetModalState
    }, [isOpen, updateWxdaiBalance, initialAmount]);

    useEffect(() => {
        if (amount) setDisplayError(null);
    }, [amount]);

    // ** Restore the definition of resetModalState using useCallback **
    const resetModalState = useCallback(() => {
        setAmount('');
        setFetchedQuoteForAmount(null);
        resetSwapState(); // Call the function from the hook
        setDisplayError(null);
        setIsConvertingToWXDAI(false);
        setConversionNeeded(false);
        setConversionStep(null);
        setWxdaiBalance('0'); // Reset WXDAI balance
    }, [resetSwapState]); // Dependency array includes resetSwapState from the hook

    // Utility function to convert native xDAI to WXDAI if needed
    const convertNativeToWXDAI = useCallback(async (requiredAmountWei) => {
        if (!account || !signer || !provider) {
            throw new Error('Wallet not connected');
        }

        setIsConvertingToWXDAI(true);
        setConversionStep('converting');
        setProcessingStep(1);
        setCurrentSubstep({ step: 1, substep: 1 });
        setDisplayError(null);

        try {
            const wxdaiContract = new ethers.Contract(WXDAI_ADDRESS, WXDAI_ABI, signer);
            
            // Substep 1: Check WXDAI balance and calculate conversion needs
            console.log('=== CONVERSION SUBSTEP 1: CHECKING BALANCE ===');
            const wxdaiBalance = await wxdaiContract.balanceOf(account);
            console.log('Current WXDAI balance (Wei):', wxdaiBalance.toString());
            console.log('Current WXDAI balance (Ether):', ethers.utils.formatEther(wxdaiBalance));
            console.log('Required WXDAI amount (Wei):', requiredAmountWei.toString());
            console.log('Required WXDAI amount (Ether):', ethers.utils.formatEther(requiredAmountWei));

            // If we already have enough WXDAI, no conversion needed
            if (wxdaiBalance.gte(requiredAmountWei)) {
                console.log('✅ Sufficient WXDAI balance, no conversion needed');
                markSubstepCompleted(1, 1);
                markSubstepCompleted(1, 2);
                setCompletedSubsteps(prev => ({ ...prev, 1: { ...prev[1], completed: true } }));
                setProcessingStep('completed');
                setIsConvertingToWXDAI(false);
                setConversionNeeded(false);
                return true;
            }

            // Calculate how much more WXDAI we need
            const additionalWXDAINeeded = requiredAmountWei.sub(wxdaiBalance);
            console.log('Additional WXDAI needed (Wei):', additionalWXDAINeeded.toString());
            console.log('Additional WXDAI needed (Ether):', ethers.utils.formatEther(additionalWXDAINeeded));
            
            // Check native xDAI balance
            const nativeBalanceWei = await provider.getBalance(account);
            console.log('Native xDAI balance (Wei):', nativeBalanceWei.toString());
            console.log('Native xDAI balance (Ether):', ethers.utils.formatEther(nativeBalanceWei));

            // Check if we have enough native xDAI to convert (add small buffer for gas)
            const gasBuffer = ethers.utils.parseEther('0.001'); // 0.001 xDAI buffer for gas
            const totalNeeded = additionalWXDAINeeded.add(gasBuffer);
            console.log('Total needed (additional + gas buffer):', ethers.utils.formatEther(totalNeeded));
            
            if (nativeBalanceWei.lt(totalNeeded)) {
                const shortfall = totalNeeded.sub(nativeBalanceWei);
                throw new Error(`Insufficient native xDAI for conversion + gas fees. Need ${ethers.utils.formatEther(additionalWXDAINeeded)} WXDAI + 0.001 xDAI gas = ${ethers.utils.formatEther(totalNeeded)} total, but only have ${ethers.utils.formatEther(nativeBalanceWei)} xDAI. Shortfall: ${ethers.utils.formatEther(shortfall)} xDAI`);
            }

            // Mark first substep completed  
            markSubstepCompleted(1, 1);
            setCurrentSubstep({ step: 1, substep: 2 });

            // Substep 2: Execute conversion
            console.log('=== CONVERSION SUBSTEP 2: CONVERTING ===');
            console.log('🔄 Converting native xDAI to WXDAI:', ethers.utils.formatEther(additionalWXDAINeeded));

            // Convert native xDAI to WXDAI using deposit function
            const depositTx = await wxdaiContract.deposit({
                value: additionalWXDAINeeded,
                gasLimit: 100000 // Simple deposit shouldn't need much gas
            });

            console.log('📤 WXDAI deposit transaction sent:', depositTx.hash);
            console.log('⏳ Waiting for confirmation...');
            await depositTx.wait();
            console.log('✅ WXDAI deposit confirmed');

            // Mark second substep completed
            markSubstepCompleted(1, 2);
            setCompletedSubsteps(prev => ({ ...prev, 1: { ...prev[1], completed: true } }));

            setConversionStep('completed');
            setProcessingStep('completed');

            // Check balance after conversion
            const newWxdaiBalance = await wxdaiContract.balanceOf(account);
            console.log('New WXDAI balance after conversion:', ethers.utils.formatEther(newWxdaiBalance));
            console.log('Conversion successful?', newWxdaiBalance.gte(requiredAmountWei));

            // Update balances after conversion
            await updateWxdaiBalance(); // Update WXDAI balance
            refetchBalances(); // Update native xDAI balance from balance manager

            setIsConvertingToWXDAI(false);
            setConversionNeeded(false);
            return true;
        } catch (error) {
            console.error('Error converting native xDAI to WXDAI:', error);
            setIsConvertingToWXDAI(false);
            setConversionStep(null);
            setProcessingStep(null);
            setCurrentSubstep({ step: 1, substep: 1 });
            setCompletedSubsteps({ 1: { completed: false, substeps: {} } });
            throw error;
        }
    }, [account, signer, provider, updateWxdaiBalance, refetchBalances]);

    // Get the effective status for the current swap method
    const effectiveStatus = selectedSwapMethod === 'algebra' ? algebraStatus : orderStatus;
    
    // Determine button states based on status and swap method
    const canFetchQuote = selectedSwapMethod === 'cowswap' && !amountInWei.isZero() && hasSufficientBalance && !isLoading && !isTransitioning && orderStatus !== 'tracking' && orderStatus !== 'fulfilled' && orderStatus !== 'awaiting_approval';
    const canExecuteSwap = selectedSwapMethod === 'cowswap' 
        ? (fetchedQuoteForAmount && !isLoading && !isTransitioning && hasSufficientBalance && (orderStatus === 'quote_received' || orderStatus === 'approval_error'))
        : (selectedSwapMethod === 'algebra' && !amountInWei.isZero() && hasSufficientBalance && !algebraStatus && !isTransitioning);
    const needsApproval = effectiveStatus === 'awaiting_approval';

    const handleFetchQuote = async () => {
        if (!canFetchQuote) return;
        setDisplayError(null);
        setFetchedQuoteForAmount(null);
        const quote = await fetchQuote(amountInWei);
        if (quote) {
            setFetchedQuoteForAmount(quote);
        } else {
            setDisplayError(error || "Failed to fetch quote.");
        }
    };

    const handleExecuteSwap = async () => {
        // Use canExecuteSwap which checks for appropriate conditions based on swap method
        if (!canExecuteSwap || isTransitioning) return; 
        setDisplayError(null);
        setIsTransitioning(true);
        
        try {
            console.log(`[Native Swap] Starting execution with method: ${selectedSwapMethod}`);
            
            // Determine required amount based on swap method
            let requiredAmountWei;
            if (selectedSwapMethod === 'cowswap') {
                // For CoW Swap, use the quote's sellAmount (includes fees)
                requiredAmountWei = ethers.BigNumber.from(fetchedQuoteForAmount?.sellAmount || '0');
            } else {
                // For Algebra, use the user input amount directly
                requiredAmountWei = amountInWei;
            }
            
            console.log('=== CONVERSION DEBUG ===');
            console.log('User input amount:', amount);
            console.log('User input amount (Wei):', ethers.utils.formatEther(amountInWei));
            console.log('Required amount (with fees):', ethers.utils.formatEther(requiredAmountWei));
            console.log('Current WXDAI balance:', sellTokenBalance);
            console.log('Conversion needed:', conversionNeeded);
            
            if (conversionNeeded) {
                console.log('Converting native xDAI to WXDAI before swap...');
                await convertNativeToWXDAI(requiredAmountWei);
                
                // Force balance update and wait for it
                console.log('Updating balances after conversion...');
                await updateWxdaiBalance(); // Update WXDAI balance
                refetchBalances(); // Update native xDAI balance from balance manager
                
                // Keep transitioning state active to prevent double clicks
                console.log('Conversion completed, preparing for swap execution...');
                
                // Add a small delay to ensure balance update is complete
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // Re-check WXDAI balance after potential conversion with fresh contract call
            const wxdaiContract = new ethers.Contract(WXDAI_ADDRESS, WXDAI_ABI, signer);
            const freshBalanceWei = await wxdaiContract.balanceOf(account);
            const freshBalance = ethers.utils.formatUnits(freshBalanceWei, sellTokenDecimals);
            
            console.log('=== POST-CONVERSION BALANCE CHECK ===');
            console.log('Fresh WXDAI balance from contract:', freshBalance);
            console.log('Required amount (with fees):', ethers.utils.formatEther(requiredAmountWei));
            console.log('Fresh balance sufficient?', freshBalanceWei.gte(requiredAmountWei));
            
            if (freshBalanceWei.lt(requiredAmountWei)) {
                const shortfall = requiredAmountWei.sub(freshBalanceWei);
                const feeInfo = selectedSwapMethod === 'cowswap' && fetchedQuoteForAmount?.feeAmount 
                    ? ` + ${ethers.utils.formatEther(fetchedQuoteForAmount.feeAmount)} CoW fee`
                    : '';
                setDisplayError(`Still insufficient ${sellTokenSymbol} balance after conversion. Need ${ethers.utils.formatEther(requiredAmountWei)} total (${amount} input${feeInfo}) but have ${freshBalance}. Shortfall: ${ethers.utils.formatEther(shortfall)}`);
                return;
            }
            
            // Execute swap based on selected method
            if (selectedSwapMethod === 'cowswap') {
                console.log('[Native Swap] Executing via CoW Swap...');
                // Execute swap now includes the approval check
                await executeSwap(fetchedQuoteForAmount);
                if (error && orderStatus !== 'awaiting_approval') { // Don't show hook error if just waiting for approval tx
                    setDisplayError(error); 
                }
                setIsTransitioning(false); // Reset transitioning state
            } else if (selectedSwapMethod === 'algebra') {
                console.log('[Native Swap] Executing via Algebra (Swapr)...');
                
                // Set manual tracking states for Algebra
                setAlgebraStatus('checking_allowance');
                
                // Step 1: Check and approve WXDAI for Swapr router
                console.log('[Native Swap] Checking approval for WXDAI → Swapr...');
                const needsApproval = await checkAndApproveTokenForV3Swap({
                    signer,
                    tokenAddress: WXDAI_ADDRESS,
                    amount: requiredAmountWei,
                    eventHappens: true, // Not relevant for this swap but required by function
                    spenderAddressOverride: SWAPR_V3_ROUTER,
                    onApprovalNeeded: () => setAlgebraStatus('awaiting_approval'),
                    onApprovalComplete: () => setAlgebraStatus('signing_order')
                });
                
                if (!needsApproval) {
                    setAlgebraStatus('signing_order');
                }
                
                // Step 2: Execute the swap
                console.log('[Native Swap] Executing Algebra swap WXDAI → SDAI...');
                const swapTx = await executeAlgebraExactSingle({
                    signer,
                    tokenIn: WXDAI_ADDRESS,
                    tokenOut: currencyTokenAddress, // Should be SDAI address from the hook
                    amount: requiredAmountWei,
                    slippageBps: 50, // 0.5% slippage
                    options: { gasLimit: 400000, gasPrice: ethers.utils.parseUnits("0.97", "gwei") }
                });
                
                if (!swapTx || !swapTx.hash) {
                    throw new Error("Failed to get transaction hash from Algebra execution.");
                }
                
                console.log(`[Native Swap] Algebra Tx submitted: ${swapTx.hash}`);
                setAlgebraTxHash(swapTx.hash); // Store transaction hash for tracking
                setAlgebraStatus('submitted');
                
                // Wait for confirmation
                console.log('[Native Swap] Waiting for Algebra Tx confirmation...');
                const receipt = await swapTx.wait();
                console.log(`[Native Swap] Algebra Tx Confirmed! Hash: ${swapTx.hash}`);
                
                // Parse the swap output from the transaction receipt
                // Look for Transfer events to SDAI token to get the actual received amount
                // SDAI token address on Gnosis: 0xaf204776c7245bf4147c2612bf6e5972ee483701
                const SDAI_ADDRESS = '0xaf204776c7245bf4147c2612bf6e5972ee483701';
                
                // Create the Transfer event topic (Transfer(address,address,uint256))
                const transferTopic = ethers.utils.id('Transfer(address,address,uint256)');
                
                // Find SDAI transfer events to our account
                const sdaiTransferEvents = receipt.logs.filter(log => {
                    return log.address.toLowerCase() === SDAI_ADDRESS.toLowerCase() &&
                           log.topics[0] === transferTopic &&
                           log.topics[2] && ethers.utils.getAddress('0x' + log.topics[2].slice(26)) === account;
                });
                
                let actualReceivedAmount = null;
                if (sdaiTransferEvents.length > 0) {
                    const transferEvent = sdaiTransferEvents[0];
                    actualReceivedAmount = ethers.BigNumber.from(transferEvent.data);
                    console.log('[Native Swap] Actual received amount:', ethers.utils.formatUnits(actualReceivedAmount, currencyTokenDecimals));
                } else {
                    console.warn('[Native Swap] No SDAI transfer events found in receipt');
                    // Fallback: use a reasonable estimate based on input
                    actualReceivedAmount = amountInWei.mul(99).div(100); // Assume ~1% slippage
                }
                
                setAlgebraStatus('fulfilled');
                
                // Store the executed amount for display (hack for now)
                if (actualReceivedAmount) {
                    window.lastExecutedBuyAmount = actualReceivedAmount.toString();
                }
                
                // Update balances
                await updateWxdaiBalance(); // Update WXDAI balance
                refetchBalances(); // Update native xDAI balance from balance manager
                
                // Call completion callback if provided
                if (typeof onComplete === 'function') {
                    onComplete({
                        executedAmount: actualReceivedAmount || amountInWei,
                        outcome: nextStepOutcome,
                        action: nextStepAction
                    });
                }
                
                setIsTransitioning(false); // Reset transitioning state
            }
            
        } catch (conversionError) {
            console.error(`[Native Swap] Error in handleExecuteSwap (${selectedSwapMethod}):`, conversionError);
            setDisplayError(conversionError.message || 'Failed to prepare for swap');
            if (selectedSwapMethod === 'algebra') {
                setAlgebraStatus('failed');
            }
            setIsTransitioning(false); // Reset transitioning state on error
        }
    };

    const handleMaxClick = () => {
        setAmount(sellTokenBalance);
        setDisplayError(null);
    };

    const getButtonText = () => {
        if (effectiveStatus === 'fulfilled' || algebraStatus === 'fulfilled') return `Proceed to Next Step`; 
        
        // If order submitted but not yet final, show tracking
        if ((orderId || algebraTxHash) && !['fulfilled', 'expired', 'cancelled', 'failed', null].includes(effectiveStatus)) {
             return 'Tracking Transaction...';
        }

        // Handle conversion state
        if (isConvertingToWXDAI) {
            return 'Converting xDAI to WXDAI...';
        }

        // Handle transitioning state (brief moment between steps)
        if (isTransitioning) {
            return 'Preparing swap...';
        }

        // Handle specific loading states for both methods
        if (isLoading || effectiveStatus || algebraStatus) {
            // Handle Algebra-specific states
            if (selectedSwapMethod === 'algebra' && algebraStatus) {
                switch (algebraStatus) {
                    case 'checking_allowance': return 'Checking Allowance...';
                    case 'awaiting_approval': return 'Approve WXDAI...';
                    case 'signing_order': return 'Confirm Swap...';
                    case 'submitted': return 'Processing Transaction...';
                    default: return 'Processing...';
                }
            }
            
            // Handle CoW Swap states
            if (selectedSwapMethod === 'cowswap' && effectiveStatus) {
                switch (effectiveStatus) {
                    case 'fetching_quote': return 'Fetching Quote...';
                    case 'checking_allowance': return 'Checking Allowance...';
                    case 'awaiting_approval': return 'Approve WXDAI...';
                    case 'signing_order': return 'Confirm Swap...';
                    case 'submitted': return 'Processing Transaction...';
                    default: return isLoading ? 'Processing...' : null; 
                }
            }
        }
        
        // Handle states when not loading and not yet submitted/tracked/final
        if (selectedSwapMethod === 'cowswap' && (orderStatus === 'quote_received' || orderStatus === 'approval_error')) {
            return conversionNeeded ? 'Convert & Execute Swap' : 'Execute Swap';
        }
        
        // Default initial state - different based on swap method
        if (selectedSwapMethod === 'cowswap') {
            return 'Get Quote';
        } else {
            // For Algebra - always ready to execute directly
            return conversionNeeded ? 'Convert & Execute Swap' : 'Execute Swap';
        }
    };

    const isButtonDisabled = () => {
        // Explicitly enable if fulfilled (actual check for executedBuyAmount is on the button itself)
        if (effectiveStatus === 'fulfilled' || algebraStatus === 'fulfilled') return false; 

        if (isLoading || isConvertingToWXDAI || isTransitioning) return true;
        
        // Disable during all processing states
        if (effectiveStatus === 'checking_allowance' || 
            effectiveStatus === 'awaiting_approval' || 
            effectiveStatus === 'signing_order' || 
            effectiveStatus === 'submitted' || 
            effectiveStatus === 'tracking' ||
            effectiveStatus === 'open') return true;
            
        if (effectiveStatus === 'expired' || effectiveStatus === 'cancelled' || effectiveStatus === 'failed') return true; 
        
        // For Algebra mode - simple check, no quotes needed
        if (selectedSwapMethod === 'algebra') {
            return amountInWei.isZero() || !hasSufficientBalance || !!algebraStatus;
        }
        
        // For CoW Swap mode - more complex flow with quotes
        if (selectedSwapMethod === 'cowswap') {
            if (orderStatus === 'quote_received' || orderStatus === 'approval_error') {
                return !canExecuteSwap;
            }
            return !canFetchQuote; // For CoW, need to be able to fetch quote initially
        }
        
        return true; // Fallback - disable if unknown state
    };

    const getStatusMessage = () => {
        if (!orderStatus || !isLoading) return null;
        switch (orderStatus) {
            case 'fetching_quote': return 'Finding the best price on CoW Swap...';
            case 'checking_allowance': return 'Checking WXDAI allowance for CoW Swap...';
            case 'awaiting_approval': return 'Please approve WXDAI spending in your wallet.';
            case 'signing_order': return 'Please confirm the swap transaction in your wallet.';
            case 'submitted': return 'Swap submitted. Waiting for CoW Swap settlement...';
            case 'tracking': return 'Tracking swap status... This may take a minute.';
            default: return null;
        }
    };

    const formattedBuyAmount = useMemo(() => {
        if (!quoteData?.buyAmount) return '-';
        return formatBalance(ethers.utils.formatUnits(quoteData.buyAmount, currencyTokenDecimals), currencyTokenSymbol, 6);
    }, [quoteData, currencyTokenDecimals, currencyTokenSymbol]);

    const formattedFeeAmount = useMemo(() => {
        if (!quoteData?.feeAmount) return '-';
        // Fee is in sell token (WXDAI)
        return formatBalance(ethers.utils.formatUnits(quoteData.feeAmount, sellTokenDecimals), sellTokenSymbol, 6);
    }, [quoteData, sellTokenDecimals, sellTokenSymbol]);

    // Format the actual executed buy amount
    const formattedExecutedBuyAmount = useMemo(() => {
        if (!executedBuyAmount) return '-'; // Use executedBuyAmount from the hook
        return formatBalance(ethers.utils.formatUnits(executedBuyAmount, currencyTokenDecimals), currencyTokenSymbol, 6);
    }, [executedBuyAmount, currencyTokenDecimals, currencyTokenSymbol]);

    const backdropVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
    };

    const modalVariants = {
        hidden: { y: "100vh", opacity: 0 },
        visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100, damping: 20 } },
        exit: { y: "100vh", opacity: 0, transition: { duration: 0.3 } }
    };

    // Create portal container if it doesn't exist
    useEffect(() => {
        if (typeof document !== 'undefined') {
            let portalRoot = document.getElementById('modal-root');
            if (!portalRoot) {
                portalRoot = document.createElement('div');
                portalRoot.id = 'modal-root';
                document.body.appendChild(portalRoot);
            }
        }
    }, []);

    if (!isOpen) return null;

    const modalContent = (
        <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99999]"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={onClose}
        >
            <motion.div
                className="bg-white dark:bg-futarchyDarkGray2 rounded-xl p-4 max-w-sm w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto relative"
                variants={modalVariants}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header - Updated title based on initialAmount */}
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-futarchyGray12 dark:text-futarchyGray112">
                        {initialAmount ? "Step 1: Convert WXDAI to SDAI" : `Swap ${sellTokenSymbol} to ${currencyTokenSymbol}`}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-futarchyGray11 dark:text-futarchyGray9 hover:text-futarchyGray12 dark:hover:text-futarchyGray11 disabled:opacity-50"
                        disabled={isLoading && orderStatus !== 'quote_received' && orderStatus !== 'approval_error'} // Allow close unless signing/submitting
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Provider Status - Show if there are issues */}
                {(!isMetaMaskDetected || !account || chainId !== 100) && (
                    <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700/30 rounded-lg">
                        <ProviderStatus showDetails={true} />
                        {!isMetaMaskDetected && (
                            <div className="mt-2 text-xs text-orange-700 dark:text-orange-400">
                                For best stability, please install and use MetaMask browser extension.
                            </div>
                        )}
                    </div>
                )}

                {/* Swap Method Toggle */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-futarchyGray11 dark:text-futarchyGray112 mb-2">Swap Method:</label>
                    <div className="flex items-center space-x-4">
                        {/* CoW Swap Radio */}
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="radio"
                                name="nativeSwapMethod"
                                value="cowswap"
                                checked={selectedSwapMethod === 'cowswap'}
                                onChange={() => setSelectedSwapMethod('cowswap')}
                                className="form-radio text-futarchyBlue9 focus:ring-futarchyBlue9 dark:bg-futarchyDarkGray3 dark:border-futarchyDarkGray7 dark:focus:ring-offset-futarchyDarkGray3"
                                disabled={isLoading || !!orderId || !!algebraTxHash || orderStatus === 'fulfilled' || algebraStatus === 'fulfilled'}
                            />
                            <span className={`text-sm ${selectedSwapMethod === 'cowswap' ? 'text-futarchyGray12 dark:text-futarchyGray112 font-medium' : 'text-futarchyGray11 dark:text-futarchyGray112'}`}>
                                CoW Swap
                                <span className="text-xs block text-futarchyGray9 dark:text-futarchyGray9">(Gasless, MEV Protect)</span>
                            </span>
                        </label>
                        {/* Algebra (Swapr) Radio */}
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="radio"
                                name="nativeSwapMethod"
                                value="algebra"
                                checked={selectedSwapMethod === 'algebra'}
                                onChange={() => setSelectedSwapMethod('algebra')}
                                className="form-radio text-futarchyBlue9 focus:ring-futarchyBlue9 dark:bg-futarchyDarkGray3 dark:border-futarchyDarkGray7 dark:focus:ring-offset-futarchyDarkGray3"
                                disabled={isLoading || !!orderId || !!algebraTxHash || orderStatus === 'fulfilled' || algebraStatus === 'fulfilled'}
                            />
                            <span className={`text-sm ${selectedSwapMethod === 'algebra' ? 'text-futarchyGray12 dark:text-futarchyGray112 font-medium' : 'text-futarchyGray11 dark:text-futarchyGray112'}`}>
                                Algebra (Swapr)
                                <span className="text-xs block text-futarchyGray9 dark:text-futarchyGray9">(Direct Pool)</span>
                            </span>
                        </label>
                    </div>
                </div>

                {/* Wallet Info - Updated to show both balances */}
                <WalletInfo 
                    address={account} 
                    wxdaiBalance={sellTokenBalance} 
                    nativeBalance={nativeBalance}
                    wxdaiSymbol={sellTokenSymbol} 
                />

                {/* Input Amount - Updated label */}
                <div className="my-4">
                    <label htmlFor="swapAmount" className="block text-sm font-medium text-futarchyGray11 dark:text-futarchyGray112 mb-1">
                        Amount to Swap ({sellTokenSymbol})
                    </label>
                    <div className="relative">
                        {initialAmount ? (
                            // Static display when amount is pre-filled
                            <div 
                                className={`w-full px-4 py-3 bg-futarchyGray3 dark:bg-futarchyDarkGray3 border border-futarchyGray6 dark:border-futarchyDarkGray6 rounded-lg text-futarchyGray12 dark:text-futarchyGray112 text-base font-medium`} 
                            >
                                {amount} 
                            </div>
                        ) : (
                            // Editable input when amount is not pre-filled
                            <>
                                <input
                                    id="swapAmount"
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0.0"
                                    className={`w-full px-4 py-3 bg-white dark:bg-futarchyDarkGray1 border rounded-lg text-futarchyGray12 dark:text-futarchyGray112 text-base font-medium focus:outline-none focus:ring-2 ${!hasSufficientBalance && !amountInWei.isZero() ? 'border-red-500 ring-red-500 dark:border-red-700 dark:ring-red-700' : 'border-futarchyGray6 dark:border-futarchyDarkGray6 focus:ring-futarchyBlue9 dark:focus:ring-futarchyBlueDark9'}`}
                                    disabled={isLoading || !!orderId || orderStatus === 'fulfilled'}
                                />
                                <button
                                    onClick={handleMaxClick}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-futarchyGray4 dark:bg-futarchyDarkGray4 text-futarchyGray11 dark:text-futarchyGray112 rounded text-sm font-medium hover:bg-futarchyGray5 dark:hover:bg-futarchyDarkGray5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={isLoading || !!orderId || orderStatus === 'fulfilled'}
                                >
                                    Max
                                </button>
                            </>
                        )}
                    </div>
                    {!initialAmount && !hasSufficientBalance && !amountInWei.isZero() && (
                        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/30 rounded text-xs text-red-700 dark:text-red-400">
                            <div className="font-medium mb-1">Insufficient Balance</div>
                            <div className="space-y-1">
                                <div className="flex justify-between">
                                    <span>Input Amount:</span>
                                    <span>{formatBalance(amount, 'WXDAI', 4)}</span>
                                </div>
                                {fetchedQuoteForAmount?.feeAmount && (
                                    <div className="flex justify-between">
                                        <span>+ CoW Swap Fee:</span>
                                        <span>{formatBalance(ethers.utils.formatEther(fetchedQuoteForAmount.feeAmount), 'WXDAI', 4)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between border-t border-red-300 dark:border-red-700 pt-1">
                                    <span className="font-medium">Total Needed:</span>
                                    <span className="font-medium">
                                        {fetchedQuoteForAmount?.sellAmount 
                                            ? formatBalance(ethers.utils.formatEther(fetchedQuoteForAmount.sellAmount), 'WXDAI', 4)
                                            : formatBalance(amount, 'WXDAI', 4)
                                        }
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Available (WXDAI + xDAI):</span>
                                    <span>{formatBalance((parseFloat(sellTokenBalance) + parseFloat(nativeBalance) - 0.001).toString(), 'Total', 4)}</span>
                                </div>
                                <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                                    * Includes 0.001 xDAI reserved for gas fees
                                </div>
                            </div>
                        </div>
                    )}
                    {!initialAmount && conversionNeeded && hasSufficientBalance && !amountInWei.isZero() && (
                        <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/30 rounded text-xs text-blue-700 dark:text-blue-400">
                            <div className="font-medium mb-1">Conversion Required</div>
                            <div>Will convert native xDAI to WXDAI as needed.</div>
                            {(() => {
                                const totalAvailable = parseFloat(sellTokenBalance) + parseFloat(nativeBalance) - 0.001;
                                const requiredAmount = fetchedQuoteForAmount?.sellAmount 
                                    ? parseFloat(ethers.utils.formatEther(fetchedQuoteForAmount.sellAmount))
                                    : parseFloat(amount || '0');
                                const buffer = totalAvailable - requiredAmount;
                                
                                if (buffer < 0.01 && buffer > 0) {
                                    return (
                                        <div className="text-orange-600 dark:text-orange-400 mt-1">
                                            ⚠️ Low buffer: Only {buffer.toFixed(4)} xDAI remaining after fees
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                        </div>
                    )}
                    {chainId !== 100 && account && (
                         <p className="text-xs text-orange-600 mt-1">Please ensure you are connected to Gnosis Chain (ID 100).</p>
                    )}
                </div>

                {/* Balance Summary - Show conversion details when needed */}
                {conversionNeeded && !amountInWei.isZero() && (
                    <CollapsibleSection
                        title="Balance Summary"
                        isExpanded={expandedSections.balance}
                        onToggle={() => toggleSection('balance')}
                        showIndicator={conversionNeeded}
                    >
                        <div className="text-xs space-y-1.5">
                            <div className="flex justify-between items-center">
                                <span className="text-futarchyGray11 dark:text-futarchyGray112">Need:</span>
                                <span className="text-futarchyGray12 dark:text-futarchyGray112 font-medium">
                                    {fetchedQuoteForAmount?.sellAmount 
                                        ? formatBalance(ethers.utils.formatEther(fetchedQuoteForAmount.sellAmount), 'WXDAI', 4)
                                        : formatBalance(amount, 'WXDAI', 4)
                                    }
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-futarchyGray11 dark:text-futarchyGray112">Have:</span>
                                <span className="text-futarchyGreen11 dark:text-futarchyGreenDark11 font-medium">
                                    {formatBalance(sellTokenBalance, 'WXDAI', 4)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-futarchyGray11 dark:text-futarchyGray112">Convert:</span>
                                <span className="text-futarchyBlue11 dark:text-futarchyBlueDark11 font-medium">
                                    {(() => {
                                        const requiredWei = fetchedQuoteForAmount?.sellAmount 
                                            ? ethers.BigNumber.from(fetchedQuoteForAmount.sellAmount)
                                            : ethers.utils.parseEther(amount || '0');
                                        const wxdaiBalanceWei = ethers.utils.parseEther(sellTokenBalance || '0');
                                        const shortfall = requiredWei.sub(wxdaiBalanceWei);
                                        return formatBalance(ethers.utils.formatEther(shortfall.gt(0) ? shortfall : '0'), 'xDAI', 4);
                                    })()}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-futarchyGray11 dark:text-futarchyGray112">Available:</span>
                                <span className="text-futarchyGray12 dark:text-futarchyGray112 font-medium">
                                    {formatBalance(nativeBalance, 'xDAI', 4)}
                                </span>
                            </div>
                        </div>
                    </CollapsibleSection>
                )}

                {/* Quote/Result Display (Shows before submission) */}
                {(quoteData && !orderId && !isLoading) && (
                    <CollapsibleSection
                        title="Swap Details (via CoW Swap)"
                        isExpanded={expandedSections.quote}
                        onToggle={() => toggleSection('quote')}
                        showIndicator={quoteData && !orderId}
                    >
                        <div className="text-xs space-y-1.5">
                        <div className="flex justify-between">
                            <span className="text-futarchyGray11 dark:text-futarchyGray112">Est. Receive:</span>
                            <span className="text-futarchyGray12 dark:text-futarchyGray112 font-medium">{formattedBuyAmount}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-futarchyGray11 dark:text-futarchyGray112">Est. Fee:</span>
                            <span className="text-futarchyGray12 dark:text-futarchyGray112 font-medium">{formattedFeeAmount} ({sellTokenSymbol})</span>
                        </div>
                        </div>
                    </CollapsibleSection>
                )}

                {/* Step Visualization - Show when conversion is needed, in progress, or when ready to swap */}
                {(conversionNeeded || conversionStep || (hasSufficientBalance && !amountInWei.isZero())) && (
                    <CollapsibleSection
                        title="Transaction Steps"
                        isExpanded={expandedSections.steps}
                        onToggle={() => toggleSection('steps')}
                        showIndicator={conversionStep === 'converting' || (orderId && orderStatus) || (algebraTxHash && algebraStatus)}
                    >
                        {/* Step 1: Convert native xDAI to WXDAI (with substeps) */}
                        <div className="mb-3">
                            <div className="flex items-center gap-2 mb-1.5 mx-2">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                                    (conversionStep === 'completed' || (!conversionNeeded && hasSufficientBalance))
                                        ? 'text-futarchyGreen11 bg-futarchyGreen3'
                                        : conversionStep === 'converting'
                                            ? 'text-futarchyBlue11 bg-futarchyBlue3'
                                            : 'text-futarchyGray8 bg-futarchyGray4'
                                }`}>
                                    {(conversionStep === 'completed' || (!conversionNeeded && hasSufficientBalance)) ? (
                                        <CheckMark />
                                    ) : conversionStep === 'converting' && processingStep !== 'completed' ? (
                                        <LoadingSpinner className="h-5 w-5" />
                                    ) : (
                                        <span className="text-xs font-medium">1</span>
                                    )}
                                </div>
                                <span className={`flex-1 text-xs ${
                                    (conversionStep === 'completed' || conversionStep === 'converting' || (!conversionNeeded && hasSufficientBalance))
                                        ? 'text-futarchyGray12 dark:text-futarchyGray112' 
                                        : 'text-futarchyGray11 dark:text-futarchyGray112'
                                }`}>
                                    Convert xDAI → WXDAI {(!conversionNeeded && hasSufficientBalance) ? '(Already completed)' : ''}
                                </span>
                            </div>
                            
                            {/* Substeps for conversion */}
                            {conversionStep === 'converting' && (
                                <div className="ml-7 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-3 h-3 rounded-full flex items-center justify-center ${
                                            (completedSubsteps[1]?.substeps[1] || processingStep === 'completed')
                                                ? 'text-futarchyGreen11'
                                                : (currentSubstep.step === 1 && currentSubstep.substep === 1)
                                                    ? 'text-futarchyBlue11'
                                                    : 'text-futarchyGray8'
                                        }`}>
                                            {completedSubsteps[1]?.substeps[1] || processingStep === 'completed' ? (
                                                <CheckMark />
                                            ) : (currentSubstep.step === 1 && currentSubstep.substep === 1) ? (
                                                <LoadingSpinner className="h-3 w-3" />
                                            ) : (
                                                <div className="w-1.5 h-1.5 rounded-full bg-current" />
                                            )}
                                        </div>
                                        <span className="text-xs text-futarchyGray11 dark:text-futarchyGray112">
                                            Checking balance requirements
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-3 h-3 rounded-full flex items-center justify-center ${
                                            (completedSubsteps[1]?.substeps[2] || processingStep === 'completed')
                                                ? 'text-futarchyGreen11'
                                                : (currentSubstep.step === 1 && currentSubstep.substep === 2)
                                                    ? 'text-futarchyBlue11'
                                                    : 'text-futarchyGray8'
                                        }`}>
                                            {completedSubsteps[1]?.substeps[2] || processingStep === 'completed' ? (
                                                <CheckMark />
                                            ) : (currentSubstep.step === 1 && currentSubstep.substep === 2) ? (
                                                <LoadingSpinner className="h-3 w-3" />
                                            ) : (
                                                <div className="w-1.5 h-1.5 rounded-full bg-current" />
                                            )}
                                        </div>
                                        <span className="text-xs text-futarchyGray11 dark:text-futarchyGray112">
                                            Converting native xDAI to WXDAI
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* Step 2: Execute WXDAI to SDAI swap (with substeps) */}
                        <div className="mb-3">
                            <div className="flex items-center gap-2 mb-1.5 mx-2">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                                    effectiveStatus === 'fulfilled'
                                        ? 'text-futarchyGreen11 bg-futarchyGreen3'
                                        : ((conversionStep === 'completed' || (!conversionNeeded && hasSufficientBalance)) && (effectiveStatus === 'checking_allowance' || effectiveStatus === 'awaiting_approval' || effectiveStatus === 'signing_order' || effectiveStatus === 'submitted' || effectiveStatus === 'tracking'))
                                            ? 'text-futarchyBlue11 bg-futarchyBlue3'
                                            : (conversionStep === 'completed' || (!conversionNeeded && hasSufficientBalance))
                                                ? 'text-futarchyGray12 bg-futarchyGray3'
                                                : 'text-futarchyGray8 bg-futarchyGray4'
                                }`}>
                                    {effectiveStatus === 'fulfilled' ? (
                                        <CheckMark />
                                    ) : ((conversionStep === 'completed' || (!conversionNeeded && hasSufficientBalance)) && (effectiveStatus === 'checking_allowance' || effectiveStatus === 'awaiting_approval' || effectiveStatus === 'signing_order' || effectiveStatus === 'submitted' || effectiveStatus === 'tracking')) ? (
                                        <LoadingSpinner className="h-5 w-5" />
                                    ) : (
                                        <span className="text-xs font-medium">2</span>
                                    )}
                                </div>
                                <span className={`flex-1 text-xs ${
                                    effectiveStatus === 'fulfilled' || ((conversionStep === 'completed' || (!conversionNeeded && hasSufficientBalance)) && (effectiveStatus === 'checking_allowance' || effectiveStatus === 'awaiting_approval' || effectiveStatus === 'signing_order' || effectiveStatus === 'submitted' || effectiveStatus === 'tracking')) || (conversionStep === 'completed' || (!conversionNeeded && hasSufficientBalance))
                                        ? 'text-futarchyGray12 dark:text-futarchyGray112' 
                                        : 'text-futarchyGray11 dark:text-futarchyGray112'
                                }`}>
                                    Swap WXDAI → SDAI (via {selectedSwapMethod === 'cowswap' ? 'CoW' : 'Algebra'})
                                </span>
                            </div>
                            
                            {/* Substeps for swap */}
                            {((conversionStep === 'completed' || (!conversionNeeded && hasSufficientBalance)) && (effectiveStatus === 'checking_allowance' || effectiveStatus === 'awaiting_approval' || effectiveStatus === 'signing_order' || effectiveStatus === 'submitted' || effectiveStatus === 'tracking' || effectiveStatus === 'fulfilled')) && (
                                <div className="ml-7 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-3 h-3 rounded-full flex items-center justify-center ${
                                            (effectiveStatus === 'signing_order' || effectiveStatus === 'submitted' || effectiveStatus === 'tracking' || effectiveStatus === 'fulfilled')
                                                ? 'text-futarchyGreen11'
                                                : (effectiveStatus === 'checking_allowance' || effectiveStatus === 'awaiting_approval')
                                                    ? 'text-futarchyBlue11'
                                                    : 'text-futarchyGray8'
                                        }`}>
                                            {(effectiveStatus === 'signing_order' || effectiveStatus === 'submitted' || effectiveStatus === 'tracking' || effectiveStatus === 'fulfilled') ? (
                                                <CheckMark />
                                            ) : (effectiveStatus === 'checking_allowance' || effectiveStatus === 'awaiting_approval') ? (
                                                <LoadingSpinner className="h-3 w-3" />
                                            ) : (
                                                <div className="w-1.5 h-1.5 rounded-full bg-current" />
                                            )}
                                        </div>
                                        <span className="text-xs text-futarchyGray11 dark:text-futarchyGray112">
                                            Approving WXDAI for {selectedSwapMethod === 'cowswap' ? 'CoW Swap' : 'Algebra (Swapr)'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-3 h-3 rounded-full flex items-center justify-center ${
                                            effectiveStatus === 'fulfilled'
                                                ? 'text-futarchyGreen11'
                                                : (effectiveStatus === 'signing_order' || effectiveStatus === 'submitted' || effectiveStatus === 'tracking')
                                                    ? 'text-futarchyBlue11'
                                                    : 'text-futarchyGray8'
                                        }`}>
                                            {effectiveStatus === 'fulfilled' ? (
                                                <CheckMark />
                                            ) : (effectiveStatus === 'signing_order' || effectiveStatus === 'submitted' || effectiveStatus === 'tracking') ? (
                                                <LoadingSpinner className="h-3 w-3" />
                                            ) : (
                                                <div className="w-1.5 h-1.5 rounded-full bg-current" />
                                            )}
                                        </div>
                                        <span className="text-xs text-futarchyGray11 dark:text-futarchyGray112">
                                            Executing swap via {selectedSwapMethod === 'cowswap' ? 'CoW Swap' : 'Algebra (Swapr)'}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CollapsibleSection>
                )}

                {/* Conversion Status Display - Keep for additional info */}
                {isConvertingToWXDAI && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/30 p-4 rounded-lg mb-4 text-sm">
                        <div className="flex items-center gap-2">
                            <LoadingSpinner />
                            <span className="text-blue-700 dark:text-blue-300 font-medium">Converting native xDAI to WXDAI...</span>
                        </div>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">This will enable the WXDAI → SDAI swap.</p>
                    </div>
                )}

                {/* --- NEW: Order Tracking Display (Shows AFTER submission) --- */}
                {(orderId || algebraTxHash) && (
                     <div className="bg-futarchyGray2 dark:bg-futarchyDarkGray3 p-4 rounded-lg mb-4 text-sm space-y-2 border border-futarchyBlue6 dark:border-futarchyBlueDark6">
                        <h3 className="font-medium text-futarchyGray12 dark:text-futarchyGray112 mb-2">
                            {selectedSwapMethod === 'cowswap' ? 'Order Submitted & Tracking' : 'Transaction Submitted'}
                        </h3>
                        <div className="flex justify-between items-center">
                             <span className="text-futarchyGray11 dark:text-futarchyGray112">Status:</span>
                             <span className="font-medium text-futarchyGray12 dark:text-futarchyGray112 capitalize">
                                {effectiveStatus === 'fulfilled' ? <CheckMark/> : null} {effectiveStatus || 'Submitting...'}
                             </span>
                         </div>
                         <div className="text-center mt-1">
                             {selectedSwapMethod === 'cowswap' && orderId ? (
                                 <a
                                     href={`https://explorer.cow.fi/gc/orders/${orderId}`}
                                     target="_blank"
                                     rel="noopener noreferrer"
                                     className="text-futarchyBlue11 dark:text-futarchyBlueDark11 hover:text-futarchyBlue9 dark:hover:text-futarchyBlueDark9 break-all font-mono text-xs"
                                     title="View on CoW Swap Explorer"
                                 >
                                     Order ID: {orderId.slice(0,10)}...{orderId.slice(-8)}
                                 </a>
                             ) : algebraTxHash ? (
                                 <a
                                     href={`https://gnosisscan.io/tx/${algebraTxHash}`}
                                     target="_blank"
                                     rel="noopener noreferrer"
                                     className="text-futarchyBlue11 dark:text-futarchyBlueDark11 hover:text-futarchyBlue9 dark:hover:text-futarchyBlueDark9 break-all font-mono text-xs"
                                     title="View on GnosisScan"
                                 >
                                     Tx Hash: {algebraTxHash.slice(0,10)}...{algebraTxHash.slice(-8)}
                                 </a>
                             ) : null}
                         </div>
                         {/* Show detailed status message while processing */}
                         {(isLoading || effectiveStatus === 'submitted' || effectiveStatus === 'tracking') && getStatusMessage() && (
                            <p className="text-xs text-futarchyGray9 dark:text-futarchyGray112/70 text-center pt-2 border-t border-futarchyGray4 dark:border-futarchyDarkGray4 mt-2">{getStatusMessage()}</p>
                         )}
                         {/* Show success message */} 
                         {effectiveStatus === 'fulfilled' && (
                             <div>
                                 <div className="flex justify-between items-center pt-2 border-t border-futarchyGray4 dark:border-futarchyDarkGray4 mt-2">
                                     <span className="text-futarchyGray11 dark:text-futarchyGray112">Actual Received:</span>
                                     <span className="text-futarchyGray12 dark:text-futarchyGray112 font-medium">{formattedExecutedBuyAmount}</span>
                                 </div>
                                <p className="text-xs text-futarchyGreen11 dark:text-futarchyGreenDark11 text-center pt-1">Swap completed successfully!</p>
                            </div>
                         )}
                         {/* Show failure/expiry message */} 
                         {(effectiveStatus === 'expired' || effectiveStatus === 'cancelled' || effectiveStatus === 'failed') && (
                            <p className="text-xs text-futarchyCrimson11 dark:text-futarchyCrimsonDark11 text-center pt-2 border-t border-futarchyGray4 dark:border-futarchyDarkGray4 mt-2">
                                {selectedSwapMethod === 'cowswap' ? 'Order' : 'Transaction'} {effectiveStatus}. Please try again.
                            </p>
                         )}
                     </div>
                )}
                {/* --- END: Order Tracking Display --- */}

                {/* --- NEW: Fulfilled Amount Display --- */}
                {orderStatus === 'fulfilled' && formattedExecutedBuyAmount && (
                    <div className="bg-futarchyGreen3 dark:bg-futarchyGreenDark3 p-4 rounded-lg mb-4 text-sm space-y-2 border border-futarchyGreen6 dark:border-futarchyGreenDark6">
                        <h3 className="font-medium text-futarchyGreen11 dark:text-futarchyGreenDark11 mb-2">Swap Completed</h3>
                        <div className="flex justify-between">
                            <span className="text-futarchyGreen11 dark:text-futarchyGreenDark11">Actual Received:</span>
                            <span className="text-black dark:text-white font-medium">{formattedExecutedBuyAmount}</span>
                        </div>
                    </div>
                )}
                {/* --- END: Fulfilled Amount Display --- */}

                {/* Error Display */}
                {(displayError || (error && orderStatus !== 'awaiting_approval')) && ( // Show hook error unless waiting for approval
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/30 rounded-lg text-red-700 dark:text-red-400 text-sm">
                        {displayError || error}
                    </div>
                )}

                {/* Action Button - Refined logic */}
                <button
                    onClick={() => {
                        console.log("[Action Button Click] Click registered!");
                        console.log("[Action Button Click] Status:", orderStatus, "Executed Amount:", executedBuyAmount);
                        console.log("[Action Button Click] Selected method:", selectedSwapMethod);
                        
                        if (orderStatus === 'fulfilled' || algebraStatus === 'fulfilled') {
                            // Call onComplete instead of onClose if fulfilled
                            if (executedBuyAmount && nextStepOutcome && nextStepAction) {
                                console.log("[Action Button Click] Calling onComplete with:", { executedAmount: executedBuyAmount, outcome: nextStepOutcome, action: nextStepAction });
                                onComplete({ 
                                    executedAmount: executedBuyAmount, 
                                    outcome: nextStepOutcome, 
                                    action: nextStepAction 
                                });
                            } else {
                                console.warn("[Action Button Click] Swap fulfilled but missing data for next step, falling back to onClose.", { executedBuyAmount, nextStepOutcome, nextStepAction });
                                onClose(); 
                            }
                        } else if (selectedSwapMethod === 'algebra') {
                            // For Algebra, always go directly to execution (no quotes needed)
                            console.log("[Action Button Click] Calling handleExecuteSwap directly for Algebra");
                            handleExecuteSwap();
                        } else if (selectedSwapMethod === 'cowswap') {
                            // For CoW Swap, check if we need quote or can execute
                            if (orderStatus === 'quote_received' || orderStatus === 'approval_error') {
                                console.log("[Action Button Click] Calling handleExecuteSwap for CoW Swap (quote ready)");
                                handleExecuteSwap();
                            } else {
                                console.log("[Action Button Click] Calling handleFetchQuote for CoW Swap");
                                handleFetchQuote();
                            }
                        }
                    }}
                    // Disable Done/Proceed button if fulfilled but executed amount isn't loaded yet
                    disabled={isButtonDisabled() || ((orderStatus === 'fulfilled' || algebraStatus === 'fulfilled') && !executedBuyAmount)} 
                    className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center ${orderStatus === 'fulfilled'
                            ? 'bg-futarchyGreen7 text-futarchyGreen11 hover:bg-futarchyGreen8 dark:bg-futarchyGreenDark7 dark:text-futarchyGreenDark11 dark:hover:bg-futarchyGreenDark8'
                            : isButtonDisabled()
                                ? 'bg-futarchyGray6 text-futarchyGray9 dark:bg-futarchyDarkGray6 dark:text-futarchyDarkGray9 cursor-not-allowed'
                                : 'bg-black text-white hover:bg-black/90 dark:bg-futarchyBlueDark9 dark:text-white dark:hover:bg-futarchyBlueDark10'
                    }`}
                >
                    {isLoading && <LoadingSpinner />}
                    {getButtonText()}
                    {orderStatus === 'fulfilled' && <CheckMark />}
                </button>

            </motion.div>
        </motion.div>
    );

    // Return portal or null if no portal root
    if (typeof document === 'undefined') return null;
    const portalRoot = document.getElementById('modal-root');
    if (!portalRoot) return null;
    
    return ReactDOM.createPortal(modalContent, portalRoot);
};

SwapNativeToCurrencyModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    initialAmount: PropTypes.string,
    // Add propTypes for new props
    onComplete: PropTypes.func,
    nextStepOutcome: PropTypes.string,
    nextStepAction: PropTypes.string,
};

export default SwapNativeToCurrencyModal; 