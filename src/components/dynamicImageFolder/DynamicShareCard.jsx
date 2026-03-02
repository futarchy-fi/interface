import React, { useState, useEffect } from "react";
import { ShareProposalsCard, colorMotifs } from "./ShareProposalsCard";
import html2canvas from 'html2canvas';

const SocialSharingIcon = ({ className }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g clipPath="url(#clip0_31985_3914)">
            <path fillRule="evenodd" clipRule="evenodd" d="M1.99996 4.5C1.77895 4.5 1.56698 4.5878 1.4107 4.74408C1.25442 4.90036 1.16663 5.11232 1.16663 5.33333V13.3333C1.16663 13.5543 1.25442 13.7663 1.4107 13.9226C1.56698 14.0789 1.77895 14.1667 1.99996 14.1667H12C12.221 14.1667 12.4329 14.0789 12.5892 13.9226C12.7455 13.7663 12.8333 13.5543 12.8333 13.3333V10.1667H13.8333V13.3333C13.8333 13.8196 13.6401 14.2859 13.2963 14.6297C12.9525 14.9735 12.4862 15.1667 12 15.1667H1.99996C1.51373 15.1667 1.04741 14.9735 0.703597 14.6297C0.35978 14.2859 0.166626 13.8196 0.166626 13.3333V5.33333C0.166626 4.8471 0.35978 4.38079 0.703597 4.03697C1.04741 3.69315 1.51373 3.5 1.99996 3.5H3.16663V4.5H1.99996Z" fill="currentColor" />
            <path fillRule="evenodd" clipRule="evenodd" d="M8.83325 0.231445L15.4259 6L8.83325 11.7685V8.5073C7.39287 8.55072 6.43319 8.78567 5.71015 9.15388C4.91041 9.56116 4.34882 10.1567 3.73133 10.9692L2.83325 12.1509V10.6667C2.83325 7.90005 3.48137 6.06839 4.69281 4.94214C5.78441 3.92729 7.24654 3.56782 8.83325 3.50899V0.231445ZM9.83325 2.43521V4.5H9.33325C7.64443 4.5 6.30164 4.81183 5.3737 5.67452C4.63269 6.36343 4.08767 7.46878 3.90232 9.24354C4.29215 8.86399 4.72851 8.53158 5.25635 8.26278C6.2527 7.75538 7.52338 7.5 9.33325 7.5H9.83325V9.56478L13.9073 6L9.83325 2.43521Z" fill="currentColor" />
        </g>
        <defs>
            <clipPath id="clip0_31985_3914">
                <rect width="16" height="16" fill="white" />
            </clipPath>
        </defs>
    </svg>
);

