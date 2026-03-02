import React, { useState } from "react";
import BuySellPanel from "./BuySellPanel";

export default {
  title: 'Futarchy Fi/Market Page/Buy|Sell Panel',
  component: BuySellPanel,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    selectedMarket: { control: "object" },
    availableToTrade: { control: "object" },
    priceBand: { control: "object" },
  },
};

const Template = (args) => {
  const [isOpen, setIsOpen] = useState(false); // Correctly define state inside the component

  const togglePanel = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={togglePanel}
        className="fixed bottom-2 right-2 p-3 bg-black text-white shadow-lg z-50 md:hidden"
      >
        Open Trade Panel
      </button>

      {/* Pass the isOpen state and togglePanel handler to BuySellPanel */}
      <BuySellPanel {...args} isOpen={isOpen} onTogglePanel={togglePanel} />
    </>
  );
};

export const Default = Template.bind({});
Default.args = {
  selectedMarket: {
    approval: {
      marketValue: 70000,
      symbol: "APP",
    },
    refusal: {
      marketValue: 60000,
      symbol: "REP",
    },
    base: {
      marketValue: 65000,
      symbol: "BSE",
    },
  },
  availableToTrade: {
    approval: 35000,
    refusal: 30000,
  },
  priceBand: {
    approval: {
      high: 120,
      low: 80,
    },
    refusal: {
      high: 110,
      low: 70,
    },
  },
};
