import React, { useState, useEffect } from 'react';

// TODO: Import a sanitization library like DOMPurify or implement robust sanitization functions.
// const sanitizeInput = (input) => {
//   // Basic example: escape HTML (replace with a proper library for security)
//   // return input.replace(/</g, "&lt;").replace(/>/g, "&gt;");
//   return input; // Placeholder
// };

const SUCCESS_MARK = '✓';
const TITLE_REQUIRED_ERROR = 'Proposal Title Required';
const DESCRIPTION_REQUIRED_ERROR = 'Proposal Description Required';

// Default empty data structure, used if initialData is null/undefined
const defaultEmptyData = { proposalTitle: '', proposalDescription: '' };

// Helper function for button state logic
// const determineButtonProps = (initialDataProp, currentLastSavedData, isDirty, bothFieldsFilled) => {
//   let stateKey = '';
//
//   // Since lastSavedData state is always initialized (to defaultEmptyData if initialData is null),
//   // it will always be an object. The key distinction for stateKey is based on filled status and dirtiness.
//   if (!bothFieldsFilled) {
//     stateKey = 'FIELDS_NOT_FILLED';
//   } else if (!isDirty) { // Fields are filled and not dirty, implies current display matches lastSavedData
//     stateKey = 'SAVED_AND_CLEAN';
//   } else { // bothFieldsFilled && isDirty
//     stateKey = 'FILLED_AND_DIRTY';
//   }
//
//   switch (stateKey) {
//     case 'FIELDS_NOT_FILLED':
//       return {
//         text: 'Save Proposal Details',
//         disabled: true,
//       };
//     case 'SAVED_AND_CLEAN': // Both fields filled, and not dirty
//       return {
//         text: 'Proposal Details Saved!',
//         disabled: true,
//       };
//     case 'FILLED_AND_DIRTY': // Both fields filled, and isDirty
//       return {
//         text: 'Save Proposal Details',
//         disabled: false,
//       };
//     default:
//       // Fallback, should ideally not be reached with clear stateKey logic
//       return {
//         text: 'Save Proposal Details',
//         disabled: true,
//       };
//   }
// };

