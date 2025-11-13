import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { ethers } from 'ethers'; // For nativeBalance formatting and amount parsing

// Components used by this modal
import ActionButton from './components/ActionButton';
import TransactionSteps from './components/TransactionSteps';

// Helper function
const formatBalance = (value, symbol, decimals = 18) => {
    if (value === undefined || value === null) return `0.00 ${symbol || ''}`;
    try {
        const valStr = typeof value === 'string' ? value : value.toString();
        const num = parseFloat(ethers.utils.formatUnits(valStr, decimals));
        return `${num.toFixed(4)} ${symbol || ''}`;
    } catch (e) {
        console.warn("formatBalance error:", e, {value, symbol, decimals});
        return `--- ${symbol || ''}`;
    }
};

// Mocked/Example components
const MetamaskIcon = () => <span role="img" aria-label="metamask">🦊</span>;

const WalletInformation = ({ walletAddress, walletIcon }) => {
    const truncateAddress = (address) => address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "No Wallet";
    return (
        <div className="flex flex-row bg-futarchyGray2 dark:bg-futarchyDarkGray2 border-2 border-futarchyGray62 dark:border-futarchyGray11/70 rounded-2xl p-3 mb-4">
            <div className="flex flex-col gap-[2px]">
                <div className="text-futarchyGray11 dark:text-white/70 text-xs">Connected Wallet</div>
                <div className="flex flex-row items-center gap-[6px] text-futarchyGray12 dark:text-white text-sm font-medium">
                    {walletIcon} {truncateAddress(walletAddress)}
                </div>
            </div>
        </div>
    );
};
WalletInformation.propTypes = { walletAddress: PropTypes.string, walletIcon: PropTypes.node };

// Removed TokenToggle as it was collateral-specific for add/remove

const CloseIcon = () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

