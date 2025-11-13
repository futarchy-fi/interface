import React, { useMemo } from "react";
import './shared/MarketPanels.css';

const MetricDisplay = ({ label, leftData, rightData }) => (
  <div className="flex flex-col gap-1">
    <div className="text-sm font-semibold">{label}</div>
    <div className="flex flex-col md:flex-row gap-1 md:gap-2 items-start md:items-center">
      <div className="text-base font-medium">{leftData}</div>
      <div className="text-xs font-medium">{rightData || "--"}</div>
    </div>
  </div>
);

const ConditionalMarketInfoPanel = ({ selectedMarket }) => {
  const { approval, refusal, base } = selectedMarket;
  
  const impactValue = useMemo(
    () => approval.marketValue - refusal.marketValue,
    [approval.marketValue, refusal.marketValue]
  );

  const impactPercentage = useMemo(() => {
    const value = ((impactValue / base.marketValue) * 100).toFixed(2);
    return `${value}%`;
  }, [impactValue, base.marketValue]);

  const impactType = impactValue > 0 ? 'positive' : 'negative';

  return (
    <div className="activity-panel">
      <div className="market-panel-header">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-medium uppercase text-black">Market Overview</h2>
        </div>
      </div>
      <div className="market-panel-content">
        <div className="market-metrics">
          <MetricDisplay 
            label="Approval Market Value" 
            value={approval.marketValue} 
            secondaryValue={approval.symbol}
          />
          <MetricDisplay 
            label="Refusal Market Value" 
            value={refusal.marketValue}
            secondaryValue={refusal.symbol}
          />
          <MetricDisplay 
            label="Base Market Value" 
            value={base.marketValue}
            secondaryValue={base.symbol}
          />
          <MetricDisplay 
            label="Impact" 
            value={impactPercentage}
            secondaryValue={impactValue}
            type={impactType}
          />
        </div>
      </div>
    </div>
  );
};

export default ConditionalMarketInfoPanel;
