import React from "react";
import { X, Search } from "lucide-react";

export type Token = {
    symbol: string;
    name: string;
    type: 'COLLATERAL' | 'COMPANY' | 'OUTCOME';
    iconColor: string;
};

interface TokenSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (token: Token) => void;
    tokens: Token[]; // Now mandatory
    validTokens?: string[]; // New prop for filtering
}

export const TokenSelector: React.FC<TokenSelectorProps> = ({ isOpen, onClose, onSelect, tokens, validTokens }) => {
    if (!isOpen) return null;

    // Filter tokens if validTokens is provided
    const displayedTokens = validTokens
        ? tokens.filter(t => validTokens.includes(t.symbol))
        : tokens;

    return (
        <div className="absolute inset-0 z-20 bg-slate-900 rounded-3xl p-4 flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-bold">Select Token</h3>
                <button type="button" onClick={onClose} className="p-1 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                    <X size={20} />
                </button>
            </div>

            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                    type="text"
                    placeholder="Search name or symbol"
                    className="w-full bg-slate-800 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {displayedTokens.map((token) => (
                    <button
                        type="button"
                        key={token.symbol}
                        onClick={() => {
                            onSelect(token);
                            onClose();
                        }}
                        className="w-full p-3 flex items-center justify-between rounded-xl hover:bg-slate-800 transition-colors group text-left"
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full ${token.iconColor} flex items-center justify-center text-[10px] font-bold text-white shadow-lg`}>
                                {token.symbol.substring(0, 2)}
                            </div>
                            <div>
                                <p className="text-white font-bold text-sm">{token.symbol}</p>
                                <p className="text-slate-500 text-[10px] group-hover:text-slate-400 uppercase tracking-wider">{token.name}</p>
                            </div>
                        </div>
                        {/* Mock Balance */}
                        <div className="text-right">
                            <p className="text-white font-mono text-sm">0.00</p>
                        </div>
                    </button>
                ))}
                {displayedTokens.length === 0 && (
                    <div className="text-center text-slate-500 mt-10">
                        No valid tokens for this pair.
                    </div>
                )}
            </div>
        </div>
    );
};
