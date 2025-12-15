import React from "react";

// Chain configuration mapping
const CHAIN_CONFIG = {
  1: {
    name: "Ethereum",
    shortName: "ETH",
    color: "bg-blue-100 dark:bg-blue-900/30",
    borderColor: "border-blue-300 dark:border-blue-700",
    textColor: "text-blue-700 dark:text-blue-400",
  },
  100: {
    name: "Gnosis Chain",
    shortName: "Gnosis",
    color: "bg-emerald-100 dark:bg-emerald-900/30",
    borderColor: "border-emerald-300 dark:border-emerald-700",
    textColor: "text-emerald-700 dark:text-emerald-400",
  },
  137: {
    name: "Polygon",
    shortName: "Polygon",
    color: "bg-purple-100 dark:bg-purple-900/30",
    borderColor: "border-purple-300 dark:border-purple-700",
    textColor: "text-purple-700 dark:text-purple-400",
  },
  42161: {
    name: "Arbitrum",
    shortName: "Arbitrum",
    color: "bg-cyan-100 dark:bg-cyan-900/30",
    borderColor: "border-cyan-300 dark:border-cyan-700",
    textColor: "text-cyan-700 dark:text-cyan-400",
  },
  10: {
    name: "Optimism",
    shortName: "Optimism",
    color: "bg-red-100 dark:bg-red-900/30",
    borderColor: "border-red-300 dark:border-red-700",
    textColor: "text-red-700 dark:text-red-400",
  },
};

const ChainBadge = ({ chainId, className = "", size = "sm" }) => {
  const chainConfig = CHAIN_CONFIG[chainId] || {
    name: `Chain ${chainId}`,
    shortName: `Chain ${chainId}`,
    color: "bg-gray-100 dark:bg-gray-900/30",
    borderColor: "border-gray-300 dark:border-gray-700",
    textColor: "text-gray-700 dark:text-gray-400",
  };

  const sizeClasses = {
    xs: "px-1.5 py-0.5 text-[10px]",
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
    lg: "px-3 py-1.5 text-base",
  };

  return (
    <div
      className={`
        w-fit rounded-full border font-medium
        ${chainConfig.color}
        ${chainConfig.borderColor}
        ${chainConfig.textColor}
        ${sizeClasses[size]}
        ${className}
      `}
      title={chainConfig.name}
    >
      {chainConfig.shortName}
    </div>
  );
};

export default ChainBadge;
