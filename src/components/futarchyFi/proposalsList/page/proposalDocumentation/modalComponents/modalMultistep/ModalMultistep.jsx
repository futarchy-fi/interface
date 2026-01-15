import React, { useState, useEffect, useCallback } from 'react';
import { PlaceholderIcon, DescriptionIcon, DocumentationIcon, CreationIcon } from './Icons';
import ProposalDetailsManager from '../proposalDetails/ProposalDetailsManager';
import ProposalMarkdown from '../markdown/ProposalMarkdown';
import ProposalTokenCreator from '../proposalTokenCreator/ProposalTokenCreator';
import ProposalCreator from '../proposalCreator/ProposalCreator';

// Updated Placeholder Step Content Components
// const CreationStep = () => <div className="text-futarchyGray11 dark:text-futarchyGray112">Creation Content - Review and finalize your proposal.</div>; // No longer default

// Remove old step components if no longer needed or rename them if they are being repurposed for the new steps.
// For this example, PersonalInfoStep, EducationStep, WorkExperiencesStep, UserPhotoStep are effectively replaced by the new ones.

// Default steps now have isComplete set to false for the first step, and an empty data object
const defaultSteps = [
  { id: 'titleDesc', title: 'Title and Description', subtitle: 'Define your proposal\'s core details', IconComponent: DescriptionIcon, ContentComponent: ProposalDetailsManager, isComplete: false, data: null },
  { id: 'documentation', title: 'Documentation', subtitle: 'Provide supporting documents', IconComponent: DocumentationIcon, ContentComponent: ProposalMarkdown, isComplete: false, data: null },
  { 
    id: 'tokenCreation', 
    title: 'Configure Tokens', 
    subtitle: 'Set up the tokenomics for your proposal', 
    IconComponent: CreationIcon, // Can be changed later if a more specific icon is available
    ContentComponent: ProposalTokenCreator, 
    isComplete: false, // This step now requires input, so it starts as incomplete
    data: null 
  }
];

// Simple deep equality check for plain objects with primitive values (like our stepData)
const shallowCompare = (obj1, obj2) => {
  if (obj1 === obj2) return true;
  if (!obj1 || !obj2 || typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) return false;
  for (const key of keys1) {
    if (obj1[key] !== obj2[key]) return false;
  }
  return true;
};

// --- Placeholder Components for Milestone Steps ---
const MilestoneStepPlaceholderContent = ({ stepTitle, onCompletionChange, initialData, stepId }) => {
  const [customData, setCustomData] = useState(initialData || { info: '' });

  useEffect(() => {
    // Initialize with false, as completion requires action
    // If initialData implies completion, that should be handled by initialData structure if needed in future
    // For now, placeholders always start as incomplete.
    // onCompletionChange(false, customData); // Let initial setup in ModalMultistep handle initial onCompletionChange call via prepareSteps
  }, [onCompletionChange, customData]);

  const handleCompleteStep = () => {
    const finalData = { ...customData, completed: true, timestamp: new Date().toISOString() };
    setCustomData(finalData);
    onCompletionChange(true, finalData);
    console.log(`[${stepId}] marked as complete with data:`, finalData);
  };

  const handleInputChange = (e) => {
    setCustomData(prev => ({...prev, info: e.target.value}));
    // Mark as incomplete if user types, assuming they need to re-confirm completion
    onCompletionChange(false, {...customData, info: e.target.value}); 
  }

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-2 text-futarchyGray12 dark:text-futarchyGray3">{stepTitle}</h3>
      <p className="text-sm text-futarchyGray10 dark:text-futarchyGray112 mb-4">
        This is a placeholder for the {stepTitle.toLowerCase()}. Configuration and full functionality will be added later.
      </p>
      <textarea 
        value={customData.info}
        onChange={handleInputChange}
        placeholder="Enter some data for this milestone (optional)"
        className="w-full p-2 border rounded-md mb-4 bg-white dark:bg-futarchyDarkGray4 text-futarchyGray12 dark:text-futarchyGray3 placeholder-futarchyGray9 dark:placeholder-futarchyGray8 border-futarchyGray62 dark:border-futarchyDarkGray42"
      />
      <button
        onClick={handleCompleteStep}
        className="px-4 py-2 text-sm font-medium rounded-md text-white bg-futarchyViolet11 hover:bg-futarchyViolet11/80 dark:bg-futarchyViolet9 dark:hover:bg-futarchyViolet9/80 transition-colors"
      >
        Mark Step as Complete
      </button>
    </div>
  );
};

