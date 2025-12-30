
"use client";

import React from "react";

import { MARKET_HERO_MESSAGES } from "@/config/messages";
import { useMarketService } from "@/hooks/useMarketService";
import { MarketModel } from "@/services/MarketService";
import clsx from "clsx";

import { MOCK_CONFIG } from "@/config/mocks";

import { useParams } from "next/navigation";

import { useMarketPrice } from "@/hooks/useMarketPrice";

export const MarketHeroWidget = () => {
    const { proposalId } = useParams();
    const id = (proposalId as string) || MOCK_CONFIG.MARKET.DEFAULT_ID;

    const { getMarket } = useMarketService("");
    const [market, setMarket] = React.useState<MarketModel | null>(null);

    const [error, setError] = React.useState<string | null>(null);

    const { yesPrice, noPrice, prediction, lastUpdated, isLoading: isPriceLoading } = useMarketPrice({
        yesPool: market?.yesPoolAddress,
        noPool: market?.noPoolAddress,
        tokens: {
            yesCompany: market?.tokens?.yesCompany,
            noCompany: market?.tokens?.noCompany,
            yesCurrency: market?.tokens?.yesCurrency,
            noCurrency: market?.tokens?.noCurrency
        },
        interval: 15000, // 15s polling
        priority: 'METADATA' // Hero prefers rich Supabase metadata
    });

    React.useEffect(() => {
        const fetch = async () => {
            try {
                console.log("Fetching market:", id);
                const data = await getMarket(id, 'METADATA');
                if (!data) {
                    setError("Market data not found (null returned)");
                } else {
                    setMarket(data);
                }
            } catch (err: any) {
                console.error("MarketHero fetch error:", err);
                setError(err.message || "Unknown fetch error");
            }
        };
        fetch();
    }, [id, getMarket]);

    if (error) return <div className="text-red-500 p-4 border border-red-500 bg-red-900/20 rounded m-4">Error loading market: {error}</div>;
    if (!market) return <div className="text-white p-10 text-center animate-pulse">Loading Market Data...</div>;

    const lastUpdatedLabel = lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'Never';

    return (
        <div className="relative bg-[#191919]/90 backdrop-blur-sm font-oxanium flex flex-col border-b-2 border-[#2A2A2A] transition-all duration-300 ease-in-out h-auto lg:h-full w-full">
            <div className="container mx-auto px-5 flex-grow flex flex-col justify-center">
                <div className="grid grid-cols-1 lg:grid-cols-3 transition-all duration-300 ease-in-out py-8 lg:py-12">
                    {/* Left & Middle Section: Title + Stats */}
                    <div className="lg:col-span-2 space-y-3 py-4 lg:space-y-4 border-b-2 border-[#2A2A2A] lg:border-b-0 lg:border-r lg:pr-6 transition-all duration-300 ease-in-out lg:py-6">

                        <div className="flex items-center gap-3">
                            {/* Title (Dynamic) */}
                            <h1 className="font-semibold text-white leading-tight min-h-[1.5rem] transition-all duration-300 ease-in-out text-xl lg:text-3xl flex-1">
                                {market.displayTitle0 ? (
                                    <>
                                        <span>{market.displayTitle0} </span>
                                        <span className="text-[#B27CFA]">{market.displayTitle1}</span>
                                    </>
                                ) : (
                                    <span className="whitespace-nowrap">{market.name || "Unnamed Market"}</span>
                                )}
                            </h1>

                            {/* RTC Status Badge */}
                            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-md">
                                <div className={clsx("w-1.5 h-1.5 rounded-full bg-emerald-500", isPriceLoading && "animate-pulse")} />
                                <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">RTC</span>
                                <span className="text-[10px] text-slate-500 font-mono">{lastUpdatedLabel}</span>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-y-4 text-left transition-all duration-300 ease-in-out">

                            {/* Impact -> Prediction */}
                            <div className="flex items-center gap-2">
                                <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white/70">
                                    <path fill="currentColor" d="M97.594 11.22c48.787 64.184 76.194 134.662 96.812 220.093H117.03l12.47 15.25 28.438 34.78 94.437 118.25 23.313-29.437 101.03-123.594 12.47-15.25h-74.782C335.026 145.88 362.43 75.405 411.22 11.22h-79.5C289.51 81.954 276.86 157.277 266.03 250h83.75l-96.655 118.25L156.437 250h86.25c-10.64-92.823-25.208-168.993-66.875-238.78H97.594zm4.875 362.56c-6.58 1.665-12.87 3.424-18.814 5.283-21.64 6.766-38.845 14.815-50 23.062-11.154 8.247-15.562 15.873-15.562 22.47 0 6.595 4.408 14.22 15.562 22.467 11.155 8.247 28.36 16.296 50 23.063 43.278 13.533 104.154 22.125 171.375 22.125 67.223 0 128.098-8.592 171.376-22.125 21.64-6.767 38.846-14.816 50-23.063 11.155-8.246 15.563-15.872 15.563-22.468s-4.41-14.222-15.564-22.47c-11.154-8.246-28.36-16.295-50-23.062-5.944-1.858-12.233-3.617-18.812-5.28 18.853 9.14 29.844 20.06 29.844 31.812 0 32.066-81.665 58.062-182.407 58.062-100.74 0-182.405-25.996-182.405-58.062 0-11.75 10.99-22.673 29.844-31.813zm63.936 5.72c-4.875 1.173-9.513 2.437-13.812 3.78-12.82 4.01-22.933 8.807-29.156 13.408-6.224 4.6-7.907 8.205-7.907 10.593 0 2.39 1.684 5.994 7.907 10.595 6.224 4.6 16.336 9.397 29.157 13.406 25.642 8.02 62.127 13.19 102.437 13.19 40.31 0 76.828-5.17 102.47-13.19 12.82-4.008 22.902-8.804 29.125-13.405 6.223-4.6 7.906-8.205 7.906-10.594 0-2.387-1.682-5.992-7.905-10.592-6.223-4.6-16.304-9.398-29.125-13.407-4.308-1.346-8.956-2.605-13.844-3.78 8.692 4.787 13.688 10.355 13.688 16.28 0 17.987-45.808 32.564-102.313 32.564-56.504 0-102.31-14.577-102.31-32.563 0-5.923 5.002-11.494 13.686-16.28z"></path>
                                </svg>
                                <div className="flex flex-col items-start">
                                    <span className="text-sm lg:text-base font-semibold text-[#00A89D]">
                                        {prediction !== null ? `${prediction.toFixed(1)}%` : '--'}
                                    </span>
                                    <span className="text-xs text-white/70">Prediction</span>
                                </div>
                            </div>

                            {/* Yes Pool */}
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                <div className="flex flex-col items-start">
                                    <span className="text-sm lg:text-base font-semibold text-blue-400">
                                        {yesPrice !== null ? `$${yesPrice.toFixed(2)}` : '--'}
                                    </span>
                                    <span className="text-xs text-white/70">YES Pool</span>
                                </div>
                            </div>

                            {/* No Pool */}
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                                <div className="flex flex-col items-start">
                                    <span className="text-sm lg:text-base font-semibold text-yellow-400">
                                        {noPrice !== null ? `$${noPrice.toFixed(2)}` : '--'}
                                    </span>
                                    <span className="text-xs text-white/70">NO Pool</span>
                                </div>
                            </div>

                            {/* Active Status */}
                            <div className="flex items-center gap-2">
                                <svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white/70">
                                    <g><path fill="currentColor" d="M246,43.7c0-18.6-15.1-33.7-33.7-33.7H43.7C25.1,10,10,25.1,10,43.7v168.6c0,18.6,15.1,33.7,33.7,33.7 h168.6c18.6,0,33.7-15.1,33.7-33.7V43.7z M31.8,31.8c3.2-3.2,7.5-5,12-4.9h168.5c9.3,0,16.9,7.6,16.9,16.9c0,0,0,0,0,0v75.9 c0,0,0,0,0,0h-13.3l-14.4-14.4c-3.3-3.3-8.6-3.3-11.9,0c-0.9,0.9-1.6,2.1-2,3.3L177,139.8l-24.6-49.3c-2.1-4.2-7.1-5.8-11.3-3.8 c-1.8,0.9-3.3,2.5-4.1,4.4l-24.6,61.4l-27-94.3c-1.3-4.5-5.9-7.1-10.4-5.8c-2.3,0.6-4.2,2.2-5.2,4.3l-31.4,62.8l-11.7,0V43.7 C26.8,39.3,28.6,35,31.8,31.8z M224.2,224.2c-3.2,3.2-7.4,4.9-11.9,4.9H43.8c-4.5,0-8.8-1.7-12-4.9s-5-7.4-5-11.9v-75.9l16.9,0 c3.2,0,6.1-1.8,7.5-4.7l24-48l27.8,97.2c1,3.5,4.1,5.9,7.7,6.1c0.1,0,0.3,0,0.4,0c3.4,0,6.5-2.1,7.8-5.3l26.8-66.9l25.3,50.7 c2.1,4.2,7.1,5.8,11.3,3.8c2-1,3.5-2.8,4.2-4.9l12.6-37.7l7.3,7.3c1.6,1.6,3.7,2.5,6,2.5h16.8c0,0,0,0,0,0v75.9 C229.2,216.8,227.4,221.1,224.2,224.2L224.2,224.2z"></path></g>
                                </svg>
                                <div className="flex flex-col items-start">
                                    <span className="text-sm lg:text-base font-semibold text-[#25D7AB]">{market.isOpen ? MARKET_HERO_MESSAGES.LABELS.ACTIVE : 'Closed'}</span>
                                    <span className="text-xs text-white/70">{MARKET_HERO_MESSAGES.LABELS.STATUS}</span>
                                </div>
                            </div>

                            {/* Remaining Time */}
                            <div className="flex items-center gap-2">
                                <svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white/70">
                                    <g><g><g><path fill="currentColor" d="M117.2,10.4C95.4,12.5,74.6,20.6,56.7,34C50.9,38.3,38.3,50.8,34,56.6c-19.2,25.8-27.3,57.4-22.7,88.6c2.9,19.6,10.7,38,22.7,54.1c6.2,8.3,20.2,21.7,24.7,23.9c4.5,2.2,10.3-1.6,10.3-6.7c0-2.7-1.3-4.5-6.6-8.9c-42.7-35.8-50.1-96.9-17.1-141.5C49.8,60,60,49.8,66.2,45.3c27.4-20.3,62.4-26,94.5-15.2c34.8,11.6,61.2,41.4,68.5,77.2c11.8,58.6-27.8,114.6-87.1,123.1c-2,0.3-8.3,0.7-13.9,0.8c-9.3,0.3-10.3,0.4-11.5,1.3c-2,1.5-3,3.1-3.3,5.4c-0.3,2.7,0.7,5,2.9,6.6l1.8,1.3h9.9c11.8,0,18.7-0.9,28.9-3.5c15.5-3.9,29.5-10.7,42.6-20.4c5.6-4.2,18.2-16.8,22.5-22.5c14.9-19.9,22.9-42.5,23.9-67.1c1.2-26.8-7.3-53.6-23.9-75.8c-4.2-5.7-16.8-18.3-22.5-22.5C175.5,16.2,146,7.7,117.2,10.4z"></path><path fill="currentColor" d="M117.6,54.8c-1.9,0.8-3.8,3.2-4.2,5c-0.1,0.8-0.2,18.7-0.1,39.8l0.1,38.3l1.2,1.6c0.9,1.2,7.3,5.1,24.7,15.2c23,13.3,23.5,13.6,26.1,13.6c2.1,0,2.9-0.2,4.2-1.2c3.3-2.5,4.1-7.1,1.7-10.1c-0.8-1.1-7.5-5.2-22.1-13.6l-20.9-12.1L128,95.1l-0.2-36.2l-1.2-1.6C124.4,54.5,120.8,53.5,117.6,54.8z"></path><path fill="currentColor" d="M88.1,231.9c-1.9,0.8-3.8,3.2-4.2,5.1c-0.5,2.7,0.2,4.8,2.1,6.7c3.1,3.1,7.1,3.1,10.1,0C101.9,238,95.5,228.7,88.1,231.9z"></path></g></g></g>
                                </svg>
                                <div className="flex flex-col items-start">
                                    <span className="text-sm lg:text-base font-semibold text-[#DDAA00]">15d 4h</span>
                                    <span className="text-xs text-white/70">{MARKET_HERO_MESSAGES.LABELS.REMAINING_TIME}</span>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-3 transition-all duration-300 ease-in-out">
                            <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:items-center">
                                <span className="h-7 py-1 px-3 text-sm font-semibold rounded-lg border-2 flex items-center justify-center gap-1 transition-colors duration-200 whitespace-nowrap bg-transparent text-[#25D7AB] border-[#25D7AB] hover:bg-[#25D7AB] hover:text-[#191919]">
                                    <span className="whitespace-nowrap">{MARKET_HERO_MESSAGES.LABELS.ACTIVE}</span>
                                </span>
                                <button className="h-7 py-1 px-3 text-sm font-semibold rounded-lg border-2 flex items-center justify-center gap-1 transition-colors duration-200 whitespace-nowrap bg-transparent text-white border-white hover:bg-white hover:text-black cursor-pointer animate-subtle-pulse drop-shadow-[0_0_2px_rgba(255,255,255,0.4)]">
                                    <span className="whitespace-nowrap">{MARKET_HERO_MESSAGES.LABELS.PREDICTION_MARKET}</span>
                                </button>
                                <a href="#" className="h-7 py-1 px-3 text-sm font-semibold rounded-lg border-2 flex items-center justify-center gap-1 transition-colors duration-200 whitespace-nowrap bg-transparent text-[#B27CFA] border-[#B27CFA] hover:bg-[#B27CFA] hover:text-black cursor-pointer animate-subtle-pulse drop-shadow-[0_0_2px_rgba(255,255,255,0.4)]">
                                    <span className="whitespace-nowrap">{MARKET_HERO_MESSAGES.LABELS.RESOLVE_QUESTION}</span>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block ml-1 opacity-70">
                                        <path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                                    </svg>
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Right Section: Description */}
                    <div className="lg:col-span-1 transition-all duration-300 ease-in-out py-4 lg:py-6 lg:pl-6 text-left">
                        <div className="transition-all duration-300 ease-in-out">
                            <p className="text-xs lg:text-sm text-white/70 leading-relaxed">
                                {market.description}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Mobile Scroll Down (Hidden on LG) */}
                <div className="absolute bottom-4 lg:hidden animate-bounce w-full">
                    <div className="flex flex-col items-center text-white justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-6 w-6">
                            <path fillRule="evenodd" clipRule="evenodd" d="M11.25 20V4H12.75V20H11.25Z" fill="currentColor"></path>
                            <path fillRule="evenodd" clipRule="evenodd" d="M4.99999 11.9393L12 18.9393L19 11.9393L20.0607 13L12 21.0607L3.93933 13L4.99999 11.9393Z" fill="currentColor"></path>
                        </svg>
                        <span className="text-xs mt-1">{MARKET_HERO_MESSAGES.LABELS.SCROLL_DOWN}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
