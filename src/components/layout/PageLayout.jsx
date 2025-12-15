import React from 'react';

const PageLayout = ({ hero, children, contentClassName = '' }) => {
  return (
    <div className="flex flex-col select-none flex-grow">
      {/* 1. Hero Section (Optional) */}
      {hero && (
        <header>
          {hero}
        </header>
      )}

      {/* 2. Main Content Area */}
      <main className={`bg-white dark:bg-futarchyDarkGray2 w-full flex-grow flex flex-col lg:mt-20`}>
        <div className={`container mx-auto px-5 pb-6 ${contentClassName} flex-grow flex flex-col`}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default PageLayout; 