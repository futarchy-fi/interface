"use client";

import React, { useMemo } from "react";
import { Briefcase, Layers } from "lucide-react";
import { useEventBus } from "@/core/bus";
import { usePositionService } from "@/hooks/usePositionService";
import { useMarketService } from "@/hooks/useMarketService";
import { MOCK_CONFIG } from "@/config/mocks";
import { MARKET_PULSE_MESSAGES } from "@/config/messages";
import clsx from "clsx";

interface MarketPulseProps {
    proposalId?: string;
}

export const MarketPulseWidget: React.FC<MarketPulseProps> = ({ proposalId }) => {
    const { emit } = useEventBus();
    const { getMarketPositions } = useMarketService(MOCK_CONFIG.COMPANY.DEFAULT_ID);
    const { positions: allPositions, positionService, userAddress } = usePositionService();
    const [marketPositions, setMarketPositions] = React.useState<any>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);

    React.useEffect(() => {
        const loadBalances = async () => {
            if (!proposalId || !userAddress) return;
            setIsLoading(true);
            try {
                const data = await getMarketPositions(proposalId, userAddress, positionService);
                setMarketPositions(data);
                setLastUpdated(new Date());
            } catch (err) {
                console.error("Failed to fetch market positions:", err);
            } finally {
                setIsLoading(false);
            }
        }
        loadBalances();
        // Refresh periodically - 15s to save server resources
        const interval = setInterval(loadBalances, 15000);
        return () => clearInterval(interval);
    }, [proposalId, userAddress, getMarketPositions, positionService]);

    const handleMerge = (amount: number, symbol: string) => {
        emit('market:transaction:open', {
            amount: amount.toFixed(2),
            side: 'MERGE',
            mode: 'MERGE',
            payToken: symbol,
            splitAmount: 0,
        });
    };

    if (isLoading && !marketPositions) {
        return (
            <div className="w-full h-full p-6 flex items-center justify-center text-slate-500">
                <Layers className="animate-spin mr-2" size={16} />
                Scanning positions...
            </div>
        );
    }

    return (
        <div className="w-full h-full p-6 bg-slate-900/40 rounded-3xl border border-slate-800 backdrop-blur-sm flex flex-col relative overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 z-10">
                <h3 className="text-slate-400 font-medium flex items-center gap-2 text-sm uppercase tracking-widest">
                    <Briefcase size={16} className="text-violet-500" />
                    Portfolio
                </h3>
                {lastUpdated && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/5 border border-emerald-500/10">
                        <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] text-emerald-500 font-black uppercase tracking-tighter">
                            Live · {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                    </div>
                )}
            </div>

            <div className="flex-1 flex flex-col gap-6 z-10 overflow-y-auto pr-2 custom-scrollbar">
                {/* Wallet Balances */}
                <div>
                    <h4 className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-3 opacity-50">Your Wallet</h4>
                    <div className="grid grid-cols-2 gap-3">
                        {marketPositions?.wallet.map((w: any) => (
                            <div key={w.symbol} className="p-3 rounded-2xl bg-white/5 border border-white/5">
                                <p className="text-[10px] text-slate-400 font-bold mb-1">{w.symbol}</p>
                                <p className="text-lg font-black text-white">{w.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Exposure */}
                <div className="flex flex-col gap-3">
                    <h4 className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1 opacity-50">Active Positions</h4>
                    {marketPositions?.positions.map((pos: any, idx: number) => (
                        <div key={`${pos.symbol}-${pos.side}-${idx}`} className="flex flex-col gap-2">
                            {/* Net Card */}
                            {pos.net > 0 && (
                                <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/50 flex flex-col gap-1 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-violet-500/10 transition-colors" />
                                    <div className="flex justify-between items-baseline z-10">
                                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-black">If {pos.side} Receive</span>
                                        <span className="text-[10px] text-violet-400 font-black px-2 py-0.5 rounded-full bg-violet-500/10">{pos.symbol}</span>
                                    </div>
                                    <div className="flex items-baseline gap-2 z-10">
                                        <span className={clsx("text-2xl font-black", pos.side === 'YES' ? 'text-blue-400' : 'text-amber-400')}>
                                            {pos.net.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Mergeable */}
                            {pos.mergeable > 0.001 && pos.side === 'YES' && (
                                <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 flex justify-between items-center group hover:border-violet-500/40 transition-all">
                                    <div>
                                        <div className="text-[9px] text-violet-400 font-black uppercase tracking-tighter mb-0.5">Mergeable Pairs</div>
                                        <div className="text-sm font-black text-white">{pos.mergeable.toLocaleString(undefined, { maximumFractionDigits: 2 })} Pairs ({pos.symbol})</div>
                                    </div>
                                    <button
                                        onClick={() => handleMerge(pos.mergeable, pos.symbol)}
                                        className="p-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-all shadow-lg shadow-violet-900/20"
                                    >
                                        <Layers size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Debug Info */}
                <div className="mt-8 pt-4 border-t border-slate-800">
                    <details className="text-[10px] text-slate-700 font-mono">
                        <summary className="hover:text-slate-500 cursor-pointer">Debug: Connection Details</summary>
                        <div className="mt-2 flex flex-col gap-2">
                            <p>User: {userAddress}</p>
                            <div className="bg-black/20 p-2 rounded">
                                <p className="font-bold text-slate-500 mb-1">Raw Balances Found:</p>
                                {marketPositions?.balances?.map((b: any) => (
                                    <p key={b.id}>{b.tokenSymbol}: {b.shares.toFixed(4)} ({b.id.slice(0, 6)}...)</p>
                                ))}
                                {!marketPositions?.balances?.length && <p>Searching...</p>}
                            </div>
                        </div>
                    </details>
                </div>
            </div>
        </div>
    );
};
