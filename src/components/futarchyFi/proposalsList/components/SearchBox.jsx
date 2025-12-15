import React from "react";
import Image from "next/image";

const SearchBox = ({ value, onChange, placeholder = "Search milestones...", 'data-testid': dataTestId }) => {
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Search proposals..."}
        className="w-full h-12 pl-10 pr-4 rounded-xl border border-futarchyGray4 dark:border-futarchyDarkGray42 bg-white dark:bg-futarchyDarkGray3 text-futarchyGray12 dark:text-white placeholder-futarchyGray11 dark:placeholder-futarchyGray112 focus:outline-none focus:ring-2 focus:ring-futarchyGray4 dark:focus:ring-futarchyDarkGray42"
        data-testid={dataTestId}
      />
      <div className="absolute left-3 top-1/2 -translate-y-1/2">
        <Image
          src="/assets/search.svg"
          alt="Search"
          width={20}
          height={20}
          className="w-5 h-5 text-futarchyGray11 dark:text-futarchyGray112"
        />
      </div>
    </div>
  );
};

export default SearchBox; 