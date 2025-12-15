import React, { useEffect, useState, useRef } from "react";
import PropTypes from "prop-types";

const Slider = ({
  steps = 4,
  defaultValue = 25,
  onChange = () => {},
  stepArray = null,
  numberHandleSlider = false,
  min = 1,
  max = 100,
  activeTrackColor = "bg-futarchyLavender", // Default active track color
  inactiveTrackColor = "bg-futarchyLavenderDark", // Default inactive track color
  activeStepColor = "bg-futarchyLavender", // Default active step color
  inactiveStepColor = "bg-futarchyLavenderDark", // Default inactive step color
  thumbBgColor = "bg-futarchyLavender", // Default thumb background
  thumbBorderColor = "border-futarchyLavenderDark", // Default thumb border color
}) => {
  const [value, setValue] = useState(defaultValue);
  const sliderRef = useRef(null);

  // Sync internal state with defaultValue prop when it changes
  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const handleChange = (e) => {
    const newValue = parseFloat(e.target.value);
    const limitedValue = isNaN(newValue)
      ? min
      : Math.min(Math.max(newValue, min), max);
    setValue(limitedValue);
    onChange(limitedValue); // Notify parent of the change
  };

  const handleMouseDown = (e) => {
    const moveAt = (pageX) => {
      const slider = sliderRef.current;
      const rect = slider.getBoundingClientRect();
      let newValue = ((pageX - rect.left) / rect.width) * (max - min) + min;
      newValue = Math.min(Math.max(Math.round(newValue), min), max);
      setValue(newValue);
      onChange(newValue); // Notify parent of the change
    };

    moveAt(e.clientX);

    const onMouseMove = (e) => moveAt(e.clientX);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener(
      "mouseup",
      () => {
        document.removeEventListener("mousemove", onMouseMove);
      },
      { once: true }
    );
  };

  const translateXValue = numberHandleSlider
    ? 30 - ((value - min) / (max - min)) * 100
    : 0;

  const thumbStyle = {
    left: `calc(${((value - min) / (max - min)) * 100}% - ${
      stepArray ? "1.5rem" : "0.5rem"
    })`,
    transform: `translateY(-50%) translateX(${translateXValue}%)`,
    top: "50%",
    zIndex: 1,
  };

  return (
    <div className="flex items-center w-full" ref={sliderRef}>
      <div className="relative w-full h-7 flex items-center cursor-pointer">
        {/* Track with active and inactive segments */}
        <div className={`absolute w-full h-[2px] ${inactiveTrackColor}`}>
          <div
            className={`h-full ${activeTrackColor} rounded`}
            style={{ width: `${((value - min) / (max - min)) * 100}%` }}
          ></div>
        </div>

        {/* Steps */}
        {[...Array(steps + 1)].map((_, index) => {
          const stepValue = min + (index / steps) * (max - min);
          return (
            <div
              key={index}
              className={`absolute w-0.5 h-3 ${
                value >= stepValue ? activeStepColor : inactiveStepColor
              } rounded`}
              style={{ left: `${(index / steps) * 100}%` }}
            ></div>
          );
        })}

        {/* Slider Input */}
        <input
          type="range"
          min={min}
          max={max}
          step={stepArray ? (max - min) / stepArray.length : "1"}
          value={value}
          onChange={handleChange}
          className="slider appearance-none w-full h-full bg-transparent outline-none opacity-0 cursor-pointer"
          style={{ zIndex: 2 }}
        />

        {/* Thumb */}
        <div
          className={`absolute ${thumbBgColor} shadow border-2 ${thumbBorderColor} flex items-center justify-center select-none ${
            numberHandleSlider
              ? "text-[10px] text-white py-[2px] px-[6px] rounded whitespace-nowrap"
              : "w-4 h-4 rounded-full"
          }`}
          style={thumbStyle}
          onMouseDown={handleMouseDown}
        >
          {numberHandleSlider && value}
          {numberHandleSlider && "x"}
        </div>
      </div>
    </div>
  );
};

Slider.propTypes = {
  steps: PropTypes.number,
  defaultValue: PropTypes.number,
  onChange: PropTypes.func,
  stepArray: PropTypes.array,
  numberHandleSlider: PropTypes.bool,
  min: PropTypes.number,
  max: PropTypes.number,
  activeTrackColor: PropTypes.string,
  inactiveTrackColor: PropTypes.string,
  activeStepColor: PropTypes.string,
  inactiveStepColor: PropTypes.string,
  thumbBgColor: PropTypes.string,
  thumbBorderColor: PropTypes.string,
};

export default Slider;
