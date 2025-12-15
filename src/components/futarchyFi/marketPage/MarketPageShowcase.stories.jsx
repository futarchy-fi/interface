import React from 'react';
import { WagmiConfig, createConfig } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { createPublicClient, http } from 'viem';
import MarketPageShowcase from './MarketPageShowcase';

// Mock wagmi config for Storybook
const config = createConfig({
  autoConnect: true,
  publicClient: createPublicClient({
    chain: mainnet,
    transport: http()
  }),
});

export default {
  title: 'FutarchyFi/Market/MarketPageShowcase',
  component: MarketPageShowcase,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <WagmiConfig config={config}>
        <Story />
      </WagmiConfig>
    ),
  ],
};

const Template = (args) => {
  console.log('Story rendering with args:', args); // Debug story render
  return <MarketPageShowcase {...args} />;
};

export const Connected = Template.bind({});
Connected.args = {
  isWalletConnected: true,
  connectedWalletAddress: '0x1234...5678',
};

export const Disconnected = Template.bind({});
Disconnected.args = {
  isWalletConnected: false,
  connectedWalletAddress: null,
}; 