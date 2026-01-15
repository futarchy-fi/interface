import React, { useState } from "react";
import PropTypes from "prop-types";

const SwitchButton = ({
  leftText,
  rightText,
  onToggle,
  initialSelected = "left",
  variant = "default",
  className = "",
}) => {
  const [selected, setSelected] = useState(initialSelected);

  const handleClick = (side) => {
    setSelected(side);
    if (onToggle) {
      onToggle(side);
    }
  };

  const variants = {
    default: {
      container: "bg-black border border-black",
      leftActive: "bg-black text-primary font-bold border-primary",
      rightActive: "bg-black text-danger font-bold border-danger",
    },
    trading: {
      container: "bg-gradient-to-r from-futarchyGreenYes/60 to-futarchyRedNo/60",
      leftActive: "bg-futarchyGreenYes text-white",
      rightActive: "bg-futarchyRedNo text-white",
    },
    outcome: {
      container: "bg-gradient-to-r from-futarchyPurple/60 to-futarchyBlue/60",
      leftActive: "bg-futarchyPurple text-white",
      rightActive: "bg-futarchyBlue text-white",
    }
  };

  const currentVariant = variants[variant];

  const baseButtonClass = `
    flex-1 
    text-sm
    text-black
    font-medium 
    items-center 
    justify-center 
    transition-all 
    duration-300
    border-2
  `;

  const leftButtonClass = `
    ${baseButtonClass}
    ${selected === "left" 
      ? currentVariant.leftActive
      : "bg-transparent text-white border-black"}
  `;

  const rightButtonClass = `
    ${baseButtonClass}
    ${selected === "right" 
      ? currentVariant.rightActive
      : "bg-transparent text-white border-black"}
  `;

  return (
    <div className={`
      flex 
      w-full 
      h-12 
      p-1 
      backdrop-blur-sm
      ${currentVariant.container}
      ${className}
    `}>
      <button
        onClick={() => handleClick("left")}
        className={leftButtonClass}
      >
        {leftText}
      </button>
      <button
        onClick={() => handleClick("right")}
        className={rightButtonClass}
      >
        {rightText}
      </button>
    </div>
  );
};

SwitchButton.propTypes = {
  leftText: PropTypes.string.isRequired,
  rightText: PropTypes.string.isRequired,
  onToggle: PropTypes.func,
  initialSelected: PropTypes.oneOf(["left", "right"]),
  variant: PropTypes.oneOf(["default", "trading", "outcome"]),
  className: PropTypes.string,
};

export default SwitchButton;
