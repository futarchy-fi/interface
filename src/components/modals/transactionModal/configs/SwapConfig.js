import { stepsActions } from '../components/stepsActions';
import { baseActionButtonProps } from './baseActionButtonProps';
import stepsConfig from '../components/stepsConfig';

// Default to 'Buy' 'YES' for now as per requirements
const DEFAULT_TRANSACTION_TYPE = 'Buy';
const DEFAULT_OUTCOME = 'YES'; // 'YES' means 'Event Will Occur'

export const SwapConfig = {
  getTitle: (transactionType = DEFAULT_TRANSACTION_TYPE, outcome = DEFAULT_OUTCOME) => {
    // Simplified for now, can be expanded for Sell, NO, Redeem etc.
    if (transactionType === 'Buy') {
      return outcome === 'YES' ? 'Confirm Buy YES Token' : 'Confirm Buy NO Token';
    }
    // Add other types like 'Sell', 'Redeem' later
    return 'Confirm Transaction';
  },

  getStepsConfig: (transactionType = DEFAULT_TRANSACTION_TYPE, outcome = DEFAULT_OUTCOME, swapMethod = 'cowswap') => {
    if (transactionType === 'Buy' && outcome === 'YES') {
      if (swapMethod === 'cowswap') {
        return stepsConfig.buyYesCowSwapSteps;
      } else if (swapMethod === 'algebra') {
        return stepsConfig.buyYesAlgebraSteps;
      }
    }
    // Fallback or throw error if config not found
    console.warn(`SwapConfig: No steps defined for ${transactionType} ${outcome} via ${swapMethod}. Returning CowSwap Buy YES as default.`);
    return stepsConfig.buyYesCowSwapSteps; 
  },

  // Maps an internal, more granular processing step name to what TransactionSteps component expects.
  // internalProcessingStep could be: 
  //  null (idle), 
  //  'collateral_approve_router', 'collateral_split_wrap', 
  //  'swap_approve_cow', 'swap_execute_cow', 
  //  'swap_approve_algebra', 'swap_execute_algebra',
  //  'completed'
  mapSwapProcessingStepToGlobalState: (internalProcessingStep, transactionType = DEFAULT_TRANSACTION_TYPE, outcome = DEFAULT_OUTCOME, swapMethod = 'cowswap') => {
    const currentStepList = SwapConfig.getStepsConfig(transactionType, outcome, swapMethod);
    let currentGlobalProcessingStepKey = null;
    let currentActiveSubstepId = null;
    let isCompleted = internalProcessingStep === 'completed';

    if (internalProcessingStep && !isCompleted) {
      for (const mainStep of currentStepList) {
        for (const subStep of mainStep.substeps) {
          if (subStep.id === internalProcessingStep) {
            currentGlobalProcessingStepKey = mainStep.stepKey;
            currentActiveSubstepId = subStep.id;
            break;
          }
        }
        if (currentGlobalProcessingStepKey) break;
      }
    } else if (isCompleted && currentStepList.length > 0) {
      // If completed, mark the last main step as the "current" for display purposes, and its last substep.
      const lastMainStep = currentStepList[currentStepList.length - 1];
      currentGlobalProcessingStepKey = lastMainStep.stepKey;
      if (lastMainStep.substeps.length > 0) {
        currentActiveSubstepId = lastMainStep.substeps[lastMainStep.substeps.length - 1].id;
      }
    }

    return {
      currentGlobalProcessingStepKey,
      currentActiveSubstepId,
      isCompleted,
    };
  },

  getActionButtonProps: ({
    transactionType = DEFAULT_TRANSACTION_TYPE, // 'Buy', 'Sell', 'Redeem'
    // outcome = DEFAULT_OUTCOME, // 'YES', 'NO' - not directly used in button text logic here yet
    // swapMethod = 'cowswap', // 'cowswap', 'algebra' - not directly used yet
    localProcessingStep, // The internal granular step name
    isAmountValid, // boolean: is the input amount valid
    onCloseModal, // function
    onPrimaryActionSubmit, // function
    requiresCollateral, // boolean: does this swap operation need collateral addition first?
  }) => {
    const { isCompleted } = SwapConfig.mapSwapProcessingStepToGlobalState(localProcessingStep, transactionType);

    if (isCompleted) {
      return {
        text: "Transaction Finished",
        onClick: onCloseModal,
        disabled: false,
        theme: "success", // Assuming ActionButton can take a theme prop
      };
    }

    if (localProcessingStep) { // Any step means it's processing
      return {
        text: "Processing...",
        disabled: true,
        showSpinner: true,
      };
    }

    // Default state: ready to submit
    const buttonText = requiresCollateral ? `Add Collateral & ${transactionType}` : `Confirm ${transactionType}`;
    return {
      text: buttonText,
      onClick: onPrimaryActionSubmit,
      disabled: !isAmountValid,
    };
  },
}; 