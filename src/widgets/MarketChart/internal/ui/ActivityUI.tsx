import React, { useState } from 'react';
import { clsx } from 'clsx';
import { ExternalLink } from 'lucide-react';
import { MARKET_CHART_MESSAGES } from "@/config/messages";

type Tab = 'activity' | 'trades' | 'positions';

export const ActivityUI = () => {
    const [activeTab, setActiveTab] = useState<Tab>('activity');

    return (
        <div className="mt-8">
            {/* Tabs */}
            <div className="flex flex-row gap-6 mb-4 border-b border-slate-800">
                <button
                    onClick={() => setActiveTab('activity')}
                    className={clsx(
                        "pb-3 font-medium transition-colors duration-200 text-sm",
                        activeTab === 'activity' ? "text-violet-400 border-b-2 border-violet-400" : "text-slate-400 hover:text-white"
                    )}
                >
                    Recent Activity
                </button>
                <button
                    onClick={() => setActiveTab('trades')}
                    className={clsx(
                        "pb-3 font-medium transition-colors duration-200 text-sm",
                        activeTab === 'trades' ? "text-violet-400 border-b-2 border-violet-400" : "text-slate-400 hover:text-white"
                    )}
                >
                    My Trades
                </button>
                <button
                    onClick={() => setActiveTab('positions')}
                    className={clsx(
                        "pb-3 font-medium transition-colors duration-200 text-sm",
                        activeTab === 'positions' ? "text-violet-400 border-b-2 border-violet-400" : "text-slate-400 hover:text-white"
                    )}
                >
                    Position
                </button>
            </div>

            {/* Filter */}
            <div className="flex justify-end mb-4">
                <select className="bg-slate-900 border border-slate-700 text-xs rounded-lg px-3 py-1.5 text-slate-300 outline-none focus:border-blue-500/50">
                    <option>{MARKET_CHART_MESSAGES.ACTIVITY.FILTERS.LAST_30}</option>
                    <option>{MARKET_CHART_MESSAGES.ACTIVITY.FILTERS.LAST_60}</option>
                    <option>{MARKET_CHART_MESSAGES.ACTIVITY.FILTERS.LAST_90}</option>
                </select>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-800">
                            <th className="py-4 px-6 text-xs text-slate-400 font-semibold uppercase tracking-wider w-[200px]">{MARKET_CHART_MESSAGES.ACTIVITY.HEADERS.OUTCOME}</th>
                            <th className="py-4 px-6 text-xs text-slate-400 font-semibold uppercase tracking-wider w-[180px]">{MARKET_CHART_MESSAGES.ACTIVITY.HEADERS.AMOUNT}</th>
                            <th className="py-4 px-6 text-xs text-slate-400 font-semibold uppercase tracking-wider w-[100px] text-right">{MARKET_CHART_MESSAGES.ACTIVITY.HEADERS.PRICE}</th>
                            <th className="py-4 px-6 text-xs text-slate-400 font-semibold uppercase tracking-wider w-[220px] text-right">{MARKET_CHART_MESSAGES.ACTIVITY.HEADERS.DATE}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <tr key={i} className="hover:bg-slate-800/30 transition-colors group">
                                <td className="py-3 px-6">
                                    <div className="flex items-center gap-2">
                                        <div className="flex rounded-md overflow-hidden text-xs font-bold border border-slate-700">
                                            <div className="bg-blue-500/20 text-blue-400 px-2 py-1 border-r border-slate-700">YES</div>
                                            <div className="bg-emerald-500/20 text-emerald-400 px-2 py-1">BUY</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-3 px-6">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-xs text-slate-300 font-medium">100.00 YES_sDAI</span>
                                        <span className="text-[10px] text-slate-500">0.50 YES_GNO out</span>
                                    </div>
                                </td>
                                <td className="py-3 px-6 text-right">
                                    <span className="text-sm font-mono text-blue-400">137.4{i}</span>
                                </td>
                                <td className="py-3 px-6 text-right">
                                    <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
                                        <span>12/12 10:2{i}</span>
                                        <ExternalLink size={14} className="hover:text-slate-300 cursor-pointer" />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View (Netflix-style Scroll) */}
            <div className="md:hidden flex gap-3 overflow-x-auto pb-4 px-1 snap-x snap-mandatory no-scrollbar">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={`mobile-${i}`} className="min-w-[280px] snap-center bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-lg">
                        <div className="flex justify-between items-start">
                            <div className="flex rounded-md overflow-hidden text-xs font-bold border border-slate-700">
                                <div className="bg-blue-500/20 text-blue-400 px-2 py-1 border-r border-slate-700">YES</div>
                                <div className="bg-emerald-500/20 text-emerald-400 px-2 py-1">BUY</div>
                            </div>
                            <span className="text-xs text-slate-500">12/12 10:2{i}</span>
                        </div>

                        <div className="flex justify-between items-center bg-slate-950/30 rounded-lg p-2">
                            <span className="text-xs text-slate-400">Amount</span>
                            <div className="text-right">
                                <p className="text-sm text-slate-200 font-bold">100.00 YES_sDAI</p>
                                <p className="text-[10px] text-slate-500">0.50 YES_GNO out</p>
                            </div>
                        </div>

                        <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-400">Price</span>
                            <span className="text-sm font-mono text-blue-400">137.4{i}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>

    );
};
