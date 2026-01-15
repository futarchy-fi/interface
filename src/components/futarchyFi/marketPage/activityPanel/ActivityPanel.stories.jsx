import React, { useRef } from 'react';
import ActivityPanel from './ActivityPanel';

export default {
  title: 'Futarchy Fi/Market/Activity Panel',
  component: ActivityPanel,
  parameters: {
    layout: 'padded',
  },
};

const generateMockPosition = () => ({
  id: Date.now(),
  market: 'BTC 10x',
  size: `${(Math.random() * 0.001).toFixed(4)} BTC`,
  positionValue: `$${(Math.random() * 10).toFixed(4)}`,
  entryPrice: `$${(Math.random() * 70000).toFixed(2)}`,
  pnl: { 
    value: `$${(Math.random() * 0.1).toFixed(5)}`, 
    percentage: `${(Math.random() * 1).toFixed(2)}%`,
    isPositive: Math.random() > 0.5 
  },
  liquidation: `$${(Math.random() * 65000).toFixed(2)}`,
  margin: `$${(Math.random() * 1).toFixed(3)}`,
  funding: `$${(Math.random() * 0.001).toFixed(6)}`
});

const generateMockOrder = () => ({
  id: Date.now(),
  date: new Date().toISOString().split('T')[0] + ' ' + new Date().toLocaleTimeString(),
  pair: 'BTC/USDT',
  type: 'Limit',
  side: Math.random() > 0.5 ? 'Buy' : 'Sell',
  price: `$${(Math.random() * 70000).toFixed(2)}`,
  amount: `${(Math.random() * 0.001).toFixed(4)} BTC`,
  filled: `${Math.floor(Math.random() * 100)}%`,
  total: `$${(Math.random() * 10).toFixed(3)}`,
  status: 'Open'
});

const generateMockTrade = () => ({
  id: Date.now(),
  time: new Date().toLocaleTimeString(),
  pair: 'BTC/USDT',
  side: Math.random() > 0.5 ? 'Buy' : 'Sell',
  price: `$${(Math.random() * 70000).toFixed(2)}`,
  amount: `${(Math.random() * 0.001).toFixed(4)} BTC`,
  total: `$${(Math.random() * 10).toFixed(4)}`
});

const Template = (args) => {
  const panelRef = useRef();

  return (
    <div className="space-y-4">
      <div className="flex gap-4 mb-4">
        <button
          onClick={() => panelRef.current?.addPosition(generateMockPosition())}
          className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
        >
          Simulate New Position
        </button>
        <button
          onClick={() => panelRef.current?.addOrder(generateMockOrder())}
          className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
        >
          Simulate New Order
        </button>
        <button
          onClick={() => panelRef.current?.addTrade(generateMockTrade())}
          className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
        >
          Simulate New Trade
        </button>
      </div>
      <ActivityPanel 
        ref={panelRef} 
        initialPositions={[generateMockPosition()]}
        initialOrders={[generateMockOrder()]}
        initialTrades={[generateMockTrade()]}
        {...args} 
      />
    </div>
  );
};

export const Default = Template.bind({});
Default.args = {}; 