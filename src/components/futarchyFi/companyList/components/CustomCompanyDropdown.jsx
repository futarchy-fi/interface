import React, { useState, useRef, useEffect } from "react";
import { DownVectorIcon } from "../../proposalsList/cards/Resources";

const CustomCompanyDropdown = ({ options, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full md:w-[224px] h-12 px-4 rounded-xl border border-futarchyGray4 dark:border-futarchyDarkGray42 bg-white dark:bg-futarchyDarkGray3 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          {selectedOption.icon && (
            <selectedOption.icon className="w-5 h-5 text-futarchyGray11 dark:text-futarchyGray112" />
          )}
          <span className="text-futarchyGray12 dark:text-white font-medium">
            {selectedOption.label}
          </span>
        </div>
        <div className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          <DownVectorIcon className="w-5 h-5 text-futarchyGray11 dark:text-futarchyGray112" />
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-futarchyGray4 dark:border-futarchyDarkGray42 bg-white dark:bg-futarchyDarkGray3 shadow-lg z-10">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-futarchyGray3 dark:hover:bg-futarchyDarkGray42 transition-colors ${
                option.value === value.value
                  ? "bg-futarchyGray3 dark:bg-futarchyDarkGray42"
                  : ""
              } first:rounded-t-xl last:rounded-b-xl`}
            >
              {option.icon && (
                <option.icon className="w-5 h-5 text-futarchyGray11 dark:text-futarchyGray112" />
              )}
              <span className="text-futarchyGray12 dark:text-white font-medium">
                {option.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomCompanyDropdown; 