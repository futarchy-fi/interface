import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MarketStatsDebugToast = ({ prices, positions, newYesPrice, newNoPrice, contractConfig }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [exportStatus, setExportStatus] = useState('');

    const formatValue = (value, isPrice = false, isAddress = false) => {
        if (value === null || typeof value === 'undefined') {
            return isPrice ? 'N/A' : 'null';
        }
        if (typeof value === 'number') {
            return value.toFixed(6);
        }
        if (typeof value === 'object') {
            return JSON.stringify(value, null, 2);
        }
        // Format Ethereum addresses
        if (isAddress && typeof value === 'string' && value.startsWith('0x') && value.length === 42) {
            return `${value.slice(0, 6)}...${value.slice(-4)}`;
        }
        return String(value);
    };

    const isEthereumAddress = (value) => {
        return typeof value === 'string' && value.startsWith('0x') && value.length === 42;
    };

    const handleAddressClick = (address) => {
        if (isEthereumAddress(address)) {
            // Determine block explorer based on chain ID
            const chainId = contractConfig?.chainId || 100; // Default to Gnosis
            let explorerUrl;

            switch (chainId) {
                case 1: // Ethereum Mainnet
                    explorerUrl = `https://etherscan.io/address/${address}`;
                    break;
                case 137: // Polygon
                    explorerUrl = `https://polygonscan.com/address/${address}`;
                    break;
                case 100: // Gnosis Chain
                default:
                    explorerUrl = `https://gnosisscan.io/address/${address}`;
                    break;
            }

            window.open(explorerUrl, '_blank', 'noopener,noreferrer');
        }
    };

    const handleExportToClipboard = async () => {
        try {
            const exportData = {
                timestamp: new Date().toISOString(),
                proposalId: contractConfig?.proposalId || null,
                marketAddress: contractConfig?.MARKET_ADDRESS || null,
                pools: {
                    yesPool: {
                        address: contractConfig?.POOL_CONFIG_YES?.address || null,
                        tokenCompanySlot: contractConfig?.POOL_CONFIG_YES?.tokenCompanySlot ?? null,
                        inverted: contractConfig?.POOL_CONFIG_YES?.tokenCompanySlot === 1
                    },
                    noPool: {
                        address: contractConfig?.POOL_CONFIG_NO?.address || null,
                        tokenCompanySlot: contractConfig?.POOL_CONFIG_NO?.tokenCompanySlot ?? null,
                        inverted: contractConfig?.POOL_CONFIG_NO?.tokenCompanySlot === 1
                    },
                    predictionPools: {
                        yes: {
                            address: contractConfig?.PREDICTION_POOLS?.yes?.address || null,
                            tokenBaseSlot: contractConfig?.PREDICTION_POOLS?.yes?.tokenBaseSlot ?? null,
                            inverted: contractConfig?.PREDICTION_POOLS?.yes?.tokenBaseSlot === 0
                        },
                        no: {
                            address: contractConfig?.PREDICTION_POOLS?.no?.address || null,
                            tokenBaseSlot: contractConfig?.PREDICTION_POOLS?.no?.tokenBaseSlot ?? null,
                            inverted: contractConfig?.PREDICTION_POOLS?.no?.tokenBaseSlot === 0
                        }
                    }
                },
                tokens: {
                    conditionalTokens: {
                        [contractConfig?.MERGE_CONFIG?.currencyPositions?.yes?.wrap?.tokenSymbol || 'YES_Currency']: contractConfig?.MERGE_CONFIG?.currencyPositions?.yes?.wrap?.wrappedCollateralTokenAddress || null,
                        [contractConfig?.MERGE_CONFIG?.currencyPositions?.no?.wrap?.tokenSymbol || 'NO_Currency']: contractConfig?.MERGE_CONFIG?.currencyPositions?.no?.wrap?.wrappedCollateralTokenAddress || null,
                        [contractConfig?.MERGE_CONFIG?.companyPositions?.yes?.wrap?.tokenSymbol || 'YES_Company']: contractConfig?.MERGE_CONFIG?.companyPositions?.yes?.wrap?.wrappedCollateralTokenAddress || null,
                        [contractConfig?.MERGE_CONFIG?.companyPositions?.no?.wrap?.tokenSymbol || 'NO_Company']: contractConfig?.MERGE_CONFIG?.companyPositions?.no?.wrap?.wrappedCollateralTokenAddress || null
                    },
                    baseTokens: {
                        currency: {
                            symbol: contractConfig?.BASE_TOKENS_CONFIG?.currency?.symbol || null,
                            address: contractConfig?.BASE_TOKENS_CONFIG?.currency?.address || null
                        },
                        company: {
                            symbol: contractConfig?.BASE_TOKENS_CONFIG?.company?.symbol || null,
                            address: contractConfig?.BASE_TOKENS_CONFIG?.company?.address || null
                        }
                    }
                },
                contracts: {
                    futarchyRouter: contractConfig?.FUTARCHY_ROUTER_ADDRESS || null,
                    conditionalTokens: contractConfig?.CONDITIONAL_TOKENS_ADDRESS || null,
                    wrapperService: contractConfig?.WRAPPER_SERVICE_ADDRESS || null
                },
                prices: {
                    yesPrice: prices?.yesPrice || null,
                    noPrice: prices?.noPrice || null,
                    newYesPrice: newYesPrice || null,
                    newNoPrice: newNoPrice || null,
                    isLoading: prices?.isLoading || false,
                    error: prices?.error || null
                }
            };

            const jsonString = JSON.stringify(exportData, null, 2);
            await navigator.clipboard.writeText(jsonString);
            
            setExportStatus('✅ Copied!');
            setTimeout(() => setExportStatus(''), 2000);
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            setExportStatus('❌ Failed');
            setTimeout(() => setExportStatus(''), 2000);
        }
    };

    // Get dynamic token names from config
    const currencyYesTokenName = contractConfig?.MERGE_CONFIG?.currencyPositions?.yes?.wrap?.tokenSymbol || 'YES_Currency';
    const currencyNoTokenName = contractConfig?.MERGE_CONFIG?.currencyPositions?.no?.wrap?.tokenSymbol || 'NO_Currency';
    const companyYesTokenName = contractConfig?.MERGE_CONFIG?.companyPositions?.yes?.wrap?.tokenSymbol || 'YES_Company';
    const companyNoTokenName = contractConfig?.MERGE_CONFIG?.companyPositions?.no?.wrap?.tokenSymbol || 'NO_Company';
    const baseCurrencySymbol = contractConfig?.BASE_TOKENS_CONFIG?.currency?.symbol || 'Currency';
    const baseCompanySymbol = contractConfig?.BASE_TOKENS_CONFIG?.company?.symbol || 'Company';

    const sections = {
        'Contract Configuration': {
            'Proposal ID': contractConfig?.proposalId || 'Not set',
            'Market Address': contractConfig?.MARKET_ADDRESS || 'Not set',
            'Futarchy Router': contractConfig?.FUTARCHY_ROUTER_ADDRESS || 'Not set',
        },
        'Conditional Pools': {
            'YES Pool Address': contractConfig?.POOL_CONFIG_YES?.address || 'Not set',
            'YES Pool Token Slot': contractConfig?.POOL_CONFIG_YES?.tokenCompanySlot ?? 'Not set',
            'YES Pool Inverted': contractConfig?.POOL_CONFIG_YES?.tokenCompanySlot === 1 ? '✅ Yes (1/price)' : '❌ No (raw price)',
            'NO Pool Address': contractConfig?.POOL_CONFIG_NO?.address || 'Not set',
            'NO Pool Token Slot': contractConfig?.POOL_CONFIG_NO?.tokenCompanySlot ?? 'Not set',
            'NO Pool Inverted': contractConfig?.POOL_CONFIG_NO?.tokenCompanySlot === 1 ? '✅ Yes (1/price)' : '❌ No (raw price)',
        },
        'Prediction Pools': {
            'Prediction YES Address': contractConfig?.PREDICTION_POOLS?.yes?.address || 'Not set',
            'Prediction YES Token Slot': contractConfig?.PREDICTION_POOLS?.yes?.tokenBaseSlot ?? 'Not set',
            'Prediction YES Inverted': contractConfig?.PREDICTION_POOLS?.yes?.tokenBaseSlot === 0 ? '✅ Yes (1/price)' : contractConfig?.PREDICTION_POOLS?.yes?.tokenBaseSlot === 1 ? '❌ No (raw price)' : 'Not set',
            'Prediction NO Address': contractConfig?.PREDICTION_POOLS?.no?.address || 'Not set',
            'Prediction NO Token Slot': contractConfig?.PREDICTION_POOLS?.no?.tokenBaseSlot ?? 'Not set',
            'Prediction NO Inverted': contractConfig?.PREDICTION_POOLS?.no?.tokenBaseSlot === 0 ? '✅ Yes (1/price)' : contractConfig?.PREDICTION_POOLS?.no?.tokenBaseSlot === 1 ? '❌ No (raw price)' : 'Not set',
        },
        'Conditional Token Addresses': {
            [`${currencyYesTokenName} Token`]: contractConfig?.MERGE_CONFIG?.currencyPositions?.yes?.wrap?.wrappedCollateralTokenAddress || 'Not set',
            [`${currencyNoTokenName} Token`]: contractConfig?.MERGE_CONFIG?.currencyPositions?.no?.wrap?.wrappedCollateralTokenAddress || 'Not set',
            [`${companyYesTokenName} Token`]: contractConfig?.MERGE_CONFIG?.companyPositions?.yes?.wrap?.wrappedCollateralTokenAddress || 'Not set',
            [`${companyNoTokenName} Token`]: contractConfig?.MERGE_CONFIG?.companyPositions?.no?.wrap?.wrappedCollateralTokenAddress || 'Not set',
        },
        'Base Token Addresses': {
            [`Base Currency (${baseCurrencySymbol})`]: contractConfig?.BASE_TOKENS_CONFIG?.currency?.address || 'Not set',
            [`Base Company (${baseCompanySymbol})`]: contractConfig?.BASE_TOKENS_CONFIG?.company?.address || 'Not set',
        },
        'Market Prices': {
            'Yes Price': prices?.yesPrice,
            'No Price': prices?.noPrice,
            'New Yes Price (Algebra)': newYesPrice,
            'New No Price (Algebra)': newNoPrice,
            'Loading': prices?.isLoading,
            'Error': prices?.error
        },
        'User Positions': {
            [`${currencyYesTokenName}`]: positions?.currencyYes,
            [`${currencyNoTokenName}`]: positions?.currencyNo,
            [`${companyYesTokenName}`]: positions?.companyYes,
            [`${companyNoTokenName}`]: positions?.companyNo,
            [`${baseCurrencySymbol}`]: positions?.wxdai,
            [`${baseCompanySymbol}`]: positions?.faot
        }
    };

    return (
        <motion.div
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="fixed right-4 bottom-4 z-50 max-w-lg"
        >
            <div className={`bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-700/50
                ${isExpanded ? 'w-[28rem]' : 'w-56'} transition-all duration-300 ease-in-out`}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 rounded-t-xl border-b border-slate-700/30">
                    <button 
                        className="text-sm font-semibold text-slate-100 cursor-pointer flex-1 text-left hover:text-indigo-300 transition-colors flex items-center gap-2"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        <span className="text-lg">📊</span>
                        <span>Market Analytics</span>
                        <motion.span 
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            className="text-slate-400 ml-auto"
                        >
                            ▼
                        </motion.span>
                    </button>
                    <div className="flex items-center gap-2 ml-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleExportToClipboard();
                            }}
                            className="px-3 py-1.5 text-xs bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:from-indigo-600 hover:to-purple-600 transition-all duration-200 flex items-center gap-1.5 shadow-lg hover:shadow-xl transform hover:scale-105"
                            title="Export pool data to clipboard as JSON"
                        >
                            <span>📋</span>
                            <span className="font-medium">{exportStatus || 'Export'}</span>
                        </button>
                        {isExpanded && (
                            <div className="flex items-center gap-1">
                                <span className="animate-pulse w-2 h-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50"></span>
                                <span className="text-xs text-slate-300 font-medium">Live</span>
                            </div>
                        )}
                    </div>
                </div>

                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="overflow-hidden"
                        >
                            <div className="max-h-[70vh] overflow-y-auto p-4 space-y-5">
                                {Object.entries(sections).map(([sectionName, sectionData]) => (
                                    <div key={sectionName} className="group">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="text-sm font-bold text-slate-200 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 px-3 py-1.5 rounded-lg border border-slate-600/30">
                                                {sectionName}
                                            </div>
                                            <div className="flex-1 h-px bg-gradient-to-r from-slate-600/50 to-transparent"></div>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2">
                                            {Object.entries(sectionData).map(([key, value]) => {
                                                const isAddressField = key.toLowerCase().includes('address') || key.toLowerCase().includes('token') || key.toLowerCase().includes('pool') || key.toLowerCase().includes('router') || key.includes('ID');
                                                const isPriceField = key.toLowerCase().includes('price');
                                                const isClickableAddress = isEthereumAddress(value);
                                                
                                                return (
                                                    <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40 hover:bg-slate-700/40 transition-colors duration-200 group">
                                                        <span className="text-xs font-medium text-slate-300 flex-shrink-0 min-w-0 mr-3">
                                                            {key}:
                                                        </span>
                                                        <span 
                                                            className={`text-xs font-mono text-right flex-1 min-w-0 truncate ${
                                                                typeof value === 'number' 
                                                                    ? value > 0 
                                                                        ? 'text-emerald-400 font-semibold' 
                                                                        : 'text-red-400 font-semibold'
                                                                    : typeof value === 'boolean' || value === 'N/A' || value === 'null'
                                                                        ? 'text-slate-400'
                                                                        : isClickableAddress
                                                                            ? 'text-indigo-400 hover:text-indigo-300 cursor-pointer underline decoration-dotted hover:decoration-solid transform hover:scale-105 transition-all duration-200'
                                                                            : 'text-slate-100'
                                                            }`}
                                                            onClick={() => isClickableAddress && handleAddressClick(value)}
                                                            title={isClickableAddress ? `Click to view on ${
                                                                (contractConfig?.chainId === 1 ? 'Etherscan' :
                                                                 contractConfig?.chainId === 137 ? 'Polygonscan' :
                                                                 'GnosisScan')
                                                            }` : String(value)}
                                                        >
                                                            {formatValue(value, isPriceField, isAddressField)}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

export default MarketStatsDebugToast; 