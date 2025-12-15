"use client";

import React, { useMemo } from "react";
import { Briefcase, Layers } from "lucide-react";
import { useEventBus } from "@/core/bus";
import { usePositionService } from "@/hooks/usePositionService";
import { MARKET_PULSE_MESSAGES } from "@/config/messages";
import clsx from "clsx";

export const MarketPulseWidget = () => {
    const { emit } = useEventBus();
    const { positions } = usePositionService();

    // Group logic to find mergeable sets
    // Assumption: PositionModel has a way to identify the underlying pair.
    // For now, we'll parse the symbol or ID.
    // Enhanced Logic: Group by market/collateral
    const groupedPositions = useMemo(() => {
        const groups: Record<string, { yes: number, no: number }> = {};

        positions.forEach(p => {
            // Mock grouping key extraction (e.g. from "YES_sDAI" -> "sDAI")
            // This is fragile and should be robust in real app
            const symbol = p.tokenSymbol ? p.tokenSymbol.replace('YES_', '').replace('NO_', '') : 'sDAI';

            if (!groups[symbol]) groups[symbol] = { yes: 0, no: 0 };
            if (p.side === 'YES') groups[symbol].yes += p.shares;
            if (p.side === 'NO') groups[symbol].no += p.shares;
        });

        return Object.entries(groups).map(([symbol, { yes, no }]) => {
            const mergeable = Math.min(yes, no);
            const net = yes - no;
            const side = net > 0 ? 'YES' : net < 0 ? 'NO' : null;
            return {
                symbol,
                mergeable,
                netAmount: Math.abs(net),
                side
            };
        }).filter(p => p.netAmount > 0 || p.mergeable > 0);
    }, [positions]);

    const handleMerge = (amount: number, symbol: string) => {
        emit('market:transaction:open', {
            amount: amount.toFixed(2),
            side: 'MERGE',
            mode: 'MERGE',
            payToken: symbol,
            splitAmount: 0,
        });
    };

    return (
        <div className="w-full h-full p-6 bg-slate-900/40 rounded-3xl border border-slate-800 backdrop-blur-sm flex flex-col relative overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 z-10">
                <h3 className="text-slate-400 font-medium flex items-center gap-2">
                    <Briefcase size={16} className="text-blue-500" />
                    {MARKET_PULSE_MESSAGES.HEADER}
                </h3>
            </div>

            {/* Content List */}
            <div className="flex-1 flex flex-col gap-4 z-10 overflow-y-auto pr-2">

                {groupedPositions.map((pos) => (
                    <div key={pos.symbol} className="flex flex-col gap-2">
                        {/* Net Position Card */}
                        {pos.side && (
                            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col gap-1">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">{MARKET_PULSE_MESSAGES.NET_EXPOSURE}</span>
                                    <span className="text-[10px] text-slate-600 font-bold bg-slate-800 px-2 py-0.5 rounded-full">{pos.symbol}</span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className={clsx("text-2xl font-bold", pos.side === 'YES' ? 'text-emerald-400' : 'text-red-400')}>
                                        {pos.netAmount.toFixed(2)}
                                    </span>
                                    <span className="text-sm font-bold text-slate-400">{pos.side}</span>
                                </div>
                            </div>
                        )}

                        {/* Mergeable Card (Per Asset) */}
                        {pos.mergeable > 0.01 && (
                            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex justify-between items-center">
                                <div>
                                    <div className="text-[10px] text-indigo-300 font-bold uppercase">{MARKET_PULSE_MESSAGES.MERGEABLE}</div>
                                    <div className="text-sm font-bold text-white">{pos.mergeable.toFixed(2)} {MARKET_PULSE_MESSAGES.PAIRS} ({pos.symbol})</div>
                                </div>
                                <button
                                    onClick={() => handleMerge(pos.mergeable, pos.symbol)}
                                    className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                                >
                                    <Layers size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                ))}

            </div>
        </div>
    );
};
