import React from 'react';
import { BaseTableCell } from './BaseTableCell';

export const OutcomeCell = ({ outcome }) => {
  const color = outcome === "YES" ? "text-futarchyBlue9 dark:text-futarchyBlue9" : "text-futarchyGold8 dark:text-futarchyGold8";
  const formattedOutcome = outcome.charAt(0).toUpperCase() + outcome.slice(1).toLowerCase();
  
  return (
    <BaseTableCell className={`${color} font-semibold`}>
      {formattedOutcome}
    </BaseTableCell>
  );
};

export const SideCell = ({ side }) => {
  const color = side === 'buy' ? 'text-futarchyTeal9 dark:text-futarchyTeal9' : 'text-futarchyCrimson9 dark:text-futarchyCrimson9';
  const formattedSide = side.charAt(0).toUpperCase() + side.slice(1);

  return (
    <BaseTableCell className={`${color} font-semibold`}>
      {formattedSide}
    </BaseTableCell>
  );
};

export const PriceCell = ({ price }) => (
  <BaseTableCell className="text-right text-futarchyGray12 dark:text-white">
    <span className="font-semibold">{price}</span>
  </BaseTableCell>
);

export const DateCell = ({ date }) => {
  const d = new Date(date);
  const pad = (num) => num.toString().padStart(2, '0');
  const formattedDate = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  const formattedTime = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const finalString = `${formattedDate}, ${formattedTime}`;

  return (
    <BaseTableCell className="text-futarchyGray11 dark:text-white/70 text-xs">
      {finalString}
    </BaseTableCell>
  );
};

export const AmountCell = ({ amountIn, amountOut }) => (
  <BaseTableCell className="text-futarchyGray12 dark:text-white">
    <div className="flex items-center font-mono">
      <span>{amountOut.token} {amountOut.amount}</span>
      <span className="text-futarchyGray11 dark:text-white/70 mx-2">{'->'}</span>
      <span>{amountIn.token} {amountIn.amount}</span>
    </div>
  </BaseTableCell>
); 