// --- Main TransactionModal (Now a generic modal) ---
const TransactionModal = ({
    isOpen,
    onClose,
    config, // The main config object (e.g., SwapConfig, CollateralConfig)
    transactionType, // e.g., 'Buy', 'Sell', 'add', 'remove'
    
    // Props that were previously internal state or mock data
    outcome, // 'YES', 'NO', or null
    swapMethod, // 'cowswap', 'algebra', or null
    tokenConfig, // object with token definitions
    balances, // object with user's token balances
    desiredOutputAmount, // The target amount string

    // ClassNames
    modalContainerClassName = "fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4",
    modalPanelClassName = "flex flex-col bg-futarchyGray3 dark:bg-futarchyDarkGray3 rounded-3xl border-2 border-futarchyGray62 dark:border-futarchyGray11/70 overflow-hidden max-w-md w-full flex flex-col max-h-[90vh]",
    headerClassName = "flex justify-between items-center p-4 border-b-2 border-futarchyGray62 dark:border-futarchyGray11/70 bg-futarchyGray2 dark:bg-futarchyDarkGray2",
    titleClassName = "text-lg font-semibold text-futarchyGray12 dark:text-white",
    closeButtonClassName = "text-futarchyGray11 hover:text-futarchyGray12 dark:text-futarchyGray112 dark:hover:text-white p-1 rounded-full hover:bg-futarchyGray4 dark:hover:bg-futarchyDarkGray4 transition-colors",
    contentContainerClassName = "flex-grow overflow-y-auto p-4",
    footerClassName = "p-4 border-t-2 border-futarchyGray62 dark:border-futarchyGray11/70",
    // Allow passing custom content into the modal's body
    children, 
    isAmountValid, // Now a direct prop
    requiresCollateral, // Can be passed from parent
}) => {
    // --- Internal State for transaction processing ---
    const [internalProcessingStep, setInternalProcessingStep] = useState(null); // e.g., 'collateral_approve_router', 'swap_approve_cow', 'completed'
    const [completedStepsData, setCompletedStepsData] = useState({});
    const [localError, setLocalError] = useState(null);
    const mockConnectedWalletAddress = "0x1234...abcd"; // Keeping as a mock for now

    // --- Derived State & Config from props ---
    const modalTitle = config.getTitle(transactionType, outcome);
    const stepsConfiguration = useMemo(() => config.getStepsConfig(
        transactionType, 
        outcome, 
        swapMethod
    ), [config, transactionType, outcome, swapMethod]);
    
    // Find the right mapping function from the config, now with a generic fallback
    const mapProcessingStepToGlobalState = config.mapProcessingStepToGlobalState || config.mapSwapProcessingStepToGlobalState || config.mapCollateralProcessingStepToGlobalState;
    
    const { 
        currentGlobalProcessingStepKey, 
        currentActiveSubstepId,
        isCompleted: isTransactionFlowCompleted 
    } = useMemo(() => mapProcessingStepToGlobalState(
        internalProcessingStep, 
        transactionType, 
        outcome, 
        swapMethod
    ), [internalProcessingStep, mapProcessingStepToGlobalState, transactionType, outcome, swapMethod]);

    // Re-introducing outputTokenConfig calculation
    const outputTokenConfig = useMemo(() => {
        if (!outcome || !tokenConfig) return null;
        return outcome === 'YES' ? tokenConfig.yesToken : tokenConfig.noToken;
    }, [outcome, tokenConfig]);

    // --- Effects ---
    useEffect(() => { // Reset form on open or when core parameters change, if not processing
        if (isOpen) {
            if (!internalProcessingStep || internalProcessingStep === 'completed') {
                const initialStepsData = {};
                stepsConfiguration.forEach(sc => {
                    initialStepsData[sc.stepKey] = { completed: false, completedSubsteps: new Set() };
                });
                setCompletedStepsData(initialStepsData);
            }
        } else {
            // Reset states when modal is closed
            setInternalProcessingStep(null);
            setCompletedStepsData({});
            setLocalError(null);
        }
    }, [isOpen, stepsConfiguration]); // Re-init if steps change

    useEffect(() => { // Update completed steps data based on internalProcessingStep
        if (!mapProcessingStepToGlobalState) return;
        setCompletedStepsData(prevCompletedStepsData => {
            const newCompletedData = { ...prevCompletedStepsData };
            let currentOverallStepConfig = stepsConfiguration.find(sc => sc.stepKey === currentGlobalProcessingStepKey);
            let hasChanged = false;

            if (currentOverallStepConfig) {
                // Ensure the entry for the current global step exists
                if (!newCompletedData[currentOverallStepConfig.stepKey]) {
                    newCompletedData[currentOverallStepConfig.stepKey] = { completed: false, completedSubsteps: new Set() };
                    hasChanged = true;
                }
                const stepProgress = { ...newCompletedData[currentOverallStepConfig.stepKey] }; // Clone for modification

                if (isTransactionFlowCompleted) { // If the whole transaction flow is marked as completed
                    // Mark this specific global step as completed and all its substeps
                    if (!stepProgress.completed) {
                        stepProgress.completed = true;
                        hasChanged = true;
                    }
                    currentOverallStepConfig.substeps.forEach(sub => {
                        if (!stepProgress.completedSubsteps.has(sub.id)) {
                            stepProgress.completedSubsteps.add(sub.id);
                            hasChanged = true;
                        }
                    });
                } else if (currentActiveSubstepId) { // If there's an active substep within this global step
                    const activeSubstepIndex = currentOverallStepConfig.substeps.findIndex(s => s.id === currentActiveSubstepId);
                    // Mark all preceding substeps as completed
                    for (let i = 0; i < activeSubstepIndex; i++) {
                        if (!stepProgress.completedSubsteps.has(currentOverallStepConfig.substeps[i].id)) {
                            stepProgress.completedSubsteps.add(currentOverallStepConfig.substeps[i].id);
                            hasChanged = true;
                        }
                    }
                    // If the main step was previously marked completed but now we are active in one of its substeps, un-complete it
                    if (stepProgress.completed) {
                        stepProgress.completed = false;
                        hasChanged = true;
                    }
                } else if (!internalProcessingStep) { // Reset if processing step becomes null (e.g. modal just opened, or error)
                    if (stepProgress.completed || stepProgress.completedSubsteps.size > 0) {
                        stepProgress.completed = false;
                        stepProgress.completedSubsteps.clear();
                        hasChanged = true;
                    }
                }
                
                if (hasChanged) {
                    newCompletedData[currentOverallStepConfig.stepKey] = stepProgress;
                    return newCompletedData;
                }
            }
            return hasChanged ? newCompletedData : prevCompletedStepsData;
        });
    }, [internalProcessingStep, stepsConfiguration, currentGlobalProcessingStepKey, currentActiveSubstepId, isTransactionFlowCompleted]);


    // --- Mock Primary Action (Simulates Transaction Flow) ---
    const handlePrimaryActionSubmit = async () => {
        setLocalError(null);
        const initialStepsDataForAction = {};
        stepsConfiguration.forEach(sc => {
            initialStepsDataForAction[sc.stepKey] = { completed: false, completedSubsteps: new Set() };
        });
        setCompletedStepsData(initialStepsDataForAction);
        
        const allSubstepsInOrder = stepsConfiguration.flatMap(mainStep => 
            mainStep.substeps.map(subStep => ({ ...subStep, mainStepKey: mainStep.stepKey }))
        );
        
        // This filtering is swap-specific. A better way would be for getStepsConfig to return the right steps.
        const stepsToExecute = (transactionType === 'Buy' && !requiresCollateral)
            ? allSubstepsInOrder.filter(subStep => !subStep.mainStepKey.toLowerCase().includes('collateral'))
            : allSubstepsInOrder;

        let currentExecutionIndex = 0;

        const executeNextOverallSubstep = async () => {
            if (currentExecutionIndex >= stepsToExecute.length) {
                setInternalProcessingStep('completed');
                console.log("All transaction substeps completed for:", modalTitle);
                return;
            }

            const substepToExecute = stepsToExecute[currentExecutionIndex];
            setInternalProcessingStep(substepToExecute.id);
            
            console.log(`Executing Substep: ${substepToExecute.text} (ID: ${substepToExecute.id}, MainStepKey: ${substepToExecute.mainStepKey})`);
            if (substepToExecute.action) {
                try {
                    // This logic is now simplified to pass a generic amount.
                    const actionParams = {
                        ...substepToExecute.actionParams,
                        // The parent provides the relevant amount string (e.g., from an input field).
                        amount: desiredOutputAmount ? ethers.utils.parseUnits(desiredOutputAmount, 18).toString() : "0", 
                        
                        // Contextual info for the action to use
                        inputToken: tokenConfig?.baseToken, 
                        outputToken: outputTokenConfig,
                        selectedTransactionType: transactionType,
                        selectedOutcome: outcome,
                        selectedSwapMethod: swapMethod,
                        walletAddress: mockConnectedWalletAddress,
                    };

                    console.log("Calling action with params:", actionParams);
                    const result = await substepToExecute.action(actionParams);
                    console.log(`Substep Action Result (${substepToExecute.text}):`, result);
                    if (!result.success) {
                        throw new Error(result.message || "Substep action failed");
                    }
                } catch (err) {
                    console.error("Error during substep action:", err);
                    setLocalError(err.message || "An error occurred during the transaction.");
                    setInternalProcessingStep(null); // Stop processing on error
                    return; // Stop further execution
                }
            }
            
            console.log(`Simulating delay for substep: ${substepToExecute.text}...`);
            await new Promise(resolve => setTimeout(resolve, 1500)); 
            console.log(`Delay finished for substep: ${substepToExecute.text}.`);
            
            currentExecutionIndex++;
            executeNextOverallSubstep(); // Proceed to next substep in the flattened list
        };

        executeNextOverallSubstep(); // Start the chain
    };
    
    // --- Get Action Button Props ---
    // The `isValid` prop is swap-specific. For collateral, it might just be amount > 0.
    // The parent component should determine validity. For now, we pass `isValid` for swaps, and `true` for others.
    const isAmountValidForAction = isAmountValid;

    const actionButtonProps = config.getActionButtonProps({
        transactionType: transactionType,
        action: transactionType, // for collateral config
        localProcessingStep: internalProcessingStep,
        isAmountValid: isAmountValidForAction,
        onCloseModal: onClose,
        onPrimaryActionSubmit: handlePrimaryActionSubmit,
        requiresCollateral: requiresCollateral,
    });

    // --- Backdrop & Close Logic ---
    const isHeaderCloseDisabled = !!internalProcessingStep && internalProcessingStep !== 'completed';
    const handleBackdropClick = () => !isHeaderCloseDisabled && onClose();

    // --- Framer Motion Variants ---
    const backdropVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.2 } }, exit: { opacity: 0, transition: { duration: 0.3 } } };
    const modalVariants = { hidden: { opacity: 0, y: 20, scale: 0.98 }, visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25, ease: "circOut" } }, exit: { opacity: 0, y: 20, scale: 0.98, transition: { duration: 0.2, ease: "circIn" } } };

    const showProcessingSteps = internalProcessingStep && internalProcessingStep !== "completed";

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div className={modalContainerClassName} onClick={handleBackdropClick} variants={backdropVariants} initial="hidden" animate="visible" exit="exit">
                    <motion.div className={modalPanelClassName} onClick={(e) => e.stopPropagation()} variants={modalVariants}>
                        <div className={headerClassName}>
                            <h2 className={titleClassName}>{modalTitle}</h2>
                            <button onClick={onClose} className={closeButtonClassName} disabled={isHeaderCloseDisabled}><CloseIcon /></button>
                        </div>

                        <div className={contentContainerClassName}>
                             <WalletInformation walletAddress={mockConnectedWalletAddress} walletIcon={<MetamaskIcon />} />
                            
                            <AnimatePresence mode="wait">
                                {!showProcessingSteps ? (
                                    <motion.div key="modal-input-content" initial={{ opacity: 0, y:10 }} animate={{ opacity: 1, y:0 }} exit={{ opacity:0, y:-10}} transition={{duration:0.2}} className="flex flex-col gap-4 mt-1">
                                        {/* Content is now passed from the parent */}
                                        {children}
                                    </motion.div>
                                ) : (
                                     <motion.div key="modal-processing" initial={{ opacity: 0, y:10 }} animate={{ opacity: 1, y:0 }} exit={{ opacity:0, y:-10}} transition={{duration:0.3}} className="mt-4">
                                        <TransactionSteps
                                            stepsConfig={stepsConfiguration}
                                            currentGlobalProcessingStepKey={currentGlobalProcessingStepKey}
                                            currentActiveSubstepId={currentActiveSubstepId}
                                            completedStepsData={completedStepsData}
                                            defaultThemeKey={transactionType?.toLowerCase()} // e.g., 'buy', 'add', 'remove'
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {(localError) && (
                                <div className="mt-4 p-3 rounded-2xl border-2 text-sm bg-futarchyCrimson4 text-futarchyCrimson11 border-futarchyCrimson9 dark:bg-futarchyCrimson9/30 dark:text-futarchyCrimson7 dark:border-futarchyCrimson9">
                                    {localError}
                                </div>
                            )}
                        </div>

                        {actionButtonProps && (
                            <div className={footerClassName}>
                                <ActionButton {...actionButtonProps} />
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

TransactionModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    config: PropTypes.object.isRequired,
    transactionType: PropTypes.string.isRequired,
    
    // Optional props that depend on the config being used
    outcome: PropTypes.string,
    swapMethod: PropTypes.string,
    tokenConfig: PropTypes.object,
    balances: PropTypes.object,
    desiredOutputAmount: PropTypes.string,
    isAmountValid: PropTypes.bool, // Now a direct prop
    requiresCollateral: PropTypes.bool, // Can be passed from parent

    // ClassNames
    modalContainerClassName: PropTypes.string,
    modalPanelClassName: PropTypes.string,
    headerClassName: PropTypes.string,
    titleClassName: PropTypes.string,
    closeButtonClassName: PropTypes.string,
    contentContainerClassName: PropTypes.string,
    footerClassName: PropTypes.string,
    children: PropTypes.node, // To pass custom content
};

export default TransactionModal;