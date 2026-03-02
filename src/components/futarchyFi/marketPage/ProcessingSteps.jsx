import React from 'react';

const ProcessingSteps = ({ currentStep }) => {
    const steps = {
        'approvingSwap': {
            title: 'Approving Token',
            description: 'Approving company YES token for swap...'
        },
        'swapping': {
            title: 'Swapping',
            description: 'Swapping company YES token to currency YES token...'
        },
        'addingCollateral': {
            title: 'Adding Collateral',
            description: 'Adding collateral to the position...'
        },
        'approveToken': {
            title: 'Approving Token',
            description: 'Approving token for collateral...'
        },
        'approveWrapper': {
            title: 'Approving Wrapper',
            description: 'Approving wrapper contract...'
        },
        'split': {
            title: 'Splitting',
            description: 'Splitting position...'
        },
        'wrapYes': {
            title: 'Wrapping YES',
            description: 'Wrapping YES position...'
        },
        'wrapNo': {
            title: 'Wrapping NO',
            description: 'Wrapping NO position...'
        },
        'unwrapYes': {
            title: 'Unwrapping YES',
            description: 'Unwrapping YES position...'
        },
        'unwrapNo': {
            title: 'Unwrapping NO',
            description: 'Unwrapping NO position...'
        },
        'merge': {
            title: 'Merging',
            description: 'Merging positions...'
        },
        'approveCompanyYes': {
            title: 'Approving Company YES',
            description: 'Approving company YES token for selling...'
        },
        'approvingRouter': {
            title: 'Approving Router',
            description: 'Approving SushiSwap router for swap...'
        },
        'checkingBalances': {
            title: 'Checking Balances',
            description: 'Verifying token balances...'
        },
        'preparingSwap': {
            title: 'Preparing Swap',
            description: 'Preparing to swap company YES to currency YES...'
        },
        'confirmingSwap': {
            title: 'Confirming Swap',
            description: 'Waiting for swap confirmation...'
        },
        'done': {
            title: 'Complete',
            description: 'Transaction completed successfully!'
        }
    };

    const currentStepInfo = steps[currentStep] || { title: 'Processing', description: 'Processing transaction...' };

    return (
        <div className="flex items-center gap-3 p-4 bg-futarchyGray4 rounded-lg">
            <div className="flex-shrink-0">
                {currentStep === 'done' ? (
                    <svg className="w-5 h-5 text-futarchyEmerald11" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                ) : (
                    <svg className="w-5 h-5 text-futarchyLavender animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                )}
            </div>
            <div>
                <h4 className="font-medium text-futarchyGray12">{currentStepInfo.title}</h4>
                <p className="text-sm text-futarchyGray11">{currentStepInfo.description}</p>
            </div>
        </div>
    );
};

export default ProcessingSteps; 
