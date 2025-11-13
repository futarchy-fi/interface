import React from 'react';
import Image from 'next/image';

const FireTheCeoBanner = () => {
  return (
    <div className="relative bg-gradient-to-r from-futarchyDarkGray2 via-futarchyDarkGray2 to-futarchyDarkGray2/90 pt-20 font-oxanium">
      {/* Placeholder SVG - Replace with actual SVG or image */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-10">
        <svg width="400" height="400" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="45" stroke="white" strokeWidth="2"/>
          <line x1="30" y1="30" x2="70" y2="70" stroke="white" strokeWidth="2"/>
          <line x1="30" y1="70" x2="70" y2="30" stroke="white" strokeWidth="2"/>
        </svg>
      </div>

      <div className="container mx-auto px-5 relative z-10">
        <div className="flex flex-col items-center text-center py-24 md:py-32">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4 tracking-tight uppercase">
            FIRE THE CEO
          </h1>
          <p className="text-lg md:text-xl text-futarchyGray112 max-w-2xl">
            Explore markets on the potential impact of leadership changes in major companies.
            Will firing the CEO boost the stock or tank it?
          </p>
        </div>
      </div>
    </div>
  );
};

export default FireTheCeoBanner; 