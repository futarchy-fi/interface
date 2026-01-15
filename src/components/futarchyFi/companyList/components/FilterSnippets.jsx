import React from 'react';

// Define Inline SVG Icons for Filters
// (Using simple representations, replace with more specific icons if available)
const IconTrendingUp = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
  </svg>
);

const IconCurrency = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 11.219 12.768 11 12 11c-.768 0-1.536.219-2.121.659-.957.712-1.6 1.39-1.6 2.322Zm0 0V7.182" />
  </svg>
);

const IconScale = (props) => (
   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
     <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52v16.5m-13.5-16.5v16.5m13.5 0c.621 0 1.194-.012 1.75-.036m-1.75-.036a11.115 11.115 0 0 1-2.25.036m-6.75 0a11.115 11.115 0 0 0-2.25-.036m2.25 .036H8.25m6.75 0H12m2.25 0H15.75m-3.75 0v16.5c0 .621.504 1.125 1.125 1.125h1.5c.621 0 1.125-.504 1.125-1.125V8.668" />
   </svg>
);

const IconChip = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z" />
  </svg>
);

const IconSparkles = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L1.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
  </svg>
);

const IconGlobe = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
  </svg>
);

// Updated mock filter data with SVG components
const mockFilters = [
  { label: 'Trending', icon: (props) => <IconTrendingUp {...props} /> },
  { label: 'Finance', icon: (props) => <IconCurrency {...props} /> },
  { label: 'Governance', icon: (props) => <IconScale {...props} /> },
  { label: 'Technology', icon: (props) => <IconChip {...props} /> },
  { label: 'New Markets', icon: (props) => <IconSparkles {...props} /> },
  { label: 'Global', icon: (props) => <IconGlobe {...props} /> },
];

const FilterSnippets = () => {
  return (
    <div className="w-full overflow-x-auto pb-3 mb-8 scrollbar-hide">
      <div className="flex space-x-4 md:space-x-6 justify-start px-1">
        {mockFilters.map((filter, index) => {
           const Icon = filter.icon;
           return (
            <button
              key={index}
              className="flex flex-col items-center text-center p-2 rounded-lg w-20 group transition-colors duration-200 hover:bg-futarchyGray3 dark:hover:bg-futarchyDarkGray4 focus:outline-none"
            >
              <div className="mb-1.5 mx-auto text-futarchyGray9 dark:text-futarchyGray10 group-hover:text-futarchyGray11 dark:group-hover:text-futarchyGray112 transition-colors">
                <Icon className="w-6 h-6" />
              </div>
              <span className="text-xs font-medium text-futarchyGray11 dark:text-futarchyGray112 whitespace-nowrap group-hover:text-futarchyGray12 dark:group-hover:text-white">
                {filter.label}
              </span>
            </button>
           );
        })}
      </div>
      {/* Optional fade effect can still be added here */}
    </div>
  );
};

export default FilterSnippets; 