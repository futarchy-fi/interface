'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, LineSeries } from 'lightweight-charts';
import { useSubgraphData } from '../../hooks/useSubgraphData';
import { formatWith } from '../../utils/precisionFormatter';

/**
 * SubgraphChart - A chart component that fetches data from The Graph subgraphs
 * 
 * Styled identically to TripleChart for visual consistency.
 * Uses same colors (blue YES, yellow NO), same container styling, same fonts.
 */

const LoadingSpinner = () => (
    <div className="w-4 h-4 border-2 border-futarchyGray11 dark:border-futarchyGray112 border-t-transparent rounded-full animate-spin" />
);

const ParameterCard = ({ label, value, valueClassName = '', isDisabled = false }) => (
    <div
        className={`flex-1 flex flex-col items-center justify-center text-center border-r-2 border-futarchyGray62 dark:border-futarchyGray112/40 last:border-r-0 first:rounded-tl-3xl last:rounded-tr-3xl px-1 ${isDisabled ? 'opacity-40' : ''}`}
    >
        <span className="text-[9px] md:text-xs text-futarchyGray11 dark:text-white/70 font-medium">{label}</span>
        <span className={`text-[9px] md:text-sm font-bold text-futarchyGray12 dark:text-white ${valueClassName}`}>{value}</span>
    </div>
);

