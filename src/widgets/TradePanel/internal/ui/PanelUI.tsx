"use client";

import React, { useState, useEffect } from "react";
import { ArrowDown, Settings, ChevronDown, AlertTriangle } from "lucide-react";
import clsx from "clsx";
import { SwapInput } from "./SwapInput";
import { TokenSelector, TOKENS, Token } from "./TokenSelector";
import { TRADE_MESSAGES } from "@/config/messages";

interface InternalProps {
    proposalId: string;
    onRequestTrade: (details: any) => void;
    isTrading: boolean;
    executor: any;
}

// Configuration Types
type TradeAction = 'BUY' | 'SELL';
type TradeOutcome = 'YES' | 'NO';
type MarketType = 'PREDICTION' | 'EXPECTED_VALUE' | 'CONDITIONAL';

// GRAPH: Key = Source, Value = Valid Destinations
const SWAP_GRAPH: Record<string, string[]> = {
    'sDAI': ['YES_sDAI', 'NO_sDAI', 'YES_NVDA', 'NO_NVDA'],
    'YES_sDAI': ['sDAI', 'YES_NVDA'], // Can swap back to sDAI OR to Company (Conditional)
    'NO_sDAI': ['sDAI', 'NO_NVDA'],
    'YES_NVDA': ['YES_sDAI', 'sDAI'],
    'NO_NVDA': ['NO_sDAI', 'sDAI'],
    'NVDA': []
};

// Initial Balances state
const INITIAL_BALANCES: Record<string, number> = {
    'sDAI': 0, 'YES_sDAI': 0, 'NO_sDAI': 0,
    'YES_NVDA': 0, 'NO_NVDA': 0, 'NVDA': 0
};

