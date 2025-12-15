import React from 'react';
import ConditionalMarketInfoPanel from './ConditionalMarketInfoPanel';

export default {
  title: 'Futarchy Fi/Market Page/Conditional Market Info Panel',
  component: ConditionalMarketInfoPanel,
};

const Template = (args) => <ConditionalMarketInfoPanel {...args} />;

export const Default = Template.bind({});
Default.args = {
  selectedMarket: {
    approval: { marketValue: 70000, symbol: 'APP' },
    refusal: { marketValue: 60000, symbol: 'REP' },
    base: { marketValue: 65000, symbol: 'BSE' },
  },
};
