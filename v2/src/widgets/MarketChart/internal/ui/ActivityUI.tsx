import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { ExternalLink, Loader2 } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { MARKET_CHART_MESSAGES } from "@/config/messages";
import { useMarketService } from '@/hooks/useMarketService';
import { MOCK_CONFIG } from '@/config/mocks';

type Tab = 'activity' | 'trades' | 'positions';

interface ActivityUIProps {
    proposalId: string;
}

export const ActivityUI: React.FC<ActivityUIProps> = ({ proposalId }) => {
    const { address: userAddress, isConnected } = useAccount();
    const { openConnectModal } = useConnectModal();
    const [activeTab, setActiveTab] = useState<Tab>('activity');
    const { getTradeHistory, getMarket } = useMarketService(MOCK_CONFIG.MARKET.DEFAULT_ID);
    const [trades, setTrades] = useState<any[]>([]);
    const [market, setMarket] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    useEffect(() => {
        const loadData = async () => {
            if (!proposalId) return;
            setIsLoading(true);
            try {
                const targetAddress = activeTab === 'trades' ? userAddress : undefined;

                // If My Trades is selected but no wallet connected, show empty
                if (activeTab === 'trades' && !userAddress) {
                    setTrades([]);
                    setIsLoading(false);
                    return;
                }

                const [tradesData, marketData] = await Promise.all([
                    getTradeHistory(proposalId, 'HISTORICAL', targetAddress),
                    getMarket(proposalId, 'METADATA')
                ]);
                setTrades(tradesData);
                setMarket(marketData);
                setLastUpdated(new Date());
            } catch (err) {
                console.error("Failed to load trades:", err);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
        const interval = setInterval(loadData, 15000);
        return () => clearInterval(interval);
    }, [proposalId, getTradeHistory, getMarket, activeTab, userAddress]);

    const renderPoolBadge = (poolType: string, outcome: string | null) => {
        const colors: Record<string, string> = {
            'PREDICTION': 'bg-pink-500/10 text-pink-400 border-pink-500/20',
            'EXPECTED_VALUE': 'bg-violet-500/10 text-violet-400 border-violet-500/20',
            'CONDITIONAL': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
        };

        return (
            <div className={clsx("flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-bold tracking-tight uppercase", colors[poolType] || 'bg-slate-800 text-slate-400')}>
                <span>{poolType.replace('_', ' ')}</span>
                {outcome && <span className="opacity-50">|</span>}
                {outcome && <span className={clsx(outcome === 'YES' ? "text-blue-400" : "text-amber-400")}>{outcome}</span>}
            </div>
        );
    };

    return (
        <div className="mt-8">
            {/* Tabs & Live Indicator */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-slate-800">
                <div className="flex flex-row gap-6">
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

                {lastUpdated && (
                    <div className="flex items-center gap-2 pb-3 order-first sm:order-last self-start sm:self-auto">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/5 border border-emerald-500/10">
                            <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[9px] text-emerald-500 font-black uppercase tracking-tighter">
                                Live · {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Content Area */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500">
                    <Loader2 className="animate-spin" size={32} />
                    <span className="text-sm">Loading activity feed...</span>
                </div>
            ) : (activeTab === 'trades' || activeTab === 'positions') && !isConnected ? (
                <div className="text-center py-20 bg-slate-900/20 rounded-xl border border-dashed border-slate-800 flex flex-col items-center gap-4">
                    <p className="text-slate-400 text-sm">Connect your wallet to view your personal activity and positions</p>
                    <button
                        onClick={() => openConnectModal?.()}
                        className="px-6 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-bold text-sm transition-all shadow-lg active:scale-95"
                    >
                        Connect Wallet
                    </button>
                </div>
            ) : trades.length === 0 ? (
                <div className="text-center py-20 bg-slate-900/20 rounded-xl border border-dashed border-slate-800">
                    <p className="text-slate-500 text-sm">No recent activity found for this proposal</p>
                </div>
            ) : (
                <>
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-800">
                                    <th className="py-4 px-6 text-xs text-slate-400 font-semibold uppercase tracking-wider w-[220px]">Context</th>
                                    <th className="py-4 px-6 text-xs text-slate-400 font-semibold uppercase tracking-wider w-[180px]">Volume</th>
                                    <th className="py-4 px-6 text-xs text-slate-400 font-semibold uppercase tracking-wider w-[100px]">Price</th>
                                    <th className="py-4 px-6 text-xs text-slate-400 font-semibold uppercase tracking-wider w-[80px] text-right">Side</th>
                                    <th className="py-4 px-6 text-xs text-slate-400 font-semibold uppercase tracking-wider w-[200px] text-right">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {trades.map((trade) => (
                                    <tr key={trade.id} className="hover:bg-slate-800/30 transition-colors group">
                                        <td className="py-3 px-6">
                                            {renderPoolBadge(trade.poolType, trade.outcome)}
                                        </td>
                                        <td className="py-3 px-6">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-xs text-slate-300 font-medium">
                                                    {trade.amount1.toLocaleString(undefined, { maximumFractionDigits: 4 })} {trade.symbol1}
                                                </span>
                                                <span className="text-[10px] text-slate-500">
                                                    {trade.amount0.toLocaleString(undefined, { maximumFractionDigits: 4 })} {trade.symbol0}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-6">
                                            <span className="text-sm font-bold text-white">
                                                {trade.poolType === 'PREDICTION'
                                                    ? `${(trade.price * 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
                                                    : trade.price.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })
                                                }
                                            </span>
                                        </td>
                                        <td className="py-3 px-6 text-right">
                                            <span className={clsx(
                                                "text-xs font-black px-2 py-0.5 rounded",
                                                trade.side === 'BUY' ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                                            )}>
                                                {trade.side}
                                            </span>
                                        </td>
                                        <td className="py-3 px-6 text-right">
                                            <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
                                                <span>{new Date(trade.timestamp).toLocaleDateString()} {new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                <a href={`https://gnosisscan.io/tx/${trade.txHash.split('_')[0]}`} target="_blank" rel="noopener noreferrer">
                                                    <ExternalLink size={14} className="hover:text-violet-400 cursor-pointer transition-colors" />
                                                </a>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden flex flex-col gap-3">
                        {trades.slice(0, 10).map((trade) => (
                            <div key={`mobile-${trade.id}`} className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-lg">
                                <div className="flex justify-between items-start">
                                    {renderPoolBadge(trade.poolType, trade.outcome)}
                                    <span className="text-[10px] text-slate-500">{new Date(trade.timestamp).toLocaleTimeString()}</span>
                                </div>

                                <div className="flex justify-between items-center bg-slate-950/30 rounded-lg p-3">
                                    <div className="text-left">
                                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">{trade.symbol1}</p>
                                        <p className="text-sm text-slate-200 font-bold">{trade.amount1.toFixed(2)}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Price</p>
                                        <p className="text-sm text-white font-bold">
                                            {trade.poolType === 'PREDICTION'
                                                ? `${(trade.price * 100).toFixed(2)}%`
                                                : trade.price.toFixed(4)
                                            }
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Side</p>
                                        <span className={clsx(
                                            "text-xs font-black px-2 py-0.5 rounded",
                                            trade.side === 'BUY' ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                                        )}>
                                            {trade.side}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
