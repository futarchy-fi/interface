import React from "react";

const ToggleButton = ({
  id,
  isActive,
  text,
  supportText,
  onToggle,
  className = "",
  ariaLabel = "",
  toggleButtonDisabled = false,
  activeBgColor = "bg-black", // Default background color
  activeBorderColor = "border-black", // Default border color
}) => {
  const handleToggleClick = () => {
    if (toggleButtonDisabled) return;
    onToggle(id, !isActive);
  };

  return (
    <div className={`flex items-center select-none ${className}`}>
      <button
        onClick={handleToggleClick}
        disabled={toggleButtonDisabled}
        className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
          toggleButtonDisabled
            ? "bg-gray-200 cursor-not-allowed border-gray-200"
            : `${activeBgColor} ${activeBorderColor}` // Consistent color regardless of state
        }`}
        aria-label={ariaLabel}
      >
        <span
          className={`absolute left-1 top-1 w-4 h-4 rounded-full 
                     transition-all duration-300 transform
                     ${
                       isActive
                         ? "translate-x-6 bg-white"
                         : "translate-x-0 bg-white"
                     }
                     ${toggleButtonDisabled ? "bg-gray-400" : ""}`}
        />
      </button>

      <div className="flex flex-col">
        <span
          className={`text-sm font-normal ${
            toggleButtonDisabled ? "text-gray-400" : "text-black"
          }`}
        >
          {text}
        </span>
        {supportText && (
          <span className="text-aave-gray text-sm">{supportText}</span>
        )}
      </div>
    </div>
  );
};

export default ToggleButton;
