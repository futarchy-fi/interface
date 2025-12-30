import React from 'react';
import { MARKET_CHART_MESSAGES } from "@/config/messages";

export const StatsUI = () => {
    return (
        <div className="flex overflow-x-auto snap-x snap-mandatory gap-2 mb-6 pb-2 md:grid md:grid-cols-6 md:pb-0 no-scrollbar">
            <div className="min-w-[140px] snap-center bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex flex-col items-center justify-center text-center">
                {/* 1. Trading Pair */}
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">{MARKET_CHART_MESSAGES.STATS.PAIR}</span>
                <span className="text-sm font-bold text-white">GNO/sDAI</span>
            </div>
            <div className="min-w-[140px] snap-center bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex flex-col items-center justify-center text-center">
                {/* 2. Spot Price */}
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">{MARKET_CHART_MESSAGES.STATS.SPOT}</span>
                <span className="text-sm font-bold text-white">103.74 sDAI</span>
            </div>
            <div className="min-w-[140px] snap-center bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-800 transition-colors">
                {/* 3. Yes Price */}
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">{MARKET_CHART_MESSAGES.STATS.YES}</span>
                <span className="text-sm font-bold text-emerald-400">137.12 sDAI</span>
            </div>
            <div className="min-w-[140px] snap-center bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-800 transition-colors">
                {/* 4. No Price */}
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">{MARKET_CHART_MESSAGES.STATS.NO}</span>
                <span className="text-sm font-bold text-red-400">87.64 sDAI</span>
            </div>
            <div className="min-w-[140px] snap-center bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex flex-col items-center justify-center text-center">
                {/* 5. Event Prob */}
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">{MARKET_CHART_MESSAGES.STATS.PROB}</span>
                <span className="text-sm font-bold text-violet-400">24.26%</span>
            </div>
            <div className="min-w-[140px] snap-center bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex flex-col items-center justify-center text-center">
                {/* 6. Impact */}
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">{MARKET_CHART_MESSAGES.STATS.IMPACT}</span>
                <span className="text-sm font-bold text-teal-400">47.70%</span>
            </div>
        </div>
    );
};
