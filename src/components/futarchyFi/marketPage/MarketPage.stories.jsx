import React from 'react';
import MarketPage from './MarketPage';
import MarketPageShowcase from './MarketPageShowcase';

export default {
  title: 'Futarchy Fi/Market Page',
  parameters: {
    layout: 'fullscreen',
  },
};

const DeprecatedTemplate = (args) => <MarketPage {...args} />;
const ShowcaseTemplate = (args) => <MarketPageShowcase {...args} />;

export const FullPageDeprecated = DeprecatedTemplate.bind({});
FullPageDeprecated.args = {
  selectedMarket: {
    approval: {
      marketValue: 0.75,
      symbol: "YES",
    },
    refusal: {
      marketValue: 0.25,
      symbol: "NO",
    },
    base: {
      marketValue: 0.50,
      symbol: "BASE"
    },
  },
  availableToTrade: {
    approval: 1000,
    refusal: 1000,
  },
  priceBand: {
    approval: {
      high: 0.80,
      low: 0.70,
    },
    refusal: {
      high: 0.30,
      low: 0.20,
    }
  },
};

export const Showcase = ShowcaseTemplate.bind({});
Showcase.args = {
  hidden: false,
};

export const ShowcaseWithSwap = ShowcaseTemplate.bind({});
ShowcaseWithSwap.args = {
  hidden: true,
}; 