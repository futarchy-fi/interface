import React, { useState } from 'react';
import TradeHistory from '../tradeHistory/TradeHistory';
import RedeemTokens from '../redeemTokens/RedeemTokens';

const TabsComponent = () => {
  const [activeTab, setActiveTab] = useState('Trade History');

  const tabs = [
    { name: 'Trade History', component: <TradeHistory /> },
    { name: 'Redeem Tokens', component: <RedeemTokens /> },
    // Additional tabs can be added here in the future
  ];

  const activeContent = tabs.find(tab => tab.name === activeTab)?.component;

  return (
    <div className="w-full rounded-3xl border-2 border-futarchyGray62 dark:border-futarchyGray11/70 overflow-hidden">
      <div className="h-16 px-4 bg-futarchyGray2 dark:bg-futarchyDarkGray2 border-b-2 border-futarchyGray62 dark:border-futarchyGray11/70">
        {tabs.map((tab) => (
          <button
            key={tab.name}
            onClick={() => setActiveTab(tab.name)}
            className={`h-full py-3 px-1 mr-4 -mb-px text-sm font-semibold transition-colors duration-200 ease-in-out
              ${activeTab === tab.name
                ? 'border-b-2 border-futarchyViolet9 text-futarchyViolet11 dark:text-futarchyViolet9'
                : 'text-futarchyGray11 dark:text-white/70 hover:text-futarchyGray12 dark:hover:text-white border-b-2 border-transparent'
              }
            `}
          >
            {tab.name}
          </button>
        ))}
      </div>
      <div className="bg-futarchyGray3 dark:bg-futarchyDarkGray3 h-[190px] p-4 w-full">
        {activeContent}
      </div>
    </div>
  );
};

export default TabsComponent; 