const SubgraphChart = ({
    proposalId,
    chainId = 100,
    height = 448,
    candleLimit = 500,
    config = null,
    autoResyncInterval = 10, // Auto-resync every X seconds (configurable)
}) => {
    const chartContainerRef = useRef(null);
    const chartInstanceRef = useRef(null);
    const [containerWidth, setContainerWidth] = useState(0);
    const [isDarkMode, setIsDarkMode] = useState(
        () => typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
    );

    // Countdown state for auto-resync
    const [countdown, setCountdown] = useState(autoResyncInterval);
    const countdownRef = useRef(null);

    // Fetch data from subgraph
    const {
        yesData,
        noData,
        yesPrice,
        noPrice,
        yesPool,
        noPool,
        hasData,
        loading,
        error,
        refetch,
        lastUpdated
    } = useSubgraphData(proposalId, chainId, candleLimit);

    // Auto-resync countdown effect - uses silent mode for smooth updates
    useEffect(() => {
        // Reset countdown when component mounts
        setCountdown(autoResyncInterval);

        // Start countdown timer
        countdownRef.current = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    // Time to resync! Use silent=true for smooth update without flicker
                    refetch(true);
                    return autoResyncInterval;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (countdownRef.current) {
                clearInterval(countdownRef.current);
            }
        };
    }, [autoResyncInterval, refetch]);

    // Get precision config from props or use default
    const precisionConfig = config?.PRECISION_CONFIG;
    const dynamicPrecision = precisionConfig?.display?.price || config?.precisions?.main || 4;


    // Dark mode observer
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const observer = new MutationObserver((mutationsList) => {
            for (let mutation of mutationsList) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const currentMode = document.documentElement.classList.contains('dark');
                    setIsDarkMode(currentMode);
                }
            }
        });

        observer.observe(document.documentElement, { attributes: true });

        return () => observer.disconnect();
    }, []);

    // Container resize observer
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const resizeObserver = new ResizeObserver((entries) => {
            if (entries[0]) {
                setContainerWidth(entries[0].contentRect.width);
            }
        });

        if (chartContainerRef.current) {
            resizeObserver.observe(chartContainerRef.current);
            setContainerWidth(chartContainerRef.current.clientWidth);
        }

        return () => resizeObserver.disconnect();
    }, []);

    // Chart creation and data update
    useEffect(() => {
        if (!chartContainerRef.current || containerWidth === 0 || !hasData) {
            return;
        }

        // Clean up previous chart
        if (chartInstanceRef.current) {
            chartInstanceRef.current.remove();
            chartInstanceRef.current = null;
        }

        // Same colors as TripleChart
        const backgroundColor = isDarkMode ? 'transparent' : 'rgb(249, 249, 249)';
        const textColor = isDarkMode ? 'rgb(220, 220, 220)' : '#333333';
        const crosshairColor = isDarkMode ? 'rgba(200, 200, 200, 0.3)' : 'rgba(51, 51, 51, 0.3)';
        const borderColor = isDarkMode ? 'transparent' : 'rgb(249, 249, 249)';

        const chart = createChart(chartContainerRef.current, {
            width: containerWidth,
            height: height,
            layout: {
                background: { type: 'solid', color: backgroundColor },
                textColor: textColor,
                fontFamily: 'Arial, sans-serif',
            },
            grid: {
                vertLines: { color: 'rgba(0, 0, 0, 0)' },
                horzLines: { color: 'rgba(0, 0, 0, 0)' },
            },
            crosshair: {
                vertLine: {
                    width: 1,
                    color: crosshairColor,
                    style: 0,
                },
                horzLine: {
                    width: 1,
                    color: crosshairColor,
                    style: 0,
                },
            },
            timeScale: {
                borderColor: borderColor,
                timeVisible: true,
                secondsVisible: false,
                rightOffset: 0,
                tickMarkFormatter: (time) => {
                    const date = new Date(time * 1000);
                    const now = new Date();
                    const isToday = date.getDate() === now.getDate() &&
                        date.getMonth() === now.getMonth() &&
                        date.getFullYear() === now.getFullYear();

                    if (isToday) {
                        return date.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                        });
                    }

                    return date.toLocaleDateString([], {
                        day: '2-digit',
                        month: '2-digit'
                    }) + ' ' + date.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    });
                },
            },
            rightPriceScale: {
                borderColor: borderColor,
                borderVisible: false,
            },
            leftPriceScale: {
                borderColor: borderColor,
                visible: false,
                borderVisible: false,
            },
        });

        chartInstanceRef.current = chart;

        // Same price format as TripleChart
        const priceFormat = {
            type: 'price',
            precision: dynamicPrecision,
            minMove: Math.pow(10, -dynamicPrecision),
        };

        // Create YES line - SAME BLUE as TripleChart: rgb(0, 144, 255)
        const yesLine = chart.addSeries(LineSeries, {
            color: 'rgb(0, 144, 255)',
            lineWidth: 2,
            title: 'YES',
            priceFormat: priceFormat,
        });

        // Create NO line - SAME YELLOW as TripleChart: rgb(245, 196, 0)
        const noLine = chart.addSeries(LineSeries, {
            color: 'rgb(245, 196, 0)',
            lineWidth: 2,
            title: 'NO',
            priceFormat: priceFormat,
        });

        // Set data
        if (yesData && yesData.length > 0) {
            yesLine.setData(yesData);
        }
        if (noData && noData.length > 0) {
            noLine.setData(noData);
        }

        // Fit content
        chart.timeScale().fitContent();

        // Cleanup
        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.remove();
                chartInstanceRef.current = null;
            }
        };
    }, [containerWidth, height, isDarkMode, hasData, yesData, noData, dynamicPrecision]);

    // Calculate impact - same formula as ChartParameters
    let impact = 0;
    if (yesPrice !== null && noPrice !== null) {
        const denominator = Math.max(yesPrice, noPrice);
        impact = denominator > 0 ? ((yesPrice - noPrice) / denominator) * 100 : 0;
    }
    const impactColorClass = impact >= 0 ? '!text-futarchyTeal7' : '!text-futarchyCrimson7';

    // Get currency from config
    const currency = config?.BASE_TOKENS_CONFIG?.currency?.symbol || 'sDAI';
    const companySymbol = config?.BASE_TOKENS_CONFIG?.company?.symbol || 'TOKEN';
    const tradingPair = `${companySymbol}/${currency}`;

    return (
        // Same container styling as TripleChart parent in MarketPageShowcase
        <div className="bg-futarchyGray3 dark:bg-futarchyDarkGray3 rounded-3xl border-2 border-futarchyGray62 dark:border-futarchyGray11/70 overflow-hidden flex flex-col">

            {/* Header - Same styling as ChartParameters container */}
            <div className="h-16 bg-futarchyGray2 dark:bg-futarchyDarkGray2 border-b-2 border-futarchyGray62 dark:border-futarchyGray11/70">
                <div className="flex items-stretch justify-around font-oxanium h-full">
                    {/* Trading Pair - with SUBGRAPH badge */}
                    <div className="flex-1 flex flex-col items-center justify-center text-center border-r-2 border-futarchyGray62 dark:border-futarchyGray112/40 first:rounded-tl-3xl px-1">
                        <span className="text-[9px] md:text-xs text-futarchyGray11 dark:text-white/70 font-medium flex items-center gap-1">
                            Trading Pair
                            <span className="text-[8px] bg-futarchyViolet9/20 dark:bg-futarchyViolet7/20 text-futarchyViolet9 dark:text-futarchyViolet7 px-1 rounded">SUBGRAPH</span>
                        </span>
                        <span className="text-[9px] md:text-sm font-bold text-futarchyGray12 dark:text-white">{tradingPair}</span>
                    </div>

                    {/* Yes Price - SAME BLUE color as ChartParameters */}
                    <ParameterCard
                        label="Yes Price"
                        value={yesPrice === null ? <LoadingSpinner /> : `${formatWith(yesPrice, 'price', precisionConfig)} ${currency}`}
                        valueClassName="!text-futarchyBlue9 dark:!text-futarchyBlue8"
                    />

                    {/* No Price - SAME YELLOW color as ChartParameters */}
                    <ParameterCard
                        label="No Price"
                        value={noPrice === null ? <LoadingSpinner /> : `${formatWith(noPrice, 'price', precisionConfig)} ${currency}`}
                        valueClassName="!text-yellow-500 dark:!text-yellow-400"
                    />

                    {/* Impact - SAME styling as ChartParameters */}
                    <div className="flex-1 flex flex-col items-center justify-center text-center border-r-2 border-futarchyGray62 dark:border-futarchyGray112/40 last:border-r-0 last:rounded-tr-3xl px-1">
                        <span className="text-[9px] md:text-xs text-futarchyGray11 dark:text-white/70 font-medium">Impact</span>
                        <span className={`text-[9px] md:text-sm font-bold text-futarchyGray12 dark:text-white ${impactColorClass}`}>
                            {(yesPrice === null || noPrice === null) ? <LoadingSpinner /> : `${formatWith(impact, 'default', precisionConfig)}%`}
                        </span>
                    </div>

                    {/* Resync Button with Countdown */}
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-2 last:rounded-tr-3xl">
                        <button
                            onClick={() => {
                                refetch(false); // Manual click shows loading
                                setCountdown(autoResyncInterval);
                            }}
                            disabled={loading}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] md:text-xs font-medium rounded-lg transition-all
                ${loading
                                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                                    : 'bg-futarchyViolet9/10 dark:bg-futarchyViolet7/10 text-futarchyViolet9 dark:text-futarchyViolet7 hover:bg-futarchyViolet9/20 dark:hover:bg-futarchyViolet7/20'
                                }`}
                        >
                            <svg
                                className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            {loading ? 'Syncing...' : `Resync (${countdown}s)`}
                        </button>
                    </div>
                </div>
            </div>

            {/* Chart Area - Same styling as TripleChart container */}
            <div className="py-4 bg-futarchyGray3 dark:bg-futarchyDarkGray3 flex-grow overflow-hidden" style={{ height: `${height}px` }}>
                <div className="w-full h-full flex flex-col relative">
                    {/* Loading overlay */}
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-black/50 z-10">
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 border-2 border-futarchyViolet9 dark:border-futarchyViolet7 border-t-transparent rounded-full animate-spin" />
                                <span className="text-sm text-gray-600 dark:text-gray-400 font-oxanium">Loading from subgraph...</span>
                            </div>
                        </div>
                    )}

                    {/* Error state */}
                    {error && !loading && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center p-4">
                                <div className="text-red-500 dark:text-red-400 text-sm mb-2 font-oxanium">Error loading data</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">{error}</div>
                                <button
                                    onClick={refetch}
                                    className="text-xs px-3 py-1.5 bg-futarchyViolet9/10 text-futarchyViolet9 dark:text-futarchyViolet7 rounded-lg hover:bg-futarchyViolet9/20 font-oxanium"
                                >
                                    Try Again
                                </button>
                            </div>
                        </div>
                    )}

                    {/* No data state */}
                    {!loading && !error && !hasData && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center p-4">
                                <div className="text-gray-500 dark:text-gray-400 text-sm mb-2 font-oxanium">No candle data available</div>
                                <div className="text-xs text-gray-400 dark:text-gray-500">
                                    Candles are created when swaps occur in the pool
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Chart container */}
                    <div
                        ref={chartContainerRef}
                        className="w-full h-full"
                        style={{ visibility: hasData ? 'visible' : 'hidden' }}
                    />
                </div>
            </div>

            {/* Footer with pool info and data stats */}
            <div className="px-4 py-2 border-t border-futarchyGray62 dark:border-futarchyGray11/70 bg-futarchyGray2/50 dark:bg-futarchyDarkGray2/50">
                <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 font-oxanium">
                    <span className="flex items-center gap-4">
                        {yesPool && <span>YES: {yesPool.name}</span>}
                        {noPool && <span>NO: {noPool.name}</span>}
                    </span>
                    <span className="flex items-center gap-3">
                        <span>Data: YES ({yesData?.length || 0}) | NO ({noData?.length || 0})</span>
                        {lastUpdated && <span>Updated: {lastUpdated.toLocaleDateString([], { month: 'short', day: 'numeric' })} {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default SubgraphChart;
