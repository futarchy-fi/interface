import { useState, useCallback, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useSwap } from './useSwap';
import { useBalances } from './useBalances';
import { useCollateral } from './useCollateral';
import { ConditionalTokenHandler } from '../strategies/ConditionalTokenHandler';
import { ethers } from 'ethers';

// Step definitions following ConfirmSwapModal pattern
const STEPS_DATA = {
  1: {
    title: 'Adding Collateral',
    substeps: [
      { id: 1, text: 'Approving base token for collateral splitting', completed: false },
      { id: 2, text: 'Split wrapping position tokens', completed: false }
    ]
  },
  2: {
    title: 'Processing Swap',
    substeps: [
      { id: 1, text: 'Approving token for swap strategy', completed: false },
      { id: 2, text: 'Executing swap transaction', completed: false }
    ]
  }
};

/**
 * Smart Swap Hook - Chain of Responsibility pattern with Step Tracking
 * Automatically handles conditional token requirements with collateral splitting
 * 
 * Flow: Analyze Token → Check Collateral → Split if Needed → Execute Swap
 */
export function useSmartSwap(defaultConfig = {}) {
  const { address: userAddress, isConnected } = useAccount();
  
  // Base hooks
  const swapHook = useSwap(defaultConfig);
  const balancesHook = useBalances();
  const collateralHook = useCollateral();

  // Smart swap state
  const [tokenAnalysis, setTokenAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [autoSplitEnabled, setAutoSplitEnabled] = useState(true);
  const [executionPlan, setExecutionPlan] = useState(null);
  const [currentAction, setCurrentAction] = useState(null);
  const [currentSwapParams, setCurrentSwapParams] = useState({ tokenIn: null, amount: null });

  // Step tracking state (following ConfirmSwapModal pattern)
  const [processingStep, setProcessingStep] = useState(null);
  const [currentSubstep, setCurrentSubstep] = useState({ step: 1, substep: 1 });
  const [completedSubsteps, setCompletedSubsteps] = useState({
    1: { completed: false, substeps: {} },
    2: { completed: false, substeps: {} }
  });
  const [expandedSteps, setExpandedSteps] = useState({});
  const [stepError, setStepError] = useState(null);

  // Approval tracking state
  const [approvalStatus, setApprovalStatus] = useState({});
  const [approvalLoading, setApprovalLoading] = useState(false);

  // Refs
  const conditionalHandlerRef = useRef(null);
  const swapHookRef = useRef(null);

  // Helper to get current swap parameters
  const getCurrentSwapParams = useCallback(() => {
    return currentSwapParams;
  }, [currentSwapParams]);

  // Store swapHook in ref for stable access
  useEffect(() => {
    swapHookRef.current = swapHook;
  }, [swapHook]);

  // Initialize conditional token handler
  useEffect(() => {
    if (balancesHook && collateralHook && userAddress) {
      conditionalHandlerRef.current = new ConditionalTokenHandler(
        balancesHook,
        collateralHook
      );

      // Set up callbacks for the handler
      conditionalHandlerRef.current.setCallbacks({
        onActionStart: (action) => {
          setCurrentAction(action);
          console.log('ConditionalTokenHandler: Starting action:', action);
        },
        onActionProgress: (message) => {
          setCurrentAction(prev => ({ 
            ...prev, 
            progress: message,
            description: message 
          }));
          console.log('ConditionalTokenHandler: Progress:', message);
        },
        onActionComplete: (action) => {
          console.log('ConditionalTokenHandler: Action completed:', action);
          setCurrentAction(prev => ({ 
            ...prev, 
            progress: 'Completed successfully',
            description: 'Action completed successfully'
          }));
          
          // Small delay before clearing action to show completion
          setTimeout(() => {
            setCurrentAction(null);
          }, 1000);
          
          // Refresh balances after split
          balancesHook.refreshBalances();
          
          // Refresh approval status after collateral actions complete
          setTimeout(() => {
            const currentParams = getCurrentSwapParams();
            if (currentParams.tokenIn && currentParams.amount) {
              console.log('Refreshing approval status after collateral action...');
              checkApprovalStatus(currentParams.tokenIn, currentParams.amount, true);
            }
          }, 2000);
        },
        onActionError: (error, action) => {
          console.error('ConditionalTokenHandler: Action failed:', error, action);
          setCurrentAction(null);
          setStepError(error.message);
        }
      });
    }
  }, [balancesHook, collateralHook, userAddress]);

  // Set up swap hook callbacks when swapHook is available (only once)
  useEffect(() => {
    const currentSwapHook = swapHookRef.current;
    if (currentSwapHook?.setSwapCallbacks) {
      console.log('Setting up swap callbacks for approval completion (one time)...');
      currentSwapHook.setSwapCallbacks({
        onApprovalComplete: (strategyName, tokenIn, txHash) => {
          console.log('🔄 useSmartSwap: Approval completed callback triggered!', { 
            strategyName, 
            tokenIn, 
            txHash 
          });
          
          setTimeout(() => {
            const currentParams = getCurrentSwapParams();
            if (currentParams.tokenIn && currentParams.amount) {
              console.log('✅ Calling checkApprovalStatus to refresh...');
              checkApprovalStatus(currentParams.tokenIn, currentParams.amount, true);
            }
          }, 2000);
        },
        onApprovalStart: (strategyName, tokenIn) => {
          console.log('🚀 useSmartSwap: Approval started callback triggered!', { 
            strategyName, 
            tokenIn 
          });
        }
      });
    }
  }, [swapHookRef.current?.setSwapCallbacks]); // Only when the setSwapCallbacks function becomes available

  // Helper function to mark substep completed
  const markSubstepCompleted = useCallback((step, substepId) => {
    setCompletedSubsteps(prev => {
      const ensuredPrev = {
        ...prev,
        [step]: prev[step] || { completed: false, substeps: {} }
      };

      return {
        ...ensuredPrev,
        [step]: {
          ...ensuredPrev[step],
          substeps: {
            ...ensuredPrev[step].substeps,
            [substepId]: true
          }
        }
      };
    });
  }, []);

  // Helper function to advance to next substep
  const advanceSubstep = useCallback((nextStep, nextSubstep) => {
    setCurrentSubstep({ step: nextStep, substep: nextSubstep });
  }, []);

  // Check approval status for strategies
  const checkApprovalStatus = useCallback(async (tokenIn, amount, forceRefresh = false) => {
    if (!tokenIn || !amount || !userAddress) {
      console.log('⚠️ checkApprovalStatus: Missing required params', { tokenIn, amount, userAddress });
      return;
    }

    // Early return if already loading to prevent multiple concurrent calls (unless forced)
    if (approvalLoading && !forceRefresh) {
      console.log('⏳ Approval check already in progress, skipping...');
      return;
    }

    console.log('🔍 Starting approval status check...', { tokenIn, amount, forceRefresh });
    setApprovalLoading(true);
    
    try {
      const amountBN = ethers.utils.parseUnits(amount, 18);
      const currentSwapHook = swapHookRef.current;
      
      if (!currentSwapHook) {
        console.log('❌ swapHook not available');
        return;
      }
      
      const strategies = currentSwapHook.getAvailableStrategies();
      const status = {};

      console.log('📋 Checking approval for strategies:', strategies);

      for (const strategy of strategies) {
        try {
          console.log(`🔍 Checking approval for strategy: ${strategy}`);
          
          // Get the approval status - checkApprovalNeeded returns true if approval IS needed
          const needsApproval = await currentSwapHook.checkApprovalNeeded({
            tokenIn,
            amount: amountBN,
            strategyType: strategy,
            userAddress
          });
          
          // Status should be true if approved (i.e., approval is NOT needed)
          status[strategy] = !needsApproval;
          
          console.log(`✅ Approval status for ${strategy}:`, {
            needsApproval,
            isApproved: !needsApproval,
            strategy
          });
        } catch (error) {
          console.error(`❌ Error checking approval for ${strategy}:`, error);
          status[strategy] = false;
        }
      }

      console.log('📊 Final approval status update:', status);
      setApprovalStatus(status);
    } catch (error) {
      console.error('❌ Error in checkApprovalStatus:', error);
    } finally {
      setApprovalLoading(false);
      console.log('✅ Approval status check completed');
    }
  }, [userAddress, approvalLoading]); // Removed swapHook dependency

  // Analyze token requirements when parameters change
  const analyzeToken = useCallback(async (tokenIn, amount) => {
    if (!tokenIn || !amount || !userAddress || !conditionalHandlerRef.current) {
      setTokenAnalysis(null);
      return null;
    }

    // Early return if already processing to prevent multiple concurrent calls
    if (analysisLoading) {
      console.log('Analysis already in progress, skipping...');
      return null;
    }

    try {
      setAnalysisLoading(true);
      console.log('Starting token analysis for:', { tokenIn, amount });
      
      const analysis = await conditionalHandlerRef.current.getTokenAnalysis(
        tokenIn,
        ethers.utils.parseUnits(amount, 18),
        userAddress
      );

      setTokenAnalysis(analysis);
      
      // NOTE: Removed automatic approval checking here - only check when user commits to action
      
      console.log('Token analysis completed successfully');
      return analysis;
    } catch (error) {
      console.error('Token analysis failed:', error);
      setTokenAnalysis({ error: error.message });
      return null;
    } finally {
      setAnalysisLoading(false);
    }
  }, [userAddress, analysisLoading]);

  // Create execution plan with steps and substeps
  const createExecutionPlan = useCallback((tokenIn, tokenOut, amount, analysis) => {
    const plan = {
      steps: [],
      totalSteps: 2, // Always 2 main steps
      stepsData: STEPS_DATA,
      estimatedTime: analysis?.estimatedTime || '1-2 minutes',
      gasEstimate: analysis?.gasEstimate || { estimated: '~0.007 xDAI' }
    };

    // Step 1: Handle conditional token requirements (collateral)
    const needsCollateral = analysis?.actions?.length > 0 && analysis?.canAutoSplit;
    plan.steps.push({
      stepNumber: 1,
      type: 'COLLATERAL',
      title: STEPS_DATA[1].title,
      substeps: STEPS_DATA[1].substeps,
      required: needsCollateral,
      description: needsCollateral 
        ? `Add ${analysis.splitAmount} collateral to create missing tokens`
        : 'Sufficient tokens available - skipping collateral step'
    });

    // Step 2: Execute swap
    plan.steps.push({
      stepNumber: 2,
      type: 'SWAP',
      title: STEPS_DATA[2].title,
      substeps: STEPS_DATA[2].substeps.map(sub => ({
        ...sub,
        text: sub.text.replace('swap strategy', swapHook.selectedStrategy)
      })),
      required: true,
      description: `Execute swap via ${swapHook.selectedStrategy} strategy`
    });

    return plan;
  }, [swapHook.selectedStrategy]);

  // Execute collateral step (Step 1)
  const executeCollateralStep = useCallback(async (analysis, params) => {
    console.log('Starting Step 1: Collateral Management');
    setProcessingStep(1);
    setCurrentSubstep({ step: 1, substep: 1 });
    
    // Auto-expand step 1 to show details
    setExpandedSteps(prev => ({ ...prev, 1: true }));

    try {
      // Check if collateral action is needed
      if (!analysis.canAutoSplit || !autoSplitEnabled) {
        // Skip collateral step
        console.log('Skipping collateral step - not needed');
        markSubstepCompleted(1, 1);
        markSubstepCompleted(1, 2);
        setCompletedSubsteps(prev => ({
          ...prev,
          1: { ...prev[1], completed: true }
        }));
        
        // Auto-collapse step 1 when completed
        setTimeout(() => {
          setExpandedSteps(prev => ({ ...prev, 1: false }));
        }, 2000);
        
        return true;
      }

      const executableActions = analysis.actions.filter(a => a.executable);
      
      if (executableActions.length === 0) {
        console.log('No executable collateral actions found');
        markSubstepCompleted(1, 1);
        markSubstepCompleted(1, 2);
        setCompletedSubsteps(prev => ({
          ...prev,
          1: { ...prev[1], completed: true }
        }));
        
        // Auto-collapse step 1 when completed
        setTimeout(() => {
          setExpandedSteps(prev => ({ ...prev, 1: false }));
        }, 2000);
        
        return true;
      }

      // Substep 1: Approving base token for collateral splitting
      setCurrentAction({ 
        type: 'APPROVAL', 
        description: 'Checking and approving base token for collateral splitting...' 
      });

      console.log('Step 1.1: Starting approval phase');
      markSubstepCompleted(1, 1);
      advanceSubstep(1, 2);

      // Substep 2: Execute collateral splitting
      setCurrentAction({ 
        type: 'SPLIT', 
        description: 'Splitting collateral to create conditional tokens...' 
      });

      console.log('Step 1.2: Starting collateral split');

      // Execute each collateral action with timeout
      for (const action of executableActions) {
        console.log('Executing collateral action:', action.type);
        
        // Add timeout promise to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Collateral split timeout after 60 seconds')), 60000);
        });

        const actionPromise = conditionalHandlerRef.current.executeAction(action, params);
        
        // Race between action execution and timeout
        const result = await Promise.race([actionPromise, timeoutPromise]);
        
        if (!result || !result.success) {
          throw new Error('Collateral action failed - no success result');
        }

        console.log('Collateral action completed successfully:', result);
      }

      // Mark substep 2 as completed
      markSubstepCompleted(1, 2);
      
      // Mark step 1 as completed
      setCompletedSubsteps(prev => ({
        ...prev,
        1: { ...prev[1], completed: true }
      }));

      setCurrentAction(null);
      console.log('Step 1 completed successfully');
      
      // Auto-collapse step 1 when completed and expand step 2
      setTimeout(() => {
        setExpandedSteps(prev => ({ ...prev, 1: false, 2: true }));
      }, 2000);
      
      return true;

    } catch (error) {
      console.error('Step 1 failed:', error);
      setStepError(`Collateral step failed: ${error.message}`);
      setCurrentAction(null);
      return false;
    }
  }, [autoSplitEnabled, markSubstepCompleted, advanceSubstep]);

  // Execute swap step (Step 2)
  const executeSwapStep = useCallback(async (params) => {
    console.log('Starting Step 2: Swap Execution');
    setProcessingStep(2);
    setCurrentSubstep({ step: 2, substep: 1 });
    
    // Auto-expand step 2 to show details
    setExpandedSteps(prev => ({ ...prev, 2: true }));

    try {
      const currentSwapHook = swapHookRef.current;
      if (!currentSwapHook) {
        throw new Error('Swap hook not available');
      }

      // Substep 1: Handle approval for swap
      setCurrentAction({ 
        type: 'APPROVAL', 
        description: `Approving token for ${currentSwapHook.selectedStrategy} swap...` 
      });

      // Note: The approval is handled internally by the swap strategies
      markSubstepCompleted(2, 1);
      advanceSubstep(2, 2);

      // Substep 2: Execute swap
      setCurrentAction({ 
        type: 'SWAP', 
        description: `Executing swap via ${currentSwapHook.selectedStrategy}...` 
      });

      const swapResult = await currentSwapHook.executeSwap({
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amount: ethers.utils.parseUnits(params.amount, 18)
      });

      markSubstepCompleted(2, 2);
      
      // Mark step 2 as completed
      setCompletedSubsteps(prev => ({
        ...prev,
        2: { ...prev[2], completed: true }
      }));

      setCurrentAction(null);
      setProcessingStep('completed');
      console.log('Step 2 completed successfully');
      
      // Auto-collapse step 2 when completed
      setTimeout(() => {
        setExpandedSteps(prev => ({ ...prev, 2: false }));
      }, 3000); // Keep it open a bit longer for final result
      
      return swapResult;

    } catch (error) {
      console.error('Step 2 failed:', error);
      setStepError(`Swap step failed: ${error.message}`);
      throw error;
    }
  }, [markSubstepCompleted, advanceSubstep]); // Removed swapHook dependency

  // Execute smart swap with step tracking
  const executeSmartSwap = useCallback(async (params) => {
    const { tokenIn, tokenOut, amount } = params;

    try {
      // Track current swap parameters for later use
      setCurrentSwapParams({ tokenIn, amount });
      
      // Reset state
      setStepError(null);
      setCurrentAction(null);
      setProcessingStep(null);
      setCurrentSubstep({ step: 1, substep: 1 });
      setCompletedSubsteps({
        1: { completed: false, substeps: {} },
        2: { completed: false, substeps: {} }
      });
      // Reset expanded steps - they will auto-expand as steps execute
      setExpandedSteps({});

      // Step 1: Analyze token requirements (fast, cached data only)
      const analysis = await analyzeToken(tokenIn, amount);
      if (!analysis) {
        throw new Error('Failed to analyze token requirements');
      }

      // Step 2: Create execution plan
      const plan = createExecutionPlan(tokenIn, tokenOut, amount, analysis);
      setExecutionPlan(plan);

      // Step 3: NOW check approvals since user committed to the swap
      console.log('User committed to swap, checking approvals now...');
      await checkApprovalStatus(tokenIn, amount);

      // Step 4: Execute collateral step if needed
      const collateralSuccess = await executeCollateralStep(analysis, params);
      if (!collateralSuccess) {
        throw new Error('Collateral step failed');
      }

      // Wait a bit for balances to update after collateral
      if (analysis.canAutoSplit && autoSplitEnabled) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Step 5: Execute swap step
      const swapResult = await executeSwapStep(params);

      return swapResult;

    } catch (error) {
      console.error('Smart swap execution failed:', error);
      setCurrentAction(null);
      setStepError(error.message);
      throw error;
    }
  }, [analyzeToken, createExecutionPlan, executeCollateralStep, executeSwapStep, autoSplitEnabled, checkApprovalStatus]);

  // Manual action execution (for user-triggered splits)
  const executeAction = useCallback(async (action, params) => {
    if (!conditionalHandlerRef.current) return false;

    try {
      // Check approvals before executing manual action
      console.log('User triggered manual action, checking approvals...');
      await checkApprovalStatus(params.tokenIn, params.amount);

      await conditionalHandlerRef.current.executeAction(action, params);
      
      // Refresh analysis after action
      if (params.tokenIn && params.amount) {
        setTimeout(() => {
          analyzeToken(params.tokenIn, params.amount);
        }, 2000); // Wait for blockchain update
      }
      
      return true;
    } catch (error) {
      console.error('Manual action execution failed:', error);
      return false;
    }
  }, [analyzeToken, checkApprovalStatus]);

  // Get suggestions for user
  const getSuggestions = useCallback((tokenIn, amount) => {
    if (!tokenAnalysis) return [];

    const suggestions = [];

    if (tokenAnalysis.canAutoSplit && autoSplitEnabled) {
      suggestions.push({
        type: 'AUTO_SPLIT',
        title: '🔄 Auto-Split Enabled',
        description: 'Missing tokens will be automatically created from collateral',
        action: 'This will happen automatically when you swap'
      });
    }

    if (tokenAnalysis.canAutoSplit && !autoSplitEnabled) {
      suggestions.push({
        type: 'MANUAL_SPLIT',
        title: '💡 Manual Split Available',
        description: `Split ${tokenAnalysis.splitAmount} collateral to get missing tokens`,
        action: 'Click to split collateral manually',
        executable: true
      });
    }

    if (!tokenAnalysis.sufficient && !tokenAnalysis.canAutoSplit) {
      suggestions.push({
        type: 'INSUFFICIENT_FUNDS',
        title: '❌ Insufficient Funds',
        description: `Need ${tokenAnalysis.shortage} more tokens`,
        action: `Acquire more ${tokenAnalysis.tokenType.underlyingToken?.symbol || 'collateral'} first`
      });
    }

    return suggestions;
  }, [tokenAnalysis, autoSplitEnabled]);

  // Toggle step expansion
  const toggleStepExpansion = useCallback((step) => {
    setExpandedSteps(prev => ({
      ...prev,
      [step]: !prev[step]
    }));
  }, []);

  // Reset all smart swap state
  const resetSmartSwap = useCallback(() => {
    setTokenAnalysis(null);
    setExecutionPlan(null);
    setCurrentAction(null);
    setProcessingStep(null);
    setCurrentSubstep({ step: 1, substep: 1 });
    setCompletedSubsteps({
      1: { completed: false, substeps: {} },
      2: { completed: false, substeps: {} }
    });
    setExpandedSteps({});
    setStepError(null);
    setApprovalStatus({});
    
    const currentSwapHook = swapHookRef.current;
    if (currentSwapHook?.reset) {
      currentSwapHook.reset();
    }
  }, []); // Removed swapHook dependency

  return {
    // Existing swap functionality - get from current ref with defaults
    ...(swapHookRef.current || {}),

    // Override with safe defaults for critical properties
    quotes: swapHookRef.current?.quotes || {},
    loading: swapHookRef.current?.loading || false,
    error: swapHookRef.current?.error || null,
    result: swapHookRef.current?.result || null,
    selectedStrategy: swapHookRef.current?.selectedStrategy || 'algebra',

    // Safe default functions
    getAvailableStrategies: swapHookRef.current?.getAvailableStrategies || (() => ['algebra', 'cowswap']),
    getStrategyInfo: swapHookRef.current?.getStrategyInfo || (() => null),
    setSelectedStrategy: swapHookRef.current?.setSelectedStrategy || (() => {}),
    executeSwap: swapHookRef.current?.executeSwap || (() => Promise.reject(new Error('Swap not initialized'))),
    checkApprovalNeeded: swapHookRef.current?.checkApprovalNeeded || (() => Promise.resolve(false)),
    getMultipleQuotes: swapHookRef.current?.getMultipleQuotes || (() => Promise.resolve({})),
    reset: swapHookRef.current?.reset || (() => {}),

    // Smart swap state
    tokenAnalysis,
    analysisLoading,
    autoSplitEnabled,
    executionPlan,
    currentAction,

    // Step tracking state
    processingStep,
    currentSubstep,
    completedSubsteps,
    expandedSteps,
    stepError,

    // Approval tracking
    approvalStatus,
    approvalLoading,

    // Smart swap actions
    executeSmartSwap,
    executeAction,
    analyzeToken,
    getSuggestions,
    resetSmartSwap,
    toggleStepExpansion,
    checkApprovalStatus,
    refreshApprovalStatus: (tokenIn, amount) => checkApprovalStatus(tokenIn, amount, true),
    manualRefreshApproval: () => {
      const params = getCurrentSwapParams();
      if (params.tokenIn && params.amount) {
        console.log('🔄 Manual approval refresh triggered');
        checkApprovalStatus(params.tokenIn, params.amount, true);
      } else {
        console.log('❌ No current swap params for manual refresh');
      }
    },

    // Settings
    setAutoSplitEnabled,

    // Computed properties
    canExecuteSmartSwap: tokenAnalysis?.sufficient || (tokenAnalysis?.canAutoSplit && autoSplitEnabled),
    requiresManualAction: tokenAnalysis?.actions?.some(a => a.executable) && !autoSplitEnabled,
    
    // Helper methods
    isConditionalToken: (tokenAddress) => {
      if (!conditionalHandlerRef.current) return false;
      const tokenType = conditionalHandlerRef.current.identifyTokenType(tokenAddress);
      return tokenType.isConditional;
    },

    // Step data for UI
    stepsData: STEPS_DATA
  };
} 