import React, { useState } from 'react';

const CloseModalButton = ({ onClick, type = 'icon', text = 'Cancel', failsafe = true }) => {
    const [showFailsafe, setShowFailsafe] = useState(false);

    const handleInitialClick = (e) => {
        e.stopPropagation(); // Prevent event bubbling
        switch (failsafe) {
            case true:
                setShowFailsafe(true);
                break;
            case false:
                onClick(); // Proceed directly if failsafe is off
                break;
            // Default case not strictly necessary for a boolean but good practice
            default:
                onClick();
                break;
        }
    };

    const handleConfirmClose = (e) => {
        e.stopPropagation();
        onClick(); // Call the original onClose passed from the modal
        setShowFailsafe(false);
    };

    const handleCancelClose = (e) => {
        e.stopPropagation();
        setShowFailsafe(false);
    };

    // Original button rendering (icon or text) - Rendered if showFailsafe is false
    const renderButton = () => {
        switch (type) {
            case 'icon':
                return (
                    <button
                        onClick={handleInitialClick}
                        className="text-futarchyGray11 hover:text-futarchyGray12 dark:text-futarchyGray112 dark:hover:text-futarchyGray3 transition-colors"
                        aria-label="Close modal"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                );
            case 'text':
                return (
                    <button
                        onClick={handleInitialClick}
                        className="px-4 py-2 rounded-lg font-medium transition-colors bg-futarchyGray4 hover:bg-futarchyGray5 text-futarchyGray11 dark:bg-futarchyDarkGray4 dark:hover:bg-futarchyDarkGray5 dark:text-futarchyGray112"
                    >
                        {text}
                    </button>
                );
            default:
                return null;
        }
    };

    return (
        <>
            {renderButton()}
            {(() => {
                switch (showFailsafe) {
                    case true:
                        return (
                            <div
                                className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"
                            // Do not close on backdrop click for this mini-modal, only via buttons
                            >
                                <div
                                    className="bg-white dark:bg-futarchyDarkGray2 p-6 rounded-lg shadow-xl text-center w-full max-w-xs dark:border dark:border-futarchyDarkGray6"
                                    onClick={(e) => e.stopPropagation()} // Prevent click from bubbling to backdrop
                                >
                                    <p className="text-base font-medium text-futarchyGray12 dark:text-futarchyGray112 mb-4">Cancel Operation?</p>
                                    <div className="flex justify-center space-x-3">
                                        <button
                                            onClick={handleConfirmClose}
                                            className="px-4 py-2 text-sm font-medium rounded-md bg-futarchyCrimson9 hover:bg-futarchyCrimson10 text-white transition-colors w-full"
                                        >
                                            Yes
                                        </button>
                                        <button
                                            onClick={handleCancelClose}
                                            className="px-4 py-2 text-sm font-medium rounded-md bg-futarchyGray6 hover:bg-futarchyGray7 text-futarchyGray12 dark:bg-futarchyDarkGray5 dark:hover:bg-futarchyDarkGray6 dark:text-futarchyDarkGray112 transition-colors w-full"
                                        >
                                            No
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    case false:
                        return null;
                    default:
                        return null;
                }
            })()}
        </>
    );
};

export default CloseModalButton;
