import {
  approveTokenAction,
  mintPositionTokensAction,
  mergePositionsAction,
  approveBaseTokenForRouterAction,
  splitWrapPositionAction,
  approveTokenForSwapAction,
  executeSwapAction,
} from './stepsActions';

const stepsConfig = {
  addCollateralSteps: [
    {
      title: "Futarchy Split Wrap",
      stepKey: "addCollateralMain",
      themeKey: "add",
      substeps: [
        {
          id: 1,
          text: "Approving token for Futarchy Split Wrap",
          action: approveTokenAction, // Associated action
          actionParams: { tokenName: "SDAI", for: "Futarchy Split Wrap" } // Example params
        },
        {
          id: 2,
          text: "Minting position tokens",
          action: mintPositionTokensAction,
          actionParams: { positionType: "YES/NO Pair" }
        }
      ]
    }
  ],
  removeCollateralSteps: [
    {
      title: "Removing Collateral",
      stepKey: "removeCollateralMain",
      themeKey: "remove",
      substeps: [
        {
          id: 1,
          text: "Approving YES token for Router",
          action: approveTokenAction,
          actionParams: { tokenName: "YES Token", for: "Router" }
        },
        {
          id: 2,
          text: "Approving NO token for Router",
          action: approveTokenAction,
          actionParams: { tokenName: "NO Token", for: "Router" }
        },
        {
          id: 3,
          text: "Merging Positions",
          action: mergePositionsAction,
          actionParams: {}
        }
      ]
    }
  ],
  buyYesCowSwapSteps: [
    {
      title: "Collateral (for Buy YES)",
      stepKey: "buyYesCollateralCowSwap",
      themeKey: "add",
      substeps: [
        {
          id: "collateral_approve_router",
          text: "Approving base token for Futarchy Router",
          action: approveBaseTokenForRouterAction,
          actionParams: { baseTokenSymbol: "SDAI", routerName: "Futarchy Router" }
        },
        {
          id: "collateral_split_wrap",
          text: "Splitting position (SDAI to YES/NO)",
          action: splitWrapPositionAction,
          actionParams: { marketIdentifier: "MarketXYZ" }
        }
      ]
    },
    {
      title: "Swap Execution (Buy YES via CoW Swap)",
      stepKey: "buyYesExecuteCowSwap",
      themeKey: "buy",
      substeps: [
        {
          id: "swap_approve_cow",
          text: "Approving NO token for CoW Swap",
          action: approveTokenForSwapAction,
          actionParams: { tokenToApproveSymbol: "NO Token", spenderName: "CoW Protocol Relayer" }
        },
        {
          id: "swap_execute_cow",
          text: "Executing Swap (NO for YES) via CoW Swap",
          action: executeSwapAction,
          actionParams: { swapMethod: "cowswap", selling: "NO Token", toReceive: "YES Token" }
        }
      ]
    }
  ],
  buyYesAlgebraSteps: [
    {
      title: "Collateral (for Buy YES)",
      stepKey: "buyYesCollateralAlgebra",
      themeKey: "add",
      substeps: [
        {
          id: "collateral_approve_router_algebra",
          text: "Approving base token for Futarchy Router",
          action: approveBaseTokenForRouterAction,
          actionParams: { baseTokenSymbol: "SDAI", routerName: "Futarchy Router" }
        },
        {
          id: "collateral_split_wrap_algebra",
          text: "Splitting position (SDAI to YES/NO)",
          action: splitWrapPositionAction,
          actionParams: { marketIdentifier: "MarketXYZ" }
        }
      ]
    },
    {
      title: "Swap Execution (Buy YES via Algebra)",
      stepKey: "buyYesExecuteAlgebra",
      themeKey: "buy",
      substeps: [
        {
          id: "swap_approve_algebra",
          text: "Approving NO token for Algebra (Swapr) Router",
          action: approveTokenForSwapAction,
          actionParams: { tokenToApproveSymbol: "NO Token", spenderName: "Algebra Router" }
        },
        {
          id: "swap_execute_algebra",
          text: "Executing Swap (NO for YES) via Algebra (Swapr)",
          action: executeSwapAction,
          actionParams: { swapMethod: "algebra", selling: "NO Token", toReceive: "YES Token" }
        }
      ]
    }
  ],
  // You can add more step configurations here, e.g., for different swap types
  // swapCowSwapSteps: [ ... ],
  // swapAlgebraSteps: [ ... ],
};

export default stepsConfig; 