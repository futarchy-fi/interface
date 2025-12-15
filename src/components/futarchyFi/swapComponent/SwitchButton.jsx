import React, { useState } from "react";
import PropTypes from "prop-types";

const SwitchButton = ({
  leftText,
  rightText,
  onToggle,
  switchButtonStyles = "flex w-full h-12 p-1 bg-gradient-to-r from-futarchyDarkBlue/60 to-futarchyBurgundy/60 border border-white",
}) => {
  const [selected, setSelected] = useState("left");

  const handleClick = (side) => {
    setSelected(side);
    if (onToggle) {
      onToggle(side);
    }
  };

  const leftButtonClass =
    selected === "left"
      ? "bg-futarchyDarkBlue text-white"
      : "bg-transparent text-white";
  const rightButtonClass =
    selected === "right"
      ? "bg-futarchyBurgundy text-white"
      : "bg-transparent text-white";

  return (
    <div className={switchButtonStyles}>
      <button
        onClick={() => handleClick("left")}
        className={`flex-1 text-sm font-medium items-center justify-center transition duration-300 ${leftButtonClass}`}
      >
        {leftText}
      </button>
      <button
        onClick={() => handleClick("right")}
        className={`flex-1 text-sm font-medium items-center justify-center transition duration-300 ${rightButtonClass}`}
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
};

export default SwitchButton;