const DynamicShareCard = ({ isOpen, onClose }) => {
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [selectedMarket, setSelectedMarket] = useState(null);
    const [markets, setMarkets] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [selectedColorMotif, setSelectedColorMotif] = useState('violet');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [currentMarketIndex, setCurrentMarketIndex] = useState(0);
    const [isAutoCycling, setIsAutoCycling] = useState(false);
    const [exportCounter, setExportCounter] = useState(0);

    // Fetch companies on mount
    useEffect(() => {
        const fetchCompanies = async () => {
            try {
                const response = await fetch(
                    `https://nvhqdqtlsdboctqjcelq.supabase.co/rest/v1/company?select=*&order=name.asc`,
                    {
                        headers: {
                            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
                            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`
                        }
                    }
                );

                if (!response.ok) throw new Error('Failed to fetch companies');

                const data = await response.json();
                setCompanies(data);
                if (data.length > 0) {
                    setSelectedCompany(data[0]);
                }
            } catch (err) {
                console.error('Error fetching companies:', err);
                setError('Failed to load companies');
            }
        };

        if (isOpen) { // Only fetch when open or on mount
            fetchCompanies();
        }
    }, [isOpen]);

    // Fetch markets when company changes
    useEffect(() => {
        if (selectedCompany) {
            setLoading(true);
            setError(null);
            setSelectedMarket(null);

            const fetchMarkets = async () => {
                try {
                    const response = await fetch(
                        `https://nvhqdqtlsdboctqjcelq.supabase.co/rest/v1/market_event?select=*&company_id=eq.${selectedCompany.id}&order=created_at.desc`,
                        {
                            headers: {
                                'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
                                'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`
                            }
                        }
                    );

                    if (!response.ok) {
                        throw new Error('Failed to fetch markets');
                    }

                    const data = await response.json();
                    setMarkets(data);

                    // Auto-select first market if available
                    if (data.length > 0) {
                        setSelectedMarket(data[0]);
                        setCurrentMarketIndex(0);
                    }
                } catch (err) {
                    setError(err.message);
                } finally {
                    setLoading(false);
                }
            };

            fetchMarkets();
        }
    }, [selectedCompany]);

    // Auto-cycling functionality
    useEffect(() => {
        let interval;
        if (isAutoCycling && markets.length > 0) {
            interval = setInterval(() => {
                setCurrentMarketIndex(prevIndex => {
                    const nextIndex = (prevIndex + 1) % markets.length;
                    setSelectedMarket(markets[nextIndex]);
                    return nextIndex;
                });
            }, 3000); // Change every 3 seconds
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isAutoCycling, markets]);

    // Navigation functions
    const goToNextMarket = () => {
        if (markets.length > 0) {
            const nextIndex = (currentMarketIndex + 1) % markets.length;
            setCurrentMarketIndex(nextIndex);
            setSelectedMarket(markets[nextIndex]);
        }
    };

    const goToPrevMarket = () => {
        if (markets.length > 0) {
            const prevIndex = currentMarketIndex === 0 ? markets.length - 1 : currentMarketIndex - 1;
            setCurrentMarketIndex(prevIndex);
            setSelectedMarket(markets[prevIndex]);
        }
    };

    const generateShareData = () => {
        if (!selectedMarket) {
            return {
                title: 'Select a market to generate share card',
                question: '',
                event: 'Choose a company and market from the dropdowns above'
            };
        }

        const seoData = selectedMarket.metadata?.seo;
        const displayTitles = selectedMarket.metadata;

        return {
            title: displayTitles?.display_title_0 || seoData?.title || selectedMarket.title,
            question: displayTitles?.display_title_1 || seoData?.description || '',
            event: selectedMarket.title || selectedMarket.proposal_markdown || ''
        };
    };

    const exportAsPNG = () => {
        const node = document.getElementById('seo-image');
        if (node) {
            html2canvas(node, { useCORS: true, allowTaint: true, backgroundColor: null })
                .then(canvas => {
                    const link = document.createElement('a');
                    const newCounter = exportCounter + 1;
                    link.download = `${selectedCompany.name.toLowerCase()}-market-card-${newCounter}.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                    setExportCounter(newCounter);
                })
                .catch(error => {
                    console.error('Export failed:', error);
                });
        }
    };

    const exportAllMarkets = async () => {
        if (markets.length === 0) return;

        setIsAutoCycling(false); // Stop auto-cycling during batch export

        for (let i = 0; i < markets.length; i++) {
            setCurrentMarketIndex(i);
            setSelectedMarket(markets[i]);

            // Wait for the UI to update
            await new Promise(resolve => setTimeout(resolve, 500));

            const node = document.getElementById('seo-image');
            if (node) {
                try {
                    const canvas = await html2canvas(node, { useCORS: true, allowTaint: true, backgroundColor: null });
                    const link = document.createElement('a');
                    link.download = `${selectedCompany.name.toLowerCase()}-market-card-${i + 1}.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.click();

                    // Wait between downloads to avoid overwhelming the browser
                    await new Promise(resolve => setTimeout(resolve, 300));
                } catch (error) {
                    console.error(`Export failed for market ${i + 1}:`, error);
                }
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex justify-center items-center z-[100]" onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-center gap-6 max-w-4xl w-full mx-4">

                {/* Controls Panel */}
                <div className="bg-futarchyDarkGray2 border border-futarchyGray11/20 rounded-xl p-6 w-full">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-white font-semibold">Customize Share Card</h3>
                        {markets.length > 0 && (
                            <div className="text-sm text-white/70">
                                Market {currentMarketIndex + 1} of {markets.length}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Company Selector */}
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">Company</label>
                            <select
                                value={selectedCompany?.id || ''}
                                onChange={(e) => setSelectedCompany(companies.find(c => c.id === parseInt(e.target.value)))}
                                className="w-full bg-futarchyDarkGray3 border border-futarchyGray11/30 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-futarchyBlue9"
                                disabled={companies.length === 0}
                            >
                                {companies.map(company => (
                                    <option key={company.id} value={company.id}>{company.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Market Selector */}
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">Market</label>
                            <select
                                value={selectedMarket?.id || ''}
                                onChange={(e) => setSelectedMarket(markets.find(m => m.id === e.target.value))}
                                disabled={loading || markets.length === 0}
                                className="w-full bg-futarchyDarkGray3 border border-futarchyGray11/30 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-futarchyBlue9 disabled:opacity-50"
                            >
                                <option value="">
                                    {loading ? 'Loading...' : markets.length === 0 ? 'No markets available' : 'Select a market'}
                                </option>
                                {markets.map(market => (
                                    <option key={market.id} value={market.id}>
                                        {market.metadata?.seo?.title || market.title || 'Untitled Market'}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Color Motif Selector */}
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">Color Theme</label>
                            <select
                                value={selectedColorMotif}
                                onChange={(e) => setSelectedColorMotif(e.target.value)}
                                className="w-full bg-futarchyDarkGray3 border border-futarchyGray11/30 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-futarchyBlue9"
                            >
                                {Object.keys(colorMotifs).map(motif => (
                                    <option key={motif} value={motif}>
                                        {motif.charAt(0).toUpperCase() + motif.slice(1)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {error && (
                        <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
                            Error: {error}
                        </div>
                    )}

                    {/* Navigation and Auto-Cycling Controls */}
                    {markets.length > 1 && (
                        <div className="mt-6 pt-4 border-t border-futarchyGray11/20">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={goToPrevMarket}
                                        className="bg-futarchyDarkGray3 hover:bg-futarchyGray11/30 border border-futarchyGray11/30 text-white px-3 py-2 rounded-lg transition-colors duration-200"
                                    >
                                        ← Previous
                                    </button>
                                    <button
                                        onClick={() => setIsAutoCycling(!isAutoCycling)}
                                        className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${isAutoCycling
                                            ? 'bg-red-600 hover:bg-red-700 text-white'
                                            : 'bg-green-600 hover:bg-green-700 text-white'
                                            }`}
                                    >
                                        {isAutoCycling ? '⏸ Pause' : '▶ Auto-Cycle'}
                                    </button>
                                    <button
                                        onClick={goToNextMarket}
                                        className="bg-futarchyDarkGray3 hover:bg-futarchyGray11/30 border border-futarchyGray11/30 text-white px-3 py-2 rounded-lg transition-colors duration-200"
                                    >
                                        Next →
                                    </button>
                                </div>

                                <button
                                    onClick={exportAllMarkets}
                                    disabled={loading}
                                    className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-4 py-2 rounded-lg transition-colors duration-200 disabled:opacity-50"
                                >
                                    Export All ({markets.length})
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Share Card Preview */}
                {selectedCompany && (
                    <ShareProposalsCard
                        {...generateShareData()}
                        colorMotif={selectedColorMotif}
                        companyId={selectedCompany.id}
                        companyLogoUrl={selectedCompany.logo}
                        customColor={selectedCompany.metadata?.colors?.primary}
                    />
                )}

                {/* Export Button */}
                <button
                    onClick={exportAsPNG}
                    disabled={!selectedMarket}
                    style={selectedCompany?.metadata?.colors?.primary ? {
                        backgroundColor: selectedCompany.metadata.colors.primary,
                        borderColor: selectedCompany.metadata.colors.primary,
                    } : {}}
                    className={`flex items-center gap-2 ${!selectedCompany?.metadata?.colors?.primary ? colorMotifs[selectedColorMotif].buttonBg + ' ' + colorMotifs[selectedColorMotif].buttonHoverBg : 'hover:opacity-90'
                        } border-2 ${!selectedCompany?.metadata?.colors?.primary ? colorMotifs[selectedColorMotif].buttonBorder : ''
                        } text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    <SocialSharingIcon className="h-5 w-5" />
                    Export as PNG
                </button>
            </div>
        </div>
    );
};

export default DynamicShareCard;
