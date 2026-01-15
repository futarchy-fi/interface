import React from 'react';
import SpotMarketPanel from './SpotMarketPanel';
import SplitStep from './steps/SplitStep';
import WrapStep from './steps/WrapStep';

export default {
  title: 'Futarchy Fi/Market Page/Spot Market Panel',
  component: SpotMarketPanel,
  parameters: {
    layout: 'padded',
  },
};

const Template = (args) => <SpotMarketPanel {...args} />;

export const Default = Template.bind({});
Default.args = {
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
  }
}; 