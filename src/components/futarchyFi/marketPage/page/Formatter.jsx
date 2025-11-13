import React from 'react';
import { ethers } from 'ethers';
import { formatWith } from '../../../../utils/precisionFormatter';

export const formatNumber = (num) => {
    if (num === null || num === undefined || isNaN(num)) {
        return 'N/A';
    }
    if (num < 1000) {
        return formatWith(num, 'default');
    }
    if (num >= 1000000000) {
        const value = formatWith(num / 1000000000, 'default');
        return (value.endsWith('.0') || value.endsWith('.00') ? value.slice(0, -3) : value) + 'Bil';
    }
    if (num >= 1000000) {
        const value = formatWith(num / 1000000, 'default');
        return (value.endsWith('.0') || value.endsWith('.00') ? value.slice(0, -3) : value) + 'Mil';
    }
    if (num >= 1000) {
        const value = formatWith(num / 1000, 'default');
        return (value.endsWith('.0') || value.endsWith('.00') ? value.slice(0, -3) : value) + 'K';
    }
    return formatWith(num, 'default');
};

// Use the same formatting logic as PoolDataDisplay
export const formatVolume = (volume) => {
    if (!volume) return '0';
    
    let num;
    const volumeStr = volume.toString();
    
    // Check if it's in scientific notation
    if (volumeStr.includes('e') || volumeStr.includes('E')) {
        // For scientific notation, assume it's already in wei and divide by 10^18
        num = parseFloat(volumeStr) / 1e18;
        num = Math.abs(num);
    } else if (volumeStr.includes('.')) {
        // Already decimal format
        num = Math.abs(parseFloat(volumeStr));
    } else {
        // Wei format - use ethers to convert
        try {
            const formatted = ethers.utils.formatUnits(volumeStr, 18);
            num = Math.abs(parseFloat(formatted));
        } catch (e) {
            // If ethers fails, try direct division
            num = Math.abs(parseFloat(volumeStr) / 1e18);
        }
    }
    
    if (num >= 1000000) return `${formatWith(num / 1000000, 'default')}M`;
    if (num >= 1000) return `${formatWith(num / 1000, 'default')}K`;
    if (num < 1) return formatWith(num, 'price'); // Show more decimals for small numbers
    return formatWith(num, 'default');
};

export const formatLiquidity = (amount) => {
    if (!amount) return '0';
    
    // Check if it's already a decimal number (not wei)
    let num;
    if (typeof amount === 'number' || (typeof amount === 'string' && amount.includes('.'))) {
        // Already in decimal format
        num = Math.abs(parseFloat(amount));
    } else {
        // In wei format, convert from 18 decimals
        const formatted = ethers.utils.formatUnits(amount.toString(), 18);
        num = Math.abs(parseFloat(formatted));
    }
    
    if (num >= 1000000) return `${formatWith(num / 1000000, 'default')}M`;
    if (num >= 1000) return `${formatWith(num / 1000, 'default')}K`;
    if (num < 1) return formatWith(num, 'price'); // Show more decimals for small numbers
    return formatWith(num, 'default');
};

export const normalizeTokenAmount = (value) => {
    if (value === null || value === undefined) {
        return 0;
    }

    if (typeof value === 'number') {
        return Math.abs(value);
    }

    const strValue = value.toString();

    if (!strValue) {
        return 0;
    }

    try {
        if (strValue.includes('e') || strValue.includes('E')) {
            // Treat scientific notation as wei and normalize to 18 decimals
            return Math.abs(parseFloat(strValue) / 1e18);
        }

        if (strValue.includes('.')) {
            // Already a decimal formatted number
            return Math.abs(parseFloat(strValue));
        }

        // Assume integer string represents wei
        return Math.abs(parseFloat(ethers.utils.formatUnits(strValue, 18)));
    } catch (_) {
        const fallback = parseFloat(strValue);
        if (Number.isFinite(fallback)) {
            return Math.abs(fallback / 1e18);
        }
        return 0;
    }
};


