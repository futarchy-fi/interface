import React from 'react';
import CollateralModal from './CollateralModal';

export default {
  title: 'FutarchyFi/Market/CollateralModal',
  component: CollateralModal,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="bg-futarchyGray3 p-8 min-h-screen flex items-center justify-center">
        <Story />
      </div>
    ),
  ],
};

const Template = (args) => <CollateralModal {...args} />;

export const Connected = Template.bind({});
Connected.args = {
  title: 'Add Collateral',
  supportText: '',
  handleClose: () => console.log('Close clicked'),
  handleActionButtonClick: () => console.log('Action button clicked'),
  connectedWalletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  alertContainerTitle: 'Collateral Information',
  alertSupportText: 'Only deposit funds you intend to use for market interactions. Your collateral remains yours and can be retrieved at any time when not actively used in ongoing trades.',
  tokenConfig: {
    currency: { symbol: 'sDAI' },
    company: { symbol: 'GNO' },
    nativeCoin: { symbol: 'xDAI' }
  },
  balances: {
    wxdai: '1000.0',
    faot: '500.0'
  },
  action: 'add',
  proposalId: 'story-proposal-id',
  config: {
    BASE_TOKENS_CONFIG: {
      currency: { symbol: 'sDAI' },
      company: { symbol: 'PNK' }
    }
  },
  configLoading: false,
};

export const Disconnected = Template.bind({});
Disconnected.args = {
  ...Connected.args,
  connectedWalletAddress: null,
};

export const WithdrawConnected = Template.bind({});
WithdrawConnected.args = {
  ...Connected.args,
  title: 'Withdraw Collateral',
  supportText: 'Enter the amount you want to withdraw.',
  maxInputValue: 500.00,
  availableToDeposit: 500.00,
};

export const LowBalance = Template.bind({});
LowBalance.args = {
  ...Connected.args,
  maxInputValue: 10.00,
  availableToDeposit: 10.00,
}; 