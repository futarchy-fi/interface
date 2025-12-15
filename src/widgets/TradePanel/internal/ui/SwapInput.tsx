import React from "react";
import { ChevronDown } from "lucide-react";

interface SwapInputProps {
    label: string;
    amount: string;
    onChange: (val: string) => void;
    tokenSymbol: string;
    // Simple icon placeholder logic for now
    tokenIcon?: React.ReactNode;
    onMax?: () => void;
    onTokenClick?: () => void;
    balance?: string;
    readOnly?: boolean;
}

export const SwapInput: React.FC<SwapInputProps> = ({
    label,
    amount,
    onChange,
    tokenSymbol,
    tokenIcon,
    onMax,
    onTokenClick,
    balance,
    readOnly
}) => {
    return (
        <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800 focus-within:border-blue-500/50 hover:border-slate-700 transition-all">
            <div className="flex justify-between mb-2">
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{label}</span>
                {balance && (
                    <div className="flex gap-2 text-xs">
                        <span className="text-slate-500">Balance: {balance}</span>
                        {onMax && (
                            <button type="button" onClick={onMax} className="text-blue-400 hover:text-white font-bold uppercase">
                                Max
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="flex items-center gap-4">
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="0.0"
                    readOnly={readOnly}
                    className="w-full bg-transparent text-3xl font-mono text-white placeholder-slate-600 focus:outline-none"
                />

                <button
                    type="button"
                    onClick={onTokenClick}
                    disabled={!onTokenClick}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors ${onTokenClick ? 'bg-slate-800 hover:bg-slate-700 text-white cursor-pointer' : 'bg-transparent text-slate-300 cursor-default'
                        }`}
                >
                    {tokenIcon && <span className="w-5 h-5 flex items-center justify-center">{tokenIcon}</span>}
                    <span className="font-bold text-lg">{tokenSymbol}</span>
                    {onTokenClick && <ChevronDown size={16} className="text-slate-400" />}
                </button>
            </div>

            <div className="h-4 mt-1 flex justify-between text-slate-500 text-xs">
                {/* Placeholder for USD valuation */}
                <span>{amount ? `$${(parseFloat(amount) * 1.0).toFixed(2)}` : '$0.00'}</span>
            </div>
        </div>
    );
};
