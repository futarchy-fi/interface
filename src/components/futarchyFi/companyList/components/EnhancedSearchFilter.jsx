import React from 'react';

// Inline SVG Definitions
const SearchIconSVG = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...props}>
    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
  </svg>
);

const EnhancedSearchFilter = ({
  searchQuery, // Keep for potential future use in placeholders
  // onSearchChange, // No direct input field anymore
  filterOptions, // Still needed for the label
  activeFilter,
  // onFilterChange, // Filtering handled by separate button
  // onSearchSubmit, // Placeholder for search action
}) => {

  // Determine the active filter label (or default)
  const activeFilterLabel = filterOptions?.find(opt => opt.value === activeFilter)?.label || 'Category';

  return (
    // Main container mimicking Airbnb style
    <div className="w-full bg-white dark:bg-futarchyDarkGray3 rounded-full shadow-lg hover:shadow-xl border border-futarchyGray3 dark:border-futarchyDarkGray4 flex items-center divide-x divide-futarchyGray3 dark:divide-futarchyDarkGray5 transition-shadow duration-200">

      {/* Segment 1: Search Companies */}
      <button className="flex-1 px-6 py-3 text-left hover:bg-futarchyGray1 dark:hover:bg-futarchyDarkGray4 rounded-l-full focus:outline-none">
        <div className="text-xs font-bold text-futarchyGray12 dark:text-white uppercase tracking-wider">Search</div>
        <div className="text-sm text-futarchyGray9 truncate">
          {searchQuery || 'Company name...'}
        </div>
      </button>

      {/* Segment 2: Filter Category */}
      <button className="flex-shrink-0 px-6 py-3 text-left hover:bg-futarchyGray1 dark:hover:bg-futarchyDarkGray4 focus:outline-none">
        <div className="text-xs font-bold text-futarchyGray12 dark:text-white uppercase tracking-wider">Filter</div>
        <div className="text-sm text-futarchyGray9 truncate">
          {activeFilterLabel === 'All Companies' ? 'Category' : activeFilterLabel}
        </div>
      </button>

      {/* Search Button */}
      <div className="px-3 py-2"> {/* Padding to center the button */} 
        <button 
          // onClick={onSearchSubmit} 
          className="bg-futarchyPurple8 hover:bg-futarchyPurple7 text-white rounded-full p-2 md:p-3 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-futarchyPurple5 transition-colors"
        >
          <SearchIconSVG className="h-4 w-4 md:h-5 md:w-5" />
        </button>
      </div>

    </div>
  );
};

export default EnhancedSearchFilter; 