"use client";


import React, { useState, useEffect } from "react";
import { MOCK_CONFIG } from "@/config/mocks";
import { useMarketService } from "@/hooks/useMarketService";
import { ChartUI } from "./internal/ui/ChartUI";
import { MarketPoint, MarketChartProps } from "./types";
import { MARKET_CHART_MESSAGES } from "@/config/messages";
import { StatsUI } from "./internal/ui/StatsUI";
import { ActivityUI } from "./internal/ui/ActivityUI";

export const MarketChartWidget: React.FC<MarketChartProps> = ({ proposalId }) => {
    const { getMarketHistory } = useMarketService(MOCK_CONFIG.MARKET.DEFAULT_ID);
    const [data, setData] = useState<MarketPoint[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                // Cast to any[] then map until types are strictly defined
                const history = await getMarketHistory(proposalId);
                setData(history as any[]);
            } catch (error) {
                console.error("Failed to fetch market history:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (proposalId) {
            loadData();
        }
    }, [proposalId]);

    return (
        <div className="w-full bg-slate-900/40 rounded-3xl border border-slate-800 p-6 backdrop-blur-sm">
            <h3 className="text-slate-400 font-medium mb-4">{MARKET_CHART_MESSAGES.TITLE}</h3>
            <ChartUI data={data} isLoading={isLoading} />
        </div>
    );
};

export const MarketStatsWidget = () => <StatsUI />;
export const MarketActivityWidget = () => <ActivityUI />;

