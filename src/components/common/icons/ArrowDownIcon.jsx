import React from 'react';

const ArrowDownIcon = ({ className }) => {
  return (
    <svg 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path 
        fillRule="evenodd" 
        clipRule="evenodd" 
        d="M11.25 20V4H12.75V20H11.25Z" 
        fill="currentColor"
      />
      <path 
        fillRule="evenodd" 
        clipRule="evenodd" 
        d="M4.99999 11.9393L12 18.9393L19 11.9393L20.0607 13L12 21.0607L3.93933 13L4.99999 11.9393Z" 
        fill="currentColor"
      />
    </svg>
  );
};

export default ArrowDownIcon; 