import React from "react";

const CheckboxButton = ({
  id,
  isActive,
  text,
  onToggle,
  shape = "square",
  className = "",
  ariaLabel = "",
  useLineFill = false,
  toggleButtonDisabled = false,
  activeBorderColor = "futarchyLavenderDark", // Darker lavender default
  activeBgColor = "bg-futarchyLavender", // Default lavender background
  inactiveColor = "border-darkGray",
}) => {
  const handleToggleClick = () => {
    if (toggleButtonDisabled) return;
    onToggle(id, !isActive);
  };

  // Define classes explicitly
  const borderColorClass = toggleButtonDisabled
    ? "border-darkGray"
    : isActive
    ? activeBorderColor === "futarchyLavenderDark"
      ? "border-futarchyLavenderDark"
      : "border-futarchyOrangeDark"
    : inactiveColor;

  const backgroundColorClass = toggleButtonDisabled
    ? "bg-gray"
    : isActive
    ? activeBgColor === "bg-futarchyLavender"
      ? "bg-futarchyLavender"
      : "bg-futarchyOrange"
    : "bg-transparent";

  const renderInnerContent = () => {
    if (!isActive && !toggleButtonDisabled) return null;

    if (shape === "square" && useLineFill) {
      return (
        <div
          className={`${
            toggleButtonDisabled ? "bg-gray" : backgroundColorClass
          } w-3/4 h-[1px] transition duration-200 ease-in-out`}
          style={{
            position: "absolute",
            top: "50%",
            transform: "translateY(-50%)",
          }}
        ></div>
      );
    }

    return (
      <div
        className={`${backgroundColorClass} w-full h-full transition duration-200 ease-in-out`}
      ></div>
    );
  };

  return (
    <div className={`flex flex-row gap-2 select-none ${className}`}>
      <div
        className={`relative flex w-[18px] h-[18px] top-[2px] border-2 ${borderColorClass} ${
          toggleButtonDisabled ? "cursor-not-allowed" : "cursor-pointer"
        } transition duration-200 ease-in-out`}
        onClick={handleToggleClick}
        aria-label={ariaLabel}
      >
        {renderInnerContent()}
      </div>

      <div
        className={`text-sm font-medium mt-[2px] ${
          toggleButtonDisabled ? "text-gray-400" : "text-black"
        }`}
      >
        {text}
      </div>
    </div>
  );
};

export default CheckboxButton;
