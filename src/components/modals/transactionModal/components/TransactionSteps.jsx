import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';

// #region ========== HELPER COMPONENTS & CONSTANTS ==========

const LoadingSpinner = ({ className = "" }) => (
    <svg className={`animate-spin h-4 w-4 ${className}`} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.15" />
        <path fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" d="M4 12a8 8 0 018-8" />
    </svg>
);
LoadingSpinner.propTypes = { className: PropTypes.string };

const CheckMark = ({ className = "w-4 h-4" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
);
CheckMark.propTypes = { className: PropTypes.string };

const THEMES = {
    add: { activeText: 'text-futarchyBlue11', activeBg: 'bg-futarchyBlue3', completedText: 'text-futarchyBlue11', completedBg: 'bg-futarchyBlue3', inactiveText: 'text-futarchyGray8', inactiveBg: 'bg-futarchyGray4', stepTitleActiveText: 'text-futarchyGray12 dark:text-futarchyGray3', stepTitleInactiveText: 'text-futarchyGray11 dark:text-futarchyGray3', substepInactiveText: 'text-futarchyGray11 dark:text-futarchyGray3', substepActiveText: 'text-futarchyGray12 dark:text-futarchyGray3', substepCompletedText: 'text-futarchyGray12 dark:text-futarchyGray3', toggleDetailsText: 'text-futarchyBlue11' },
    remove: { activeText: 'text-futarchyEmerald11', activeBg: 'bg-futarchyEmerald3', completedText: 'text-futarchyEmerald11', completedBg: 'bg-futarchyEmerald3', inactiveText: 'text-futarchyGray8', inactiveBg: 'bg-futarchyGray4', stepTitleActiveText: 'text-futarchyGray12 dark:text-futarchyGray3', stepTitleInactiveText: 'text-futarchyGray11 dark:text-futarchyGray3', substepInactiveText: 'text-futarchyGray11 dark:text-futarchyGray3', substepActiveText: 'text-futarchyGray12 dark:text-futarchyGray3', substepCompletedText: 'text-futarchyGray12 dark:text-futarchyGray3', toggleDetailsText: 'text-futarchyEmerald11' },
    buy: { activeText: 'text-futarchyBlue11', activeBg: 'bg-futarchyBlue3', completedText: 'text-futarchyBlue11', completedBg: 'bg-futarchyBlue3', inactiveText: 'text-futarchyGray8', inactiveBg: 'bg-futarchyGray4', stepTitleActiveText: 'text-futarchyGray12 dark:text-futarchyGray112', stepTitleInactiveText: 'text-futarchyGray11 dark:text-futarchyGray112', substepInactiveText: 'text-futarchyGray11 dark:text-futarchyGray112', substepActiveText: 'text-futarchyGray12 dark:text-futarchyGray112', substepCompletedText: 'text-futarchyGray12 dark:text-futarchyGray112', toggleDetailsText: 'text-futarchyBlue11' },
    sell: { activeText: 'text-futarchyCrimson11', activeBg: 'bg-futarchyCrimson3', completedText: 'text-futarchyCrimson11', completedBg: 'bg-futarchyCrimson3', inactiveText: 'text-futarchyGray8', inactiveBg: 'bg-futarchyGray4', stepTitleActiveText: 'text-futarchyGray12 dark:text-futarchyGray112', stepTitleInactiveText: 'text-futarchyGray11 dark:text-futarchyGray112', substepInactiveText: 'text-futarchyGray11 dark:text-futarchyGray112', substepActiveText: 'text-futarchyGray12 dark:text-futarchyGray112', substepCompletedText: 'text-futarchyGray12 dark:text-futarchyGray112', toggleDetailsText: 'text-futarchyCrimson11' }
};

// #endregion

// #region ========== STEP DISPLAY COMPONENT ==========

// --- StepDisplay Logic ---
const StepDisplay = ({
    stepNumber,
    title,
    substeps,
    isExpanded,
    onToggleExpansion,
    currentProcessingInfo,
    completedSubstepsTracker,
    themeColors,
}) => {
    const {
        isStepCompletedOverall,
        isMainStepActive,
        activeSubstepIdWithinThisStep,
    } = currentProcessingInfo;

    const getStepColorsClasses = () => {
        if (isStepCompletedOverall) {
            return `${themeColors.completedText || 'text-futarchyGray12'} ${themeColors.completedBg || 'bg-futarchyGray4'}`;
        }
        if (isMainStepActive) {
            return `${themeColors.activeText || 'text-futarchyBlue11'} ${themeColors.activeBg || 'bg-futarchyBlue3'}`;
        }
        return `${themeColors.inactiveText || 'text-futarchyGray8'} ${themeColors.inactiveBg || 'bg-futarchyGray4'}`;
    };

    const stepIconContainerClasses = () => {
        const colorClasses = getStepColorsClasses();
        // If the main step's spinner is active (i.e., a substep is active), remove the background class for transparency
        if (isMainStepActive && activeSubstepIdWithinThisStep !== null) {
            return colorClasses.split(' ').filter(cls => !cls.startsWith('bg-')).join(' ');
        }
        return colorClasses;
    };

    const stepTitleClass = isStepCompletedOverall || isMainStepActive
        ? (themeColors.stepTitleActiveText || 'text-futarchyGray12 dark:text-futarchyGray3')
        : (themeColors.stepTitleInactiveText || 'text-futarchyGray11 dark:text-futarchyGray3');

    // --- StepDisplay JSX ---
    return (
        <motion.div
            initial={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0, marginBottom: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-4 overflow-hidden"
        >
            <div className="flex items-center gap-3 mb-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${stepIconContainerClasses()}`}>
                    {isStepCompletedOverall ? (
                        <CheckMark className="w-5 h-5" />
                    ) : isMainStepActive && activeSubstepIdWithinThisStep !== null ? (
                        <LoadingSpinner className="h-6 w-6" />
                    ) : (
                        // Display step number only if it's not active and not completed
                        !isMainStepActive && !isStepCompletedOverall && <span className="text-sm font-medium">{stepNumber}</span>
                    )}
                </div>
                <span className={`flex-1 ${stepTitleClass}`}>
                    {title}
                </span>
                <button
                    onClick={onToggleExpansion}
                    className={`${themeColors.toggleDetailsText || 'text-futarchyBlue11'} hover:opacity-80 text-sm`}
                >
                    {isExpanded ? "Hide details" : "Show details"}
                </button>
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="ml-9 space-y-2 overflow-hidden"
                    >
                        {substeps.map((substep) => {
                            const isSubstepCompleted = completedSubstepsTracker.has(substep.id) || isStepCompletedOverall;
                            const isSubstepActive = isMainStepActive && activeSubstepIdWithinThisStep === substep.id;

                            let substepTextColor;
                            switch (true) {
                                case isSubstepCompleted:
                                    substepTextColor = themeColors.substepCompletedText || 'text-futarchyGray12 dark:text-futarchyGray3';
                                    break;
                                case isSubstepActive:
                                    substepTextColor = themeColors.substepActiveText || 'text-futarchyGray12 dark:text-futarchyGray3';
                                    break;
                                default:
                                    substepTextColor = themeColors.substepInactiveText || 'text-futarchyGray11 dark:text-futarchyGray3';
                            }
                            
                            const iconColor = isSubstepCompleted || isSubstepActive 
                                ? (themeColors.activeText || 'text-futarchyBlue11') 
                                : (themeColors.inactiveText || 'text-futarchyGray8');

                            return (
                                <div key={substep.id} className="flex items-center gap-2">
                                    <div className={`w-4 h-4 rounded-full flex items-center justify-center ${iconColor}`}>
                                        {isSubstepCompleted ? (
                                            <CheckMark />
                                        ) : isSubstepActive ? (
                                            <LoadingSpinner />
                                        ) : (
                                            <div className="w-2 h-2 rounded-full bg-current opacity-50" /> // Default dot for pending
                                        )}
                                    </div>
                                    <span className={`text-sm ${substepTextColor}`}>
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

StepDisplay.propTypes = {
    stepNumber: PropTypes.number.isRequired,
    title: PropTypes.string.isRequired,
    substeps: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
        text: PropTypes.string.isRequired,
    })).isRequired,
    isExpanded: PropTypes.bool.isRequired,
    onToggleExpansion: PropTypes.func.isRequired,
    currentProcessingInfo: PropTypes.shape({
        isStepCompletedOverall: PropTypes.bool,
        isMainStepActive: PropTypes.bool,
        activeSubstepIdWithinThisStep: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    }).isRequired,
    completedSubstepsTracker: PropTypes.instanceOf(Set).isRequired,
    themeColors: PropTypes.object.isRequired,
};

// #endregion

// #region ========== TRANSACTION STEPS COMPONENT ==========

// --- TransactionSteps Logic ---
const TransactionSteps = ({
    stepsConfig,
    currentGlobalProcessingStepKey,
    currentActiveSubstepId,
    completedStepsData,
    defaultThemeKey = 'add',
    maxHeight = "240px",
    className = "",
}) => {
    const [expandedState, setExpandedState] = useState({});

    useEffect(() => {
        const newExpanded = {};
        let firstNonCompletedFound = false;

        stepsConfig.forEach(step => {
            const isStepOverallCompleted = completedStepsData[step.stepKey]?.completed;
            if (!isStepOverallCompleted && !firstNonCompletedFound) {
                newExpanded[step.stepKey] = true;
                firstNonCompletedFound = true;
            } else {
                newExpanded[step.stepKey] = false;
            }
        });

        // If a specific step is actively processing and not yet marked as completed overall, ensure it's expanded.
        if (currentGlobalProcessingStepKey && !completedStepsData[currentGlobalProcessingStepKey]?.completed) {
            Object.keys(newExpanded).forEach(k => newExpanded[k] = false); // Collapse others
            newExpanded[currentGlobalProcessingStepKey] = true;
        } else if (!firstNonCompletedFound && stepsConfig.length > 0) {
            // Fallback: if all are completed or no active step, expand the first step.
            newExpanded[stepsConfig[0].stepKey] = true;
        }
        setExpandedState(newExpanded);
    }, [stepsConfig, currentGlobalProcessingStepKey, completedStepsData]);

    const toggleExpansion = (stepKey) => {
        setExpandedState(prev => ({ ...prev, [stepKey]: !prev[stepKey] }));
    };

    if (!stepsConfig || stepsConfig.length === 0) {
        return null;
    }

    // --- TransactionSteps JSX ---
    return (
        <div className={`relative ${className}`}>
            {/* Show gradient overlay only if there's more than one step, implying potential scroll */}
            {stepsConfig.length > 1 && (
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent dark:from-futarchyDarkGray3 dark:to-transparent pointer-events-none z-10" />
            )}
            <div style={{ maxHeight }} className="overflow-y-auto pr-2 -mr-2"> {/* pr-2 -mr-2 for scrollbar */}
                <AnimatePresence>
                    {stepsConfig.map((stepConfig, mainIndex) => {
                        // Ensure stepData is always an object, even if not in completedStepsData yet
                        const stepData = completedStepsData[stepConfig.stepKey] || { completed: false, completedSubsteps: new Set() };
                        
                        const isThisMainStepActive = currentGlobalProcessingStepKey === stepConfig.stepKey && !stepData.completed;

                        const processingInfoForThisStep = {
                            isStepCompletedOverall: stepData.completed,
                            isMainStepActive: isThisMainStepActive,
                            activeSubstepIdWithinThisStep: isThisMainStepActive ? currentActiveSubstepId : null,
                        };
                        
                        const currentTheme = THEMES[stepConfig.themeKey || defaultThemeKey] || THEMES.add;

                        return (
                            <StepDisplay
                                key={stepConfig.stepKey || mainIndex} // stepKey should be unique
                                stepNumber={mainIndex + 1}
                                title={stepConfig.title}
                                substeps={stepConfig.substeps}
                                isExpanded={!!expandedState[stepConfig.stepKey]} // Ensure boolean
                                onToggleExpansion={() => toggleExpansion(stepConfig.stepKey)}
                                currentProcessingInfo={processingInfoForThisStep}
                                completedSubstepsTracker={stepData.completedSubsteps}
                                themeColors={currentTheme}
                            />
                        );
                    })}
                </AnimatePresence>
            </div>
        </div>
    );
};

TransactionSteps.propTypes = {
    stepsConfig: PropTypes.arrayOf(PropTypes.shape({
        title: PropTypes.string.isRequired,
        stepKey: PropTypes.string.isRequired, // Unique key for each main step
        themeKey: PropTypes.string, // Optional theme key for this specific step
        substeps: PropTypes.arrayOf(PropTypes.shape({
            id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
            text: PropTypes.string.isRequired,
        })).isRequired,
    })).isRequired,
    currentGlobalProcessingStepKey: PropTypes.string, // The stepKey of the currently processing main step
    currentActiveSubstepId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), // The id of the active substep within that main step
    completedStepsData: PropTypes.objectOf(PropTypes.shape({ // Tracks completion status for each stepKey
        completed: PropTypes.bool.isRequired, // Is the main step fully completed
        completedSubsteps: PropTypes.instanceOf(Set).isRequired, // Set of completed substep ids for this main step
    })).isRequired,
    defaultThemeKey: PropTypes.string, // Default theme if a stepConfig doesn't specify one
    maxHeight: PropTypes.string,
    className: PropTypes.string,
};

// #endregion

export default TransactionSteps;