export const TradePanelUI: React.FC<InternalProps> = ({ proposalId, onRequestTrade, isTrading, executor }) => {
    // Balances State
    const [balances, setBalances] = useState<Record<string, number>>(INITIAL_BALANCES);
    // User Address (Mock for now, will come from wallet hook later)
    const USER_ADDRESS = "0x645A3D9208523bbFEE980f7269ac72C61Dd3b552"; // User's specific address

    useEffect(() => {
        if (!executor) return;

        const fetchBalances = async () => {
            try {
                // Parallel fetch for known tokens
                const tokens = Object.keys(INITIAL_BALANCES);
                const results = await Promise.all(tokens.map(async (token) => {
                    const bal = await executor.run('market.getBalance', { token, user: USER_ADDRESS });
                    // Format from 18 decimals (simple / 1e18) for UI display
                    return { token, val: parseFloat(bal.toString()) / 1e18 };
                }));

                const newBalances = { ...INITIAL_BALANCES };
                results.forEach(({ token, val }) => { newBalances[token] = val; });
                setBalances(newBalances);
            } catch (err) {
                console.warn("[TradePanel] Failed to fetch balances", err);
            }
        };

        fetchBalances();
        // Poll every 10s
        const interval = setInterval(fetchBalances, 10000);
        return () => clearInterval(interval);
    }, [executor]);
    // Intent State (Visual / High Level)
    const [action, setAction] = useState<TradeAction>('BUY');
    const [outcome, setOutcome] = useState<TradeOutcome>('YES');
    const [marketType, setMarketType] = useState<MarketType>('PREDICTION');

    // Token State (Source of Truth)
    const [inputValue, setInputValue] = useState<string>('');
    const [inputType, setInputType] = useState<'PAY' | 'RECEIVE'>('PAY'); // Track which input user is typing

    const [payToken, setPayToken] = useState<Token>(TOKENS[0]); // sDAI
    const [receiveToken, setReceiveToken] = useState<Token>(TOKENS[2]); // YES_sDAI

    // Manual Selector State
    const [selectorOpen, setSelectorOpen] = useState<'PAY' | 'RECEIVE' | null>(null);

    // derived amounts state
    const [quoteAmount, setQuoteAmount] = useState<string>('');

    // Debounce Quote Fetching
    useEffect(() => {
        if (!executor || !inputValue || parseFloat(inputValue) === 0) {
            setQuoteAmount('');
            return;
        }

        const timeout = setTimeout(async () => {
            try {
                const q = await executor.run('market.getQuote', {
                    amountIn: inputValue,
                    tokenIn: inputType === 'PAY' ? payToken.symbol : receiveToken.symbol, // Direction logic handled in cartridge or here
                    tokenOut: inputType === 'PAY' ? receiveToken.symbol : payToken.symbol
                });
                setQuoteAmount(q);
            } catch (e) {
                console.error(e);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timeout);
    }, [inputValue, inputType, payToken, receiveToken, executor]);

    // Derived Amounts for Display
    let amountPay = '';
    let amountReceive = '';

    if (inputType === 'PAY') {
        amountPay = inputValue;
        amountReceive = quoteAmount;
    } else {
        amountReceive = inputValue;
        amountPay = quoteAmount;
    }

    const handlePayChange = (val: string) => {
        setInputValue(val);
        setInputType('PAY');
    };

    const handleReceiveChange = (val: string) => {
        setInputValue(val);
        setInputType('RECEIVE');
    };

    const handleIntentChange = (newAction: TradeAction, newMarket: MarketType, newOutcome: TradeOutcome) => {
        setAction(newAction);
        setMarketType(newMarket);
        setOutcome(newOutcome);

        // Derive Tokens
        const sDAI = TOKENS.find(t => t.symbol === 'sDAI')!;
        let pair: [Token, Token] | null = null;

        if (newMarket === 'PREDICTION') {
            const target = newOutcome === 'YES' ? 'YES_sDAI' : 'NO_sDAI';
            pair = [sDAI, TOKENS.find(t => t.symbol === target)!];
        } else if (newMarket === 'EXPECTED_VALUE') {
            const target = newOutcome === 'YES' ? 'YES_NVDA' : 'NO_NVDA';
            pair = [sDAI, TOKENS.find(t => t.symbol === target)!];
        } else if (newMarket === 'CONDITIONAL') {
            const currencySide = newOutcome === 'YES' ? 'YES_sDAI' : 'NO_sDAI';
            const companySide = newOutcome === 'YES' ? 'YES_NVDA' : 'NO_NVDA';
            pair = [TOKENS.find(t => t.symbol === currencySide)!, TOKENS.find(t => t.symbol === companySide)!];
        }

        if (pair) {
            if (newAction === 'BUY') {
                setPayToken(pair[0]);
                setReceiveToken(pair[1]);
            } else {
                setPayToken(pair[1]);
                setReceiveToken(pair[0]);
            }
        }
    };

    const handleManualTokenSelect = (token: Token) => {
        if (selectorOpen === 'PAY') {
            setPayToken(token);
            // Check if current Receive is valid
            const validDests = SWAP_GRAPH[token.symbol] || [];
            if (!validDests.includes(receiveToken.symbol)) {
                // Invalid pair! Reset Receive to first valid option
                const firstValid = TOKENS.find(t => t.symbol === validDests[0]);
                if (firstValid) setReceiveToken(firstValid);
            }
        } else if (selectorOpen === 'RECEIVE') {
            setReceiveToken(token);
            // Pay doesn't change, we just ensured filtering prevented invalid picks
        }
        setSelectorOpen(null);
    };

    const getValidTokens = () => {
        if (selectorOpen === 'RECEIVE') {
            return SWAP_GRAPH[payToken.symbol]; // Strict filtering based on Pay
        }
        // For Pay, we allow anything (user starts new path)
        return undefined;
    };

    const handleSwapInputs = () => {
        // 1. Swap Tokens
        const oldPay = payToken;
        const oldReceive = receiveToken;

        // Force Swap (Skip Graph Validation for UI responsiveness)
        setPayToken(oldReceive);
        setReceiveToken(oldPay);

        // 2. Auto-Update Action (Visual)
        // If we are now paying with sDAI, we are BUYING.
        // If we are paying with an Outcome, we are SELLING.
        if (oldReceive.symbol === 'sDAI') {
            setAction('BUY');
        } else if (oldReceive.type === 'OUTCOME') {
            setAction('SELL');
        }

        // 3. Swap Amounts & Reset Type
        // Keep active value
        setInputValue(amountReceive || amountPay);
        setInputType('PAY');
        setSelectorOpen(null); // Close any open selector
    };

    const getSmartBalance = (token: Token) => {
        const direct = balances[token.symbol] || 0;
        const collateral = balances['sDAI'] || 0;
        const isOutcome = token.type === 'OUTCOME';

        if (isOutcome && collateral > 0) {
            return `${direct.toFixed(2)} (+${collateral.toFixed(2)} sDAI)`;
        }
        return direct.toFixed(2);
    };

    // Derived Balances
    const payBalanceDisplay = getSmartBalance(payToken);
    const receiveBalanceDisplay = getSmartBalance(receiveToken);

    // Smart Balance Logic (for Split check)
    const directBalance = balances[payToken.symbol] || 0;
    const collateralBalance = balances['sDAI'] || 0;
    const isOutcomeToken = payToken.type === 'OUTCOME';
    const totalMaxBalance = isOutcomeToken ? directBalance + collateralBalance : directBalance;

    const numericAmountPay = parseFloat(amountPay) || 0;
    const isSplitting = isOutcomeToken && numericAmountPay > directBalance && numericAmountPay <= totalMaxBalance;
    const splitAmount = isSplitting ? numericAmountPay - directBalance : 0;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (isSplitting) {
            // Split Mode: Just mint the tokens
            onRequestTrade({
                amount: splitAmount.toFixed(2), // Send ONLY the difference
                side: 'SPLIT',
                payToken: payToken.symbol,
                mode: 'SPLIT',
                splitAmount: splitAmount
            });
        } else {
            // Swap Mode: Normal trade
            onRequestTrade({
                amount: amountPay,
                side: receiveToken.symbol,
                payToken: payToken.symbol,
                mode: 'SWAP', // Explicit Swap Mode
                splitAmount: 0,
                exactOutput: inputType === 'RECEIVE' // Optional flag for backend
            });
        }
    };

    const tokenIcon = (token: Token) => (
        <div className={clsx("w-6 h-6 rounded-full flex items-center justify-center font-bold text-[8px] border border-white/10 shadow-sm",
            token.iconColor
        )}>
            {token.symbol.substring(0, 2)}
        </div>
    );

    return (
        <div className="w-full h-full flex flex-col relative">
            <div className="p-6 rounded-3xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-2xl relative overflow-hidden flex-1 flex flex-col">

                {/* 1. Header & Buy/Sell Toggle */}
                <div className="flex justify-between items-start mb-6">
                    <div className="bg-slate-950/50 p-1 rounded-xl border border-slate-800 flex gap-1">
                        <button
                            onClick={() => handleIntentChange('BUY', marketType, outcome)}
                            className={clsx("px-6 py-2 rounded-lg font-bold text-sm transition-all shadow-sm",
                                action === 'BUY' ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/50" : "text-slate-500 hover:text-white"
                            )}
                        >
                            {TRADE_MESSAGES.ACTIONS.BUY}
                        </button>
                        <button
                            onClick={() => handleIntentChange('SELL', marketType, outcome)}
                            className={clsx("px-6 py-2 rounded-lg font-bold text-sm transition-all shadow-sm",
                                action === 'SELL' ? "bg-red-500/10 text-red-500 border border-red-500/50" : "text-slate-500 hover:text-white"
                            )}
                        >
                            {TRADE_MESSAGES.ACTIONS.SELL}
                        </button>
                    </div>
                </div>

                {/* 2. Configuration Controls */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    {/* Market Type Selector */}
                    <div className="relative group z-40">
                        <label className="text-xs text-slate-500 font-bold ml-1 mb-1 block uppercase tracking-wider">{TRADE_MESSAGES.HEADERS.POOL_TYPE}</label>
                        <button className="w-full flex items-center justify-between bg-slate-950/50 border border-slate-800 p-3 rounded-xl text-white text-xs font-bold group-hover:border-slate-700 transition-colors whitespace-nowrap overflow-hidden">
                            <span className="truncate">
                                {marketType === 'PREDICTION' && TRADE_MESSAGES.OPTIONS.PREDICTION.LABEL}
                                {marketType === 'EXPECTED_VALUE' && TRADE_MESSAGES.OPTIONS.EXPECTED_VALUE.LABEL}
                                {marketType === 'CONDITIONAL' && TRADE_MESSAGES.OPTIONS.CONDITIONAL.LABEL}
                            </span>
                            <ChevronDown size={14} className="text-slate-500 ml-2 flex-shrink-0" />
                        </button>

                        {/* Dropdown */}
                        <div className="absolute top-full left-0 w-full mt-1 bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden hidden group-hover:block pt-1">
                            {[
                                { id: 'PREDICTION', label: TRADE_MESSAGES.OPTIONS.PREDICTION.LABEL, sub: TRADE_MESSAGES.OPTIONS.PREDICTION.SUB },
                                { id: 'EXPECTED_VALUE', label: TRADE_MESSAGES.OPTIONS.EXPECTED_VALUE.LABEL, sub: TRADE_MESSAGES.OPTIONS.EXPECTED_VALUE.SUB },
                                { id: 'CONDITIONAL', label: TRADE_MESSAGES.OPTIONS.CONDITIONAL.LABEL, sub: TRADE_MESSAGES.OPTIONS.CONDITIONAL.SUB }
                            ].map((opt) => (
                                <button
                                    key={opt.id}
                                    onClick={() => handleIntentChange(action, opt.id as MarketType, outcome)}
                                    className="w-full text-left px-4 py-3 text-xs hover:bg-slate-800 text-slate-300 hover:text-white flex flex-col border-b border-slate-800/50 last:border-0"
                                >
                                    <span className="font-bold">{opt.label}</span>
                                    <span className="text-[10px] text-slate-500">{opt.sub}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Outcome Selector */}
                    <div>
                        <label className="text-xs text-slate-500 font-bold ml-1 mb-1 block uppercase tracking-wider">{TRADE_MESSAGES.HEADERS.OUTCOME}</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleIntentChange(action, marketType, 'YES')}
                                className={clsx("flex-1 py-3 rounded-xl border font-bold text-sm flex items-center justify-center gap-2 transition-all",
                                    outcome === 'YES'
                                        ? "bg-slate-800 border-slate-600 text-white shadow-lg"
                                        : "bg-slate-950/50 border-slate-800 text-slate-500 hover:border-slate-700"
                                )}
                            >
                                <div className={clsx("w-2 h-2 rounded-full", outcome === 'YES' ? "bg-emerald-400" : "bg-slate-600")} />
                                {TRADE_MESSAGES.OUTCOMES.YES}
                            </button>
                            <button
                                onClick={() => handleIntentChange(action, marketType, 'NO')}
                                className={clsx("flex-1 py-3 rounded-xl border font-bold text-sm flex items-center justify-center gap-2 transition-all",
                                    outcome === 'NO'
                                        ? "bg-slate-800 border-slate-600 text-white shadow-lg"
                                        : "bg-slate-950/50 border-slate-800 text-slate-500 hover:border-slate-700"
                                )}
                            >
                                <div className={clsx("w-2 h-2 rounded-full", outcome === 'NO' ? "bg-red-400" : "bg-slate-600")} />
                                {TRADE_MESSAGES.OUTCOMES.NO}
                            </button>
                        </div>
                    </div>
                </div>

                {/* 3. Swap Inputs */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-2 relative flex-1">

                    {/* Pay Input */}
                    <div className="relative z-20">
                        <SwapInput
                            label={TRADE_MESSAGES.INPUTS.PAY}
                            amount={amountPay}
                            onChange={handlePayChange}
                            tokenSymbol={payToken.symbol}
                            tokenIcon={tokenIcon(payToken)}
                            onMax={() => {
                                setInputValue(totalMaxBalance.toString());
                                setInputType('PAY');
                            }}
                            balance={payBalanceDisplay}
                            onTokenClick={() => setSelectorOpen('PAY')}
                        />

                        {/* Collateral Info Indicator */}
                        {isOutcomeToken && collateralBalance > 0 && (
                            <div className="flex justify-between items-center px-1 mt-1">
                                <span className="text-[10px] text-slate-500 ml-auto">
                                    {TRADE_MESSAGES.TOOLTIPS.COLLATERAL_AVAILABLE(collateralBalance.toFixed(2))}
                                </span>
                            </div>
                        )}

                        {/* Split Warning */}
                        {isSplitting && (
                            <div className="mt-2 text-[10px] text-blue-400 flex items-center gap-1 bg-blue-500/10 p-2 rounded-lg border border-blue-500/20">
                                <AlertTriangle size={12} />
                                <span>{TRADE_MESSAGES.ERRORS.INSUFFICIENT_DIRECT_BALANCE}</span>
                            </div>
                        )}
                    </div>

                    {/* Switcher Arrow (Relative Flow Layout) */}
                    <div className="relative h-2 -my-5 z-30 flex items-center justify-center pointer-events-none">
                        <button
                            type="button"
                            onClick={handleSwapInputs}
                            className="w-8 h-8 bg-slate-800 border-4 border-[#0F1115] rounded-full flex items-center justify-center text-slate-500 hover:text-white hover:border-slate-700 transition-all shadow-lg active:scale-90 pointer-events-auto"
                        >
                            <ArrowDown size={14} />
                        </button>
                    </div>

                    {/* Receive Input */}
                    <div className="relative z-20 mt-2">
                        <SwapInput
                            label={TRADE_MESSAGES.INPUTS.RECEIVE}
                            amount={amountReceive}
                            onChange={handleReceiveChange}
                            tokenSymbol={receiveToken.symbol}
                            tokenIcon={tokenIcon(receiveToken)}
                            onTokenClick={() => setSelectorOpen('RECEIVE')}
                            readOnly={false}
                            balance={receiveBalanceDisplay}
                        />
                    </div>

                    {/* Action Button */}
                    <button
                        type="submit"
                        disabled={!amountPay}
                        className={clsx(
                            "w-full py-4 mt-auto rounded-xl font-bold text-lg transition-all duration-200 shadow-lg",
                            !amountPay ? "bg-slate-800 text-slate-500 cursor-not-allowed" :
                                isSplitting
                                    ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/20 active:scale-[0.98]" // Split Style
                                    : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20 active:scale-[0.98]" // Swap Style
                        )}
                    >
                        {isSplitting
                            ? TRADE_MESSAGES.LABELS.SPLIT_BUTTON(splitAmount.toFixed(2), 'sDAI')
                            : TRADE_MESSAGES.LABELS.TRADE_BUTTON(action, outcome)
                        }
                    </button>
                </form>

            </div>

            {/* Token Selector Modal */}
            <TokenSelector
                isOpen={!!selectorOpen}
                onClose={() => setSelectorOpen(null)}
                onSelect={handleManualTokenSelect}
                validTokens={getValidTokens()}
            />
        </div>
    );
};