// --- Step Definitions ---
const PROPOSAL_STEPS = [
  { id: 'titleDesc', title: 'Title and Description', subtitle: 'Define your proposal\'s core details', IconComponent: DescriptionIcon, ContentComponent: ProposalDetailsManager, isComplete: false, data: null },
  { id: 'documentation', title: 'Documentation', subtitle: 'Provide supporting documents', IconComponent: DocumentationIcon, ContentComponent: ProposalMarkdown, isComplete: false, data: null },
  { id: 'tokenCreation', title: 'Configure Tokens', subtitle: 'Set up the tokenomics for your proposal', IconComponent: CreationIcon, ContentComponent: ProposalTokenCreator, isComplete: false, data: null }
];

const MILESTONE_STEPS = [
  {
    id: 'milestoneProposalCreation',
    title: 'Link Proposal / Create Sub-Proposal',
    subtitle: 'Connect this milestone to an existing proposal or define a new one',
    IconComponent: CreationIcon,
    ContentComponent: ProposalCreator,
    isComplete: false,
    data: null
  },
  {
    id: 'milestoneConfirmation',
    title: 'Milestone Confirmation',
    subtitle: 'Review and confirm milestone settings',
    IconComponent: PlaceholderIcon,
    ContentComponent: (props) => <MilestoneStepPlaceholderContent {...props} stepTitle="Milestone Confirmation" />,
    isComplete: false,
    data: null
  }
];

const EVENT_STEPS = []; // No steps for event config yet

// Function to get steps based on config
const getStepsForConfig = (config) => {
  switch (config) {
    case 'proposal':
      return PROPOSAL_STEPS;
    case 'milestone':
      return MILESTONE_STEPS;
    case 'event':
      return EVENT_STEPS;
    default:
      console.warn(`[ModalMultistep] Unknown config: "${config}". Defaulting to proposal steps.`);
      return PROPOSAL_STEPS;
  }
};

