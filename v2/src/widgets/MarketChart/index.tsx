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
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                // Widget-level Priority: Historical charts MUST use Supabase
                const history = await getMarketHistory(proposalId, 'HISTORICAL');
                setData(history.map((h: any) => ({
                    time: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    priceYes: h.yesPrice || 0,
                    priceNo: h.noPrice || 0,
                    volume: 0 // Volume not yet available in candles
                })));
                setLastUpdated(new Date());
            } catch (error) {
                console.error("Failed to fetch market history:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (proposalId) {
            loadData();
            // Candles are expensive, 15s polling as requested
            const interval = setInterval(loadData, 15000);
            return () => clearInterval(interval);
        }
    }, [proposalId, getMarketHistory]);

    return (
        <div className="w-full bg-slate-900/40 rounded-3xl border border-slate-800 p-6 backdrop-blur-sm">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-slate-400 font-medium">{MARKET_CHART_MESSAGES.TITLE}</h3>
                {lastUpdated && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/5 border border-emerald-500/10">
                        <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] text-emerald-500 font-black uppercase tracking-tighter">
                            Live · {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                    </div>
                )}
            </div>
            <ChartUI data={data} isLoading={isLoading} />
        </div>
    );
};

export const MarketStatsWidget = () => <StatsUI />;
export const MarketActivityWidget: React.FC<{ proposalId: string }> = ({ proposalId }) => <ActivityUI proposalId={proposalId} />;

