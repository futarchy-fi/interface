import allStepsConfigs from '../components/stepsConfig'; // Note .js is omitted

// These now reference the imported JS object
const ADD_COLLATERAL_STEPS_DEF = allStepsConfigs.addCollateralSteps;
const REMOVE_COLLATERAL_STEPS_DEF = allStepsConfigs.removeCollateralSteps;

export const CollateralConfig = {
    getTitle: (action) => action === "add" ? "Add Collateral" : "Remove Collateral",
    
    getStepsConfig: (action) => {
        return action === "add" ? ADD_COLLATERAL_STEPS_DEF : REMOVE_COLLATERAL_STEPS_DEF;
    },

    mapCollateralProcessingStepToGlobalState: (processingStep, action) => {
        if (action === "add") {
            switch (processingStep) {
                case "baseTokenApproval": return { currentGlobalProcessingStepKey: "addCollateralMain", currentActiveSubstepId: 1 };
                case "mint": return { currentGlobalProcessingStepKey: "addCollateralMain", currentActiveSubstepId: 2 };
                case "completed": return { currentGlobalProcessingStepKey: "addCollateralMain", currentActiveSubstepId: null, isCompleted: true };
                default: return { currentGlobalProcessingStepKey: null, currentActiveSubstepId: null };
            }
        } else if (action === "remove") {
            switch (processingStep) {
                case "yesApproval": return { currentGlobalProcessingStepKey: "removeCollateralMain", currentActiveSubstepId: 1 };
                case "noApproval": return { currentGlobalProcessingStepKey: "removeCollateralMain", currentActiveSubstepId: 2 };
                case "merge": return { currentGlobalProcessingStepKey: "removeCollateralMain", currentActiveSubstepId: 3 };
                case "completed": return { currentGlobalProcessingStepKey: "removeCollateralMain", currentActiveSubstepId: null, isCompleted: true };
                default: return { currentGlobalProcessingStepKey: null, currentActiveSubstepId: null };
            }
        }
        return { currentGlobalProcessingStepKey: null, currentActiveSubstepId: null };
    },

    getActionButtonProps: ({
        action, 
        localProcessingStep,
        isAmountValid, 
        onCloseModal, 
        onPrimaryActionSubmit,
    }) => {
        if (localProcessingStep === "completed") {
            return {
                text: "Transaction Complete - Close",
                onClick: onCloseModal,
                isCompleted: true,
            };
        } else if (localProcessingStep && localProcessingStep !== "completed") {
            return {
                textWhenLoading: "Transaction in Progress...",
                isLoading: true,
                disabled: true, 
            };
        } else { 
            return {
                text: action === "add" ? "Add Collateral" : "Remove Collateral",
                onClick: onPrimaryActionSubmit,
                disabled: !isAmountValid,
            };
        }
    },
}; 