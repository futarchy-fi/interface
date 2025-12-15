import React from 'react';
import PropTypes from 'prop-types';

const LoadingSpinner = ({ className = "" }) => (
    <svg className={`animate-spin h-5 w-5 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.2" />
        <path fill="currentColor" strokeLinecap="round" d="M4 12a8 8 0 018-8V2.5" strokeWidth="3" />
    </svg>
);

const ActionButton = ({
    text,
    onClick,
    disabled = false,
    isLoading = false,
    isCompleted = false,
    textWhenLoading,
    textWhenCompleted,
    className = "",
    baseClass = "group relative overflow-hidden w-full py-3 px-4 rounded-2xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 border-2",
    enabledClass = "bg-futarchyGray2 dark:bg-futarchyDarkGray2 border-futarchyGray62 dark:border-futarchyGray112/40 text-futarchyGray12 dark:text-white",
    disabledClass = "bg-futarchyGray3 dark:bg-futarchyDarkGray3 border-futarchyGray62 dark:border-futarchysGray112/40 text-futarchyGray11/50 dark:text-futarchyGray8 cursor-not-allowed",
    loadingClass = "bg-futarchyGray3 dark:bg-futarchyDarkGray2 border-futarchyGray62 dark:border-futarchyDarkGray5 text-futarchyGray9 dark:text-futarchyGray8 cursor-not-allowed",
    completedClass = "bg-futarchyTeal4 text-futarchyTeal11 border-futarchyTeal7 dark:bg-futarchyTeal6/50 dark:text-futarchyTeal4 dark:border-futarchyTeal6 cursor-pointer",
    completedIcon,
    loadingIcon,
}) => {
    let currentText = text;
    let currentClasses = `${baseClass} ${className}`;
    let currentDisabled = disabled;
    let showSpinner = false;
    let iconToShow = null;

    const effectiveOnClick = (isCompleted && !onClick && isCompleted !== disabled) ? () => { } : onClick;
    const isShineEnabled = !disabled && !isLoading && !isCompleted;


    if (isCompleted) {
        currentText = textWhenCompleted || text;
        currentClasses += ` ${completedClass}`;
        // For a completed button, it's typically clickable to close/acknowledge.
        // It should only be disabled if explicitly passed as disabled AND isCompleted is true.
        currentDisabled = disabled && isCompleted;
        if (completedIcon) iconToShow = completedIcon;
    } else if (isLoading) {
        currentText = textWhenLoading || text;
        currentClasses += ` ${loadingClass}`;
        currentDisabled = true;
        if (loadingIcon) {
            iconToShow = loadingIcon;
        } else if (!textWhenLoading) {
            showSpinner = true;
        }
    } else if (disabled) {
        currentClasses += ` ${disabledClass}`;
        currentDisabled = true;
    } else {
        currentClasses += ` ${enabledClass}`;
    }

    return (
        <button
            onClick={effectiveOnClick}
            disabled={currentDisabled}
            className={currentClasses}
        >
            <div className="relative z-10 flex items-center justify-center gap-2">
                {showSpinner && <LoadingSpinner />}
                {iconToShow && !showSpinner && iconToShow}
                <span>{currentText}</span>
            </div>
            {isShineEnabled && (
                 <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent transform -translate-x-full -skew-x-12 group-hover:translate-x-full transition-transform duration-500 ease-in-out pointer-events-none"></div>
            )}
        </button>
    );
};

ActionButton.propTypes = {
    text: PropTypes.node,
    onClick: PropTypes.func,
    disabled: PropTypes.bool,
    isLoading: PropTypes.bool,
    isCompleted: PropTypes.bool,
    textWhenLoading: PropTypes.node,
    textWhenCompleted: PropTypes.node,
    className: PropTypes.string,
    baseClass: PropTypes.string,
    enabledClass: PropTypes.string,
    disabledClass: PropTypes.string,
    loadingClass: PropTypes.string,
    completedClass: PropTypes.string,
    completedIcon: PropTypes.node,
    loadingIcon: PropTypes.node,
};

export default ActionButton;