import React from 'react';
import ApproveTokensModal from './ApproveTokensModal';

export default {
  title: 'FutarchyFi/Market/ApproveTokensModal',
  component: ApproveTokensModal,
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

const Template = (args) => <ApproveTokensModal {...args} />;

export const Default = Template.bind({});
Default.args = {
  handleClose: () => console.log('Close clicked'),
  connectedWalletAddress: '0x1234567890abcdef1234567890abcdef12345678',
};

export const Disconnected = Template.bind({});
Disconnected.args = {
  handleClose: () => console.log('Close clicked'),
  connectedWalletAddress: null,
}; 