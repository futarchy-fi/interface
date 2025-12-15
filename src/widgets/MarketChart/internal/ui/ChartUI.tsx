"use client";

import React from "react";
import { MarketPoint, MarketChartProps } from "../../types";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface InternalProps {
    data: MarketPoint[];
    isLoading: boolean;
}

export const ChartUI: React.FC<InternalProps> = ({ data, isLoading }) => {
    if (isLoading) {
        return (
            <div className="w-full h-80 flex items-center justify-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800 animate-pulse">
                Loading Market Data...
            </div>
        );
    }

    return (
        <div className="w-full h-[500px] p-6 rounded-3xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-2xl flex flex-col">
            <div className="mb-6 flex justify-between items-center gap-4 overflow-x-auto no-scrollbar whitespace-nowrap">
                <div className="min-w-fit">
                    <h3 className="text-xl font-bold text-white">Conditional Prices</h3>
                    <p className="text-sm text-slate-400">Projected price of Token if Proposal Passes vs Fails</p>
                </div>
                <div className="flex gap-4 min-w-fit">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                        <span className="text-sm text-slate-300">If YES</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-red-500"></span>
                        <span className="text-sm text-slate-300">If NO</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorYes" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorNo" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} domain={[0, 1]} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                            itemStyle={{ fontSize: '12px' }}
                            labelStyle={{ color: '#94a3b8', marginBottom: '8px' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="priceYes"
                            stroke="#10b981"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorYes)"
                            name="Price (YES)"
                        />
                        <Area
                            type="monotone"
                            dataKey="priceNo"
                            stroke="#ef4444"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorNo)"
                            name="Price (NO)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