const ModalMultistep = ({ 
  steps: initialStepsProp = null, // Allow overriding via prop, but prioritize currentConfig
  initialStepId = null, 
  onCompleteAllSteps, 
  onStepChange, 
  onSetStepCompletion, // This is handleCompletionChangeForStep
  initialData = null, 
  currentConfig = 'milestone' // New prop
}) => {

  const activeStepsConfig = initialStepsProp || getStepsForConfig(currentConfig);

  const prepareSteps = useCallback((stepsToPrepare) => stepsToPrepare.map(step => {
    if (step.id === 'titleDesc' && currentConfig === 'proposal' && initialData !== undefined && initialData !== null) {
      // Only apply top-level initialData to the first step of 'proposal' config for now
      return { ...step, data: initialData };
    }
    // For other configs or steps, or if initialData is not for them, ensure data is initialized to null or its default
    return { ...step, data: step.data || null }; 
  }), [currentConfig, initialData]); // Dependencies for prepareSteps
  
  const [managedSteps, setManagedSteps] = useState(() => prepareSteps(activeStepsConfig));
  const [currentStepIndex, setCurrentStepIndex] = useState(() => {
    if (initialStepId) {
      const initialIndex = managedSteps.findIndex(step => step.id === initialStepId);
      return initialIndex !== -1 ? initialIndex : 0;
    }
    return 0;
  });

  const activeStep = managedSteps[currentStepIndex];

  useEffect(() => {
    const newPreparedSteps = prepareSteps(activeStepsConfig);
    // Only update if the structure or basic data of initialStepsProp has actually changed
    // This is a shallow comparison, if deeper changes are expected, a more robust check is needed
    if (!shallowCompare(newPreparedSteps.map(s => s.data), managedSteps.map(s => s.data))) {
      setManagedSteps(newPreparedSteps);
    }

    const currentActiveStepId = activeStep?.id;
    if (currentActiveStepId) {
      const newIdx = activeStepsConfig.findIndex(s => s.id === currentActiveStepId);
      if (newIdx === -1) {
        setCurrentStepIndex(initialStepId ? Math.max(0, activeStepsConfig.findIndex(s => s.id === initialStepId)) : 0);
      } else if (newIdx !== currentStepIndex) {
        setCurrentStepIndex(newIdx);
      }
    } else {
      setCurrentStepIndex(initialStepId ? Math.max(0, activeStepsConfig.findIndex(s => s.id === initialStepId)) : 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStepsProp, initialStepId, initialData, currentConfig]); // Added currentConfig

  const handleCompletionChangeForStep = useCallback((isComplete, stepData) => {
    let stepIdToNotify;
    setManagedSteps(prevSteps => {
      const newSteps = [...prevSteps];
      if (newSteps[currentStepIndex]) {
        const existingStep = newSteps[currentStepIndex];
        const newStepData = stepData !== undefined ? stepData : existingStep.data;

        if (existingStep.isComplete !== isComplete || !shallowCompare(existingStep.data, newStepData)) {
          newSteps[currentStepIndex] = {
            ...existingStep,
            isComplete,
            data: newStepData,
          };
          stepIdToNotify = newSteps[currentStepIndex]?.id; // Get ID from the current step being updated
          return newSteps; 
        }
      }
      stepIdToNotify = prevSteps[currentStepIndex]?.id; // If no change, still get ID for notification
      return prevSteps; 
    });

    if (onSetStepCompletion && stepIdToNotify) {
        onSetStepCompletion(stepIdToNotify, isComplete, stepData);
    }
  }, [currentStepIndex, onSetStepCompletion]); // setManagedSteps is stable by default

  const handleNext = () => {
    const currentStepConfig = managedSteps[currentStepIndex];

    // --- BEGIN CONSOLE LOG ---    
    console.log(
      `[ModalMultistep] Attempting to proceed from step: "${currentStepConfig.title}" (ID: ${currentStepConfig.id})`,
      "Data for this step:", 
      currentStepConfig.data
    );
    // --- END CONSOLE LOG ---

    if (currentStepConfig.isComplete === false) {
      console.warn(`Step "${currentStepConfig.title}" is not complete. Cannot proceed.`);
      // Potentially trigger validation within the content component if needed, or show a general message.
      // For now, ProposalDetailsManager handles its own visual validation feedback.
      return;
    }

    if (currentStepIndex < managedSteps.length - 1) {
      const nextStepIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextStepIndex);
      if (onStepChange) onStepChange(managedSteps[nextStepIndex], nextStepIndex);
    } else if (onCompleteAllSteps) {
      onCompleteAllSteps();
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      const prevStepIndex = currentStepIndex - 1;
      setCurrentStepIndex(prevStepIndex);
      if (onStepChange) onStepChange(managedSteps[prevStepIndex], prevStepIndex);
    }
  };

  const handleStepClick = (index) => {
    if (index === currentStepIndex) {
      return; 
    }

    if (index < currentStepIndex) { 
      setCurrentStepIndex(index);
      if (onStepChange) onStepChange(managedSteps[index], index);
      return;
    }

    let canNavigate = true;
    for (let i = currentStepIndex; i < index; i++) {
      if (managedSteps[i].isComplete === false) {
        canNavigate = false;
        console.warn(`Cannot navigate to step "${managedSteps[index].title}" because step "${managedSteps[i].title}" is not complete.`);
        break;
      }
    }

    if (canNavigate) {
      setCurrentStepIndex(index);
      if (onStepChange) onStepChange(managedSteps[index], index);
    }
  };

  const isLastStep = currentStepIndex === managedSteps.length - 1;

  // activeStep derived after managedSteps and currentStepIndex are updated
  const currentActiveStepForRender = managedSteps[currentStepIndex];
  const ContentComponent = currentActiveStepForRender?.ContentComponent;

  if (!currentActiveStepForRender) {
    // Handle case where currentActiveStepForRender might be undefined (e.g., steps array is empty)
    return <div>Loading steps...</div>; // Or some other placeholder/error UI
  }

  return (
    <div className="flex flex-col md:flex-row bg-white dark:bg-futarchyDarkGray3 rounded-xl overflow-hidden min-h-[60vh] max-h-[80vh]">
      {/* Left Sidebar - Steps Navigation */}
      {/* Increased width: md:w-2/5 lg:w-1/3. Updated border: md:border-r-2 border-futarchyGray62 dark:border-futarchyDarkGray42 */}
      <div className="w-full md:w-2/5 lg:w-1/3 p-6 border-b md:border-b-0 md:border-r-2 border-futarchyGray62 dark:border-futarchyDarkGray42 flex flex-col space-y-2 overflow-y-auto relative">
        {managedSteps.map((step, index) => {
          const isActive = index === currentStepIndex;
          const Icon = step.IconComponent || PlaceholderIcon;
          // Determine if the step button should appear clickable/enabled
          // A step is clickable if it's the current one, a previous one,
          // or a future one where all preceding steps are complete.
          let isButtonClickable = index <= currentStepIndex;
          if (!isButtonClickable && index > currentStepIndex) {
            let canReach = true;
            for (let i = currentStepIndex; i < index; i++) {
              if (managedSteps[i].isComplete === false) {
                canReach = false;
                break;
              }
            }
            if(canReach) isButtonClickable = true;
          }

          return (
            <button
              key={step.id}
              onClick={() => handleStepClick(index)}
              disabled={!isButtonClickable} // Disable button if not clickable by logic
              className={`flex items-center p-3 rounded-lg transition-colors duration-150 w-full text-left relative z-10
                ${isActive
                  ? 'bg-futarchyViolet11/20 dark:bg-futarchyViolet9/20 text-futarchyViolet11 dark:text-futarchyViolet9'
                  : 'hover:bg-futarchyGray3 dark:hover:bg-futarchyDarkGray4 text-futarchyGray11 dark:text-futarchyGray112'
                }
                ${!isButtonClickable ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {/* Added flex-shrink-0 to icon div */}
              <div className={`flex items-center justify-center w-10 h-10 rounded-full mr-3 flex-shrink-0
                ${isActive
                  ? 'bg-futarchyViolet11 text-white dark:bg-futarchyViolet9 dark:text-futarchyDarkGray1'
                  : (isButtonClickable ? 'bg-futarchyGray4 dark:bg-futarchyDarkGray5 text-futarchyGray10 dark:text-futarchyGray112' : 'bg-futarchyGray3 dark:bg-futarchyDarkGray4 text-futarchyGray9 dark:text-futarchyGray10')
                }
              `}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className={`font-medium ${isActive ? 'text-futarchyViolet11 dark:text-futarchyViolet9' : (isButtonClickable ? 'text-futarchyGray12 dark:text-futarchyGray3' : 'text-futarchyGray9 dark:text-futarchyGray10')}`}>
                  Step {index + 1}
                </p>
                <p className={`text-sm ${isActive ? 'text-futarchyViolet11 dark:text-futarchyViolet9' : (isButtonClickable ? 'text-futarchyGray10 dark:text-futarchyGray112' : 'text-futarchyGray9 dark:text-futarchyGray10')}`}>
                  {step.title}
                </p>
              </div>
              {/* Vertical line connector removed */}
            </button>
          );
        })}
      </div>

      {/* Right Content Area */}
      <div className="w-full md:w-3/5 lg:w-2/3 p-6 flex flex-col"> {/* Adjusted width to complement sidebar */}
        <div className="flex-grow mb-6 scrollbar-always">
          <h2 className="text-2xl font-semibold text-futarchyGray12 dark:text-futarchyGray3 mb-1">
            {currentActiveStepForRender.title}
          </h2>
          <p className="text-sm text-futarchyGray10 dark:text-futarchyGray112 mb-6">
            {currentActiveStepForRender.subtitle || `Content for ${currentActiveStepForRender.title}`}
          </p>
          {ContentComponent && (
            <ContentComponent 
              onCompletionChange={handleCompletionChangeForStep} 
              initialData={currentActiveStepForRender.data}
              stepId={currentActiveStepForRender.id}
            />
          )}
        </div>

        {/* Navigation Buttons - Updated border: border-t-2 border-futarchyGray62 dark:border-futarchyDarkGray42 */}
        <div className="flex justify-between items-center pt-4 border-t-2 border-futarchyGray62 dark:border-futarchyDarkGray42">
          <button
            onClick={handlePrevious}
            disabled={currentStepIndex === 0}
            className="px-6 py-2 text-sm font-medium rounded-md text-futarchyGray11 dark:text-futarchyGray112 bg-futarchyGray3 dark:bg-futarchyDarkGray4 hover:bg-futarchyGray4 dark:hover:bg-futarchyDarkGray5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <button
            onClick={handleNext}
            // Disable Next button if current step is not complete (explicitly false)
            disabled={managedSteps[currentStepIndex]?.isComplete === false}
            className="px-6 py-2 text-sm font-medium rounded-md text-white bg-futarchyViolet11 hover:bg-futarchyViolet11/80 dark:bg-futarchyViolet9 dark:hover:bg-futarchyViolet9/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLastStep ? (onCompleteAllSteps ? 'Submit' : 'Finish') : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalMultistep;
