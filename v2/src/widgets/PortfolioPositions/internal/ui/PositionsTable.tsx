"use client";

import React from "react";
import { Position } from "../../types";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import clsx from "clsx";

import { PORTFOLIO_MESSAGES } from "@/config/messages";

interface InternalProps {
    positions: Position[];
    isLoading: boolean;
}

export const PositionsTableUI: React.FC<InternalProps> = ({ positions, isLoading }) => {
    if (isLoading) {
        return (
            <div className="w-full h-64 flex items-center justify-center text-slate-500 animate-pulse">
                {PORTFOLIO_MESSAGES.LOADING}
            </div>
        );
    }

    return (
        <div className="w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-gradient-to-r from-slate-900 via-slate-900 to-slate-900/50">
                <h2 className="text-xl font-bold text-white">{PORTFOLIO_MESSAGES.HEADERS.TITLE}</h2>
                <div className="flex gap-4 text-sm">
                    <div className="text-slate-400">{PORTFOLIO_MESSAGES.HEADERS.TOTAL_VALUE} <span className="text-white font-mono">$1,950.00</span></div>
                    <div className="text-slate-400">{PORTFOLIO_MESSAGES.HEADERS.TOTAL_PNL} <span className="text-emerald-400 font-mono">+$100.00</span></div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800/60 bg-slate-900/30">
                            <th className="p-4 font-medium">{PORTFOLIO_MESSAGES.HEADERS.MARKET}</th>
                            <th className="p-4 font-medium">{PORTFOLIO_MESSAGES.HEADERS.SIDE}</th>
                            <th className="p-4 font-medium text-right">{PORTFOLIO_MESSAGES.HEADERS.AVG_PRICE}</th>
                            <th className="p-4 font-medium text-right">{PORTFOLIO_MESSAGES.HEADERS.CURRENT}</th>
                            <th className="p-4 font-medium text-right">{PORTFOLIO_MESSAGES.HEADERS.VALUE}</th>
                            <th className="p-4 font-medium text-right">{PORTFOLIO_MESSAGES.HEADERS.PNL}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                        {positions.map((pos, index) => (
                            <motion.tr
                                key={pos.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="group hover:bg-slate-800/30 transition-colors"
                            >
                                <td className="p-4 font-medium text-slate-200">{pos.marketName}</td>
                                <td className="p-4">
                                    <span className={clsx(
                                        "px-2 py-0.5 rounded text-xs font-bold uppercase",
                                        pos.side === 'YES' ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                                    )}>
                                        {pos.side}
                                    </span>
                                </td>
                                <td className="p-4 text-right text-slate-400 font-mono">${pos.avgPrice.toFixed(2)}</td>
                                <td className="p-4 text-right text-white font-mono">${pos.currentPrice.toFixed(2)}</td>
                                <td className="p-4 text-right text-white font-mono">${pos.value.toFixed(2)}</td>
                                <td className={clsx("p-4 text-right font-mono flex items-center justify-end gap-1", pos.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                                    {pos.pnl >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                    {pos.pnl >= 0 ? "+" : ""}{pos.pnl.toFixed(1)}%
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
