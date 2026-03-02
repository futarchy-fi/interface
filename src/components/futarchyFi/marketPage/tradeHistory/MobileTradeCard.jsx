import React from 'react';

const getOutcomeColor = (outcome) => (outcome.toLowerCase() === 'yes' ? 'text-futarchyBlue9' : 'text-futarchyGold8');
const getSideColor = (side) => (side.toLowerCase() === 'buy' ? 'text-futarchyTeal7' : 'text-futarchyCrimson9');
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
};

export const MobileTradeCard = ({ trade }) => {
  const { outcome, side, amountOut, amountIn, price, date } = trade;

  return (
    <div className="flex-shrink-0 w-full h-full bg-futarchyGray2 dark:bg-futarchyDarkGray2 rounded-xl p-4 flex flex-col justify-between border-2 border-futarchyGray62 dark:border-futarchyGray11/70 text-futarchyDarkGray1 dark:text-white">
      {/* Top Row: Action & Price */}
      <div className="flex justify-between items-start w-full">
        <div className="flex space-x-4">
          <div>
            <div className="text-xs text-black/60 dark:text-white/60">Side</div>
            <div className={`text-sm font-semibold ${getSideColor(side)}`}>{side.charAt(0).toUpperCase() + side.slice(1)}</div>
          </div>
          <div>
            <div className="text-xs text-black/60 dark:text-white/60">Outcome</div>
            <div className={`text-sm font-bold ${getOutcomeColor(outcome)}`}>{outcome}</div>
          </div>
        </div>
        <div>
          <div className="text-xs text-black/60 dark:text-white/60 text-right">Price</div>
          <div className="font-semibold font-mono text-sm text-right">{price}</div>
        </div>
      </div>

      {/* Middle Row: The Swap */}
      <div className="flex items-center justify-around text-center bg-futarchyGray3 dark:bg-futarchyDarkGray3 p-2 rounded-lg my-2 border-2 border-futarchyGray62 dark:border-futarchyGray11/70">
        {/* "From" Block */}
        <div className="flex-1">
          <div className="text-xs text-black/70 dark:text-white/70">{amountOut.token}</div>
          <div className="font-mono text-sm mt-1">{amountOut.amount}</div>
        </div>
        
        <div className="text-xl text-black/70 dark:text-white/70 mx-2">→</div>
        
        {/* "To" Block */}
        <div className="flex-1">
          <div className="text-xs text-black/70 dark:text-white/70">{amountIn.token}</div>
          <div className="font-mono text-sm mt-1">{amountIn.amount}</div>
        </div>
      </div>

      {/* Bottom Row: Date */}
      <div className="text-right text-xs text-black/50 dark:text-white/50 font-mono">
        {formatDate(date)}
      </div>
    </div>
  );
};

export default MobileTradeCard; 