export const StatDisplay = ({ label, value, valueClassName = 'text-white', Icon, isLoading }) => (
    <div className="flex items-center gap-2">
        {Icon && <Icon className="h-5 w-5 text-white/70" />}
        <div className="flex flex-col items-start">
            <span className={`text-sm lg:text-base font-semibold ${valueClassName}`}>
                {isLoading ? (
                    <div className="flex items-center gap-2">
                        <span className="text-white/60">Loading...</span>
                        <div className="w-3 h-3 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    value
                )}
            </span>
            <span className="text-xs text-white/70">{label}</span>
        </div>
    </div>
);

export const DualStatDisplay = ({ label, yesValue, noValue, Icon, isLoading, formatFunction }) => {
    const formatValue = formatFunction || formatNumber;
    
    return (
        <div className="flex items-center gap-2">
            {Icon && <Icon className="h-5 w-5 text-white/70" />}
            <div className="flex flex-col items-start">
                <div className="text-sm lg:text-base font-semibold flex items-center gap-1">
                    {isLoading ? (
                        <div className="flex items-center gap-2">
                            <span className="text-white/60">Loading...</span>
                            <div className="w-3 h-3 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : (
                        <>
                            <span className="text-futarchyBlue9">{formatValue(yesValue)}</span>
                            <span className="text-white/50">|</span>
                            <span className="text-futarchyGold8">{formatValue(noValue)}</span>
                        </>
                    )}
                </div>
                <span className="text-xs text-white/70">{label}</span>
            </div>
        </div>
    );
};

export const AggregatedStatDisplay = ({
    label,
    yesValue,
    noValue,
    Icon,
    isLoading,
    formatFunction,
    tooltipLabels = { yes: 'YES', no: 'NO' },
    tooltipBreakdown = null
}) => {
    const formatValue = formatFunction || formatNumber;
    const normalizedYes = normalizeTokenAmount(yesValue);
    const normalizedNo = normalizeTokenAmount(noValue);
    const total = normalizedYes + normalizedNo;

    const formattedTotal = formatValue(total);
    const breakdownItems = (tooltipBreakdown && tooltipBreakdown.length > 0
        ? tooltipBreakdown
        : [
            { label: tooltipLabels.yes, value: yesValue, className: 'text-futarchyBlue9' },
            { label: tooltipLabels.no, value: noValue, className: 'text-futarchyGold8' }
        ]
    ).map(item => ({
        label: item.label,
        className: item.className || 'text-white/80',
        value: formatValue(item.value)
    }));

    return (
        <div className="flex items-center gap-2">
            {Icon && <Icon className="h-5 w-5 text-white/70" />}
            <div className="relative group flex flex-col items-start">
                <span className="text-sm lg:text-base font-semibold text-white">
                    {isLoading ? (
                        <div className="flex items-center gap-2">
                            <span className="text-white/60">Loading...</span>
                            <div className="w-3 h-3 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : (
                        <span className="inline-flex items-center gap-1">
                            <span>{formattedTotal}</span>
                            <span className="text-xs text-white/40 transition-colors group-hover:text-white/70">
                                ⓘ
                            </span>
                        </span>
                    )}
                </span>
                <span className="text-xs text-white/70">{label}</span>

                {!isLoading && (
                    <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-max max-w-xs flex-col gap-1 rounded-md border border-white/10 bg-futarchyDarkGray42/95 px-3 py-2 text-xs text-white/80 shadow-lg backdrop-blur-sm transition group-hover:flex">
                        <span className="font-semibold text-white/90">Breakdown</span>
                        {breakdownItems.map((item, index) => (
                            <span key={`${item.label}-${index}`} className="flex items-center justify-between gap-4">
                                <span className="text-white/60">{item.label}</span>
                                <span className={item.className}>{item.value}</span>
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