const ProposalDetailsManager = ({ initialData, onCompletionChange, stepId }) => {
  const [proposalTitle, setProposalTitle] = useState('');
  const [proposalDescription, setProposalDescription] = useState('');
  const [titleError, setTitleError] = useState('');
  const [descriptionError, setDescriptionError] = useState('');
  
  // REMOVED - NO LONGER NEEDED
  // const [lastSavedData, setLastSavedData] = useState(null);
  // const [isDirty, setIsDirty] = useState(false);

  const getCurrentFormData = () => ({
    proposalTitle,
    proposalDescription,
  });

  // Effect to initialize form with initialData and set initial completion
  useEffect(() => {
    const dataToUse = initialData || defaultEmptyData;
    const currentTitle = dataToUse.proposalTitle || '';
    const currentDescription = dataToUse.proposalDescription || '';
    
    // Only update state if it differs from incoming initialData
    if (proposalTitle !== currentTitle) {
      setProposalTitle(currentTitle);
    }
    if (proposalDescription !== currentDescription) {
      setProposalDescription(currentDescription);
    }
    
    // REMOVED - NO LONGER NEEDED
    // setLastSavedData(dataToUse);
    // setIsDirty(false);

    const isValidBasedOnInitialData = currentTitle.trim() !== '' && currentDescription.trim() !== '';
    if (onCompletionChange) {
      onCompletionChange(isValidBasedOnInitialData, dataToUse);
    }

    setTitleError(currentTitle.trim() !== '' ? SUCCESS_MARK : '');
    setDescriptionError(currentDescription.trim() !== '' ? SUCCESS_MARK : '');

  }, [initialData, onCompletionChange]); // Added onCompletionChange to dependencies

  const handleInputChange = (setter, value, fieldName) => {
    setter(value);
    // setIsDirty(true); // REMOVED

    let currentFieldError = '';
    const isCurrentFieldNowValid = value.trim() !== '';

    const otherFieldValue = fieldName === 'title' ? proposalDescription : proposalTitle;
    const isOtherFieldStillValid = otherFieldValue.trim() !== '';

    currentFieldError = isCurrentFieldNowValid ? SUCCESS_MARK : (value.trim() === '' ? (fieldName === 'title' ? TITLE_REQUIRED_ERROR : DESCRIPTION_REQUIRED_ERROR) : '');

    if (fieldName === 'title') {
      setTitleError(isCurrentFieldNowValid ? SUCCESS_MARK : (value.trim() === '' ? TITLE_REQUIRED_ERROR : ''));
    } else {
      setDescriptionError(isCurrentFieldNowValid ? SUCCESS_MARK : (value.trim() === '' ? DESCRIPTION_REQUIRED_ERROR : ''));
    }
    
    const isFormNowOverallValid = isCurrentFieldNowValid && isOtherFieldStillValid;
    
    if (onCompletionChange) {
        const updatedData = {
            proposalTitle: fieldName === 'title' ? value : proposalTitle,
            proposalDescription: fieldName === 'description' ? value : proposalDescription,
        };
        onCompletionChange(isFormNowOverallValid, updatedData);
    }
  };
  
  const handleTitleChange = (e) => {
    handleInputChange(setProposalTitle, e.target.value, 'title');
  };

  const handleDescriptionChange = (e) => {
    handleInputChange(setProposalDescription, e.target.value, 'description');
  };

  const handleBlur = (fieldValue, setError, requiredErrorConst, fieldName) => {
    const currentData = getCurrentFormData();
    const isFieldValid = fieldValue.trim() !== '';
    
    if (!isFieldValid) {
      setError(requiredErrorConst);
    } else {
      setError(SUCCESS_MARK);
    }

    // Determine overall form validity after this field's blur
    const otherFieldValue = fieldName === 'title' ? proposalDescription : proposalTitle;
    const isOtherFieldValid = otherFieldValue.trim() !== '';
    const isFormOverallValid = isFieldValid && isOtherFieldValid;

    if (onCompletionChange) {
      onCompletionChange(isFormOverallValid, currentData); 
    }
  };

  const handleTitleBlur = () => {
    handleBlur(proposalTitle, setTitleError, TITLE_REQUIRED_ERROR, 'title');
  };

  const handleDescriptionBlur = () => {
    handleBlur(proposalDescription, setDescriptionError, DESCRIPTION_REQUIRED_ERROR, 'description');
  };

  // --- Button Logic --- (REMOVED - NO LONGER NEEDED)
  // const titleFilled = proposalTitle.trim() !== '';
  // const descriptionFilled = proposalDescription.trim() !== '';
  // const bothFieldsFilled = titleFilled && descriptionFilled;
  // const { text: determinedButtonText, disabled: determinedIsButtonDisabled } = determineButtonProps(...)

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="proposalTitle"
          className="block text-sm font-medium text-futarchyGray11 dark:text-futarchyGray112 mb-1"
        >
          Proposal Title
        </label>
        <input
          type="text"
          name="proposalTitle"
          id={`${stepId}-proposalTitle`} // Ensure unique ID if multiple instances
          value={proposalTitle}
          onChange={handleTitleChange}
          onBlur={handleTitleBlur}
          placeholder="Enter the proposal title"
          className={`w-full px-3 py-2 bg-white dark:bg-futarchyDarkGray4 border rounded-md shadow-sm transition-colors duration-300 ease-in-out 
                     text-futarchyGray12 dark:text-futarchyGray3 placeholder-futarchyGray9 dark:placeholder-futarchyGray8
                     focus:outline-none
                     ${titleError === TITLE_REQUIRED_ERROR ? 'border-futarchyCrimson9 dark:border-futarchyCrimson9' : 
                       titleError === SUCCESS_MARK ? 'border-futarchyTeal9 dark:border-futarchyTeal9' : 
                       'border-transparent'}`}
        />
        <div className="min-h-[1.25rem]"> 
          {titleError === TITLE_REQUIRED_ERROR && (
            <p className="mt-1 text-xs text-futarchyCrimson9 dark:text-futarchyCrimson9 transition-opacity duration-300 ease-in-out opacity-100">
              {titleError}
            </p>
          )}
          {titleError === SUCCESS_MARK && (
            <p className="mt-1 text-xs text-futarchyTeal9 dark:text-futarchyTeal9 transition-opacity duration-300 ease-in-out opacity-100">
              {SUCCESS_MARK}
            </p>
          )}
        </div>
      </div>

      <div>
        <label
          htmlFor="proposalDescription"
          className="block text-sm font-medium text-futarchyGray11 dark:text-futarchyGray112 mb-1"
        >
          Proposal Description
        </label>
        <textarea
          name="proposalDescription"
          id={`${stepId}-proposalDescription`} // Ensure unique ID
          value={proposalDescription}
          onChange={handleDescriptionChange}
          onBlur={handleDescriptionBlur}
          rows="4"
          placeholder="Describe the proposal in detail"
          className={`w-full px-3 py-2 bg-white dark:bg-futarchyDarkGray4 border rounded-md shadow-sm resize-none transition-colors duration-300 ease-in-out 
                     text-futarchyGray12 dark:text-futarchyGray3 placeholder-futarchyGray9 dark:placeholder-futarchyGray8
                     focus:outline-none
                     ${descriptionError === DESCRIPTION_REQUIRED_ERROR ? 'border-futarchyCrimson9 dark:border-futarchyCrimson9' : 
                       descriptionError === SUCCESS_MARK ? 'border-futarchyTeal9 dark:border-futarchyTeal9' : 
                       'border-transparent'}`}
        />
        <div className="min-h-[1.25rem]"> 
          {descriptionError === DESCRIPTION_REQUIRED_ERROR && (
            <p className="mt-1 text-xs text-futarchyCrimson9 dark:text-futarchyCrimson9 transition-opacity duration-300 ease-in-out opacity-100">
              {descriptionError}
            </p>
          )}
          {descriptionError === SUCCESS_MARK && (
            <p className="mt-1 text-xs text-futarchyTeal9 dark:text-futarchyTeal9 transition-opacity duration-300 ease-in-out opacity-100">
              {SUCCESS_MARK}
            </p>
          )}
        </div>
      </div>

      {/* REMOVED Save Button
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={determinedIsButtonDisabled}
          className="px-6 py-2 text-sm font-medium rounded-md text-white bg-futarchyViolet11 hover:bg-futarchyViolet11/80 dark:bg-futarchyViolet9 dark:hover:bg-futarchyViolet9/80 focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {determinedButtonText}
        </button>
      </div>
      */}
    </div>
  );
};

export default ProposalDetailsManager;
