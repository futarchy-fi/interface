import { stepsActions } from "../components/stepsActions";
import { baseActionButtonProps } from "./baseActionButtonProps";

const mapProcessingStepToGlobalState = (
  processingStep,
  transactionType,
  outcome
) => {
  if (processingStep === "completed") {
    return { currentGlobalProcessingStepKey: null, currentActiveSubstepId: null, isCompleted: true };
  }
  if (!processingStep) {
    return { currentGlobalProcessingStepKey: null, currentActiveSubstepId: null, isCompleted: false };
  }

  // Define the mapping from internal processing step to the main step and substep
  const stepMappings = {
    redeem_approve: { mainStep: "approval", substep: "redeem_approve" },
    redeem_final: { mainStep: "redeem", substep: "redeem_final" },
  };

  const mapping = stepMappings[processingStep];

  if (mapping) {
    return {
      currentGlobalProcessingStepKey: mapping.mainStep,
      currentActiveSubstepId: mapping.substep,
      isCompleted: false,
    };
  }

  return { currentGlobalProcessingStepKey: null, currentActiveSubstepId: null, isCompleted: false };
};

export const RedeemConfig = {
  getTitle: (transactionType, outcome) => `Redeem Tokens`,

  getStepsConfig: (transactionType, outcome, swapMethod) => {
    return [
      {
        stepKey: "approval",
        title: "Approval",
        substeps: [
          {
            id: "redeem_approve",
            text: "Approve Router",
            action: stepsActions.approve,
            actionParams: { spender: "ROUTER" },
          },
        ],
      },
      {
        stepKey: "redeem",
        title: "Redeem",
        substeps: [
          {
            id: "redeem_final",
            text: "Redeem your tokens",
            action: stepsActions.redeem,
          },
        ],
      },
    ];
  },

  getActionButtonProps: ({
    onPrimaryActionSubmit,
    onCloseModal,
    localProcessingStep,
    isAmountValid,
  }) => {
    if (localProcessingStep === "completed") {
      return {
        ...baseActionButtonProps.completed,
        onClick: onCloseModal,
        text: baseActionButtonProps.completed.children,
      };
    }
    return {
      ...baseActionButtonProps.confirm,
      onClick: onPrimaryActionSubmit,
      text: "Confirm Redeem",
      disabled: !isAmountValid || !!localProcessingStep,
    };
  },

  mapProcessingStepToGlobalState
}; 