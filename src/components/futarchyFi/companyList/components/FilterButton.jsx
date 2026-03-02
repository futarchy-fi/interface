import React from 'react';

// Inline SVG for Filter Icon
const FilterIconSVG = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
  </svg>
);


const FilterButton = ({ onClick, activeFilterCount = 0 }) => {
  return (
    <button
      onClick={onClick} // Placeholder: This would open a filter modal
      className="flex items-center px-4 py-2 border border-futarchyGray4 dark:border-futarchyDarkGray5 rounded-lg bg-white dark:bg-futarchyDarkGray3 text-futarchyGray11 dark:text-futarchyGray112 hover:border-futarchyGray6 dark:hover:border-futarchyDarkGray6 hover:shadow-sm transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-futarchyGray5"
    >
      <FilterIconSVG className="w-5 h-5 mr-2" />
      <span className="text-sm font-medium">Filters</span>
      {/* Optional: Show active filter count */} 
      {/* {activeFilterCount > 0 && (
        <span className="ml-2 bg-futarchyGray11 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">{activeFilterCount}</span>
      )} */}
    </button>
  );
};

export default FilterButton; 