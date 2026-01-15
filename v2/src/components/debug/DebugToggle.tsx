
"use client";

import React, { useState, useEffect } from "react";
import { Database, Zap, Settings } from "lucide-react";
import clsx from "clsx";

import { discoveryOrchestrator, ProviderType } from "@/data/DiscoveryOrchestrator";

export const DebugToggle = () => {
    const [priority, setPriority] = useState<ProviderType[]>(['SUPABASE', 'RPC']);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        setPriority(discoveryOrchestrator.getPriority());
    }, []);

    const setPreset = (preset: ProviderType[]) => {
        discoveryOrchestrator.setPriority(preset);
        setPriority(preset);
        window.location.reload();
    };

    const isExactPreset = (preset: ProviderType[]) =>
        priority.length === preset.length && priority.every((v, i) => v === preset[i]);

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
            {isOpen && (
                <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 p-2 rounded-2xl shadow-2xl flex flex-col gap-1 animate-in slide-in-from-bottom-2">
                    <div className="px-3 py-1 text-[10px] text-slate-500 font-bold uppercase tracking-wider border-b border-slate-800 mb-1">
                        Data Source Priority
                    </div>

                    {/* Supabase First */}
                    <button
                        onClick={() => setPreset(['SUPABASE', 'RPC'])}
                        className={clsx(
                            "flex items-center justify-between gap-4 px-4 py-2 rounded-xl text-xs font-bold transition-all text-left",
                            isExactPreset(['SUPABASE', 'RPC']) ? "bg-indigo-500/10 text-indigo-500" : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <Database size={14} /> Supabase First
                        </div>
                        {isExactPreset(['SUPABASE', 'RPC']) && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                    </button>

                    {/* RPC First */}
                    <button
                        onClick={() => setPreset(['RPC', 'SUPABASE'])}
                        className={clsx(
                            "flex items-center justify-between gap-4 px-4 py-2 rounded-xl text-xs font-bold transition-all text-left",
                            isExactPreset(['RPC', 'SUPABASE']) ? "bg-emerald-500/10 text-emerald-500" : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <Zap size={14} /> RPC First
                        </div>
                        {isExactPreset(['RPC', 'SUPABASE']) && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                    </button>

                    <div className="h-px bg-slate-800 my-1 mx-2" />

                    {/* RPC Only */}
                    <button
                        onClick={() => setPreset(['RPC'])}
                        className={clsx(
                            "flex items-center justify-between gap-4 px-4 py-2 rounded-xl text-xs font-bold transition-all text-left",
                            isExactPreset(['RPC']) ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <Zap size={14} /> RPC Only
                        </div>
                        {isExactPreset(['RPC']) && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                    </button>

                    {/* Supabase Only */}
                    <button
                        onClick={() => setPreset(['SUPABASE'])}
                        className={clsx(
                            "flex items-center justify-between gap-4 px-4 py-2 rounded-xl text-xs font-bold transition-all text-left",
                            isExactPreset(['SUPABASE']) ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/20" : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <Database size={14} /> Supabase Only
                        </div>
                        {isExactPreset(['SUPABASE']) && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                    </button>
                </div>
            )}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                    "w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-90 border",
                    isOpen ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                )}
            >
                <Settings size={20} className={clsx(isOpen && "rotate-90 transition-transform duration-300")} />
            </button>
        </div>
    );
};
