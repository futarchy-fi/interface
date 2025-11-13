// components/common/Header.jsx
import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { WalletIcon } from "../futarchyFi/proposalsList/cards/Resources";
import HeaderDropdown from "./HeaderDropdown";
import { useRouter } from "next/router";
import DarkModeToggle from "./DarkModeToggle";
import { useSdaiRate } from "../../hooks/useSdaiRate";
import { useCurrency } from "../../contexts/CurrencyContext";
import { mockRecentMarkets } from '../../mocks/mockRecentMarkets';
import { mockPreviewData as fireCeoMarkets } from '../futarchyFi/companyList/components/FireTheCeoPromoBanner';
import { useAccount, useSwitchChain } from 'wagmi';

const Header = ({ config = 'landing', darkMode, toggleDarkMode }) => {
  const [showUSD, setShowUSD] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(darkMode);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const { selectedCurrency, setSelectedCurrency, baseTokenSymbol, allowWXDAI } = useCurrency();
  const router = useRouter();
  const { rate: sdaiRate, isLoading: isLoadingRate, error: rateError } = useSdaiRate();

  // Get chain info from wagmi v2
  const { chain, isConnected } = useAccount();
  const { chains, switchChain } = useSwitchChain();
  const isMainnet = chain?.id === 1;
  const isGnosis = chain?.id === 100;

  // Update dark mode state when prop changes
  useEffect(() => {
    setIsDarkMode(darkMode);
  }, [darkMode]);

  // Also check system preference directly as a fallback
  useEffect(() => {
    if (darkMode === undefined) {
      // Check if there's a saved preference in localStorage
      const savedMode = localStorage.getItem('darkMode');
      if (savedMode !== null) {
        setIsDarkMode(savedMode === 'true');
        if (savedMode === 'true') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } else {
        // If no saved preference, use system preference
        const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setIsDarkMode(prefersDarkMode);
        if (prefersDarkMode) {
          document.documentElement.classList.add('dark');
        }
      }
      
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e) => {
        if (localStorage.getItem('darkMode') === null) {
          setIsDarkMode(e.matches);
          if (e.matches) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }
  }, [darkMode]);

  const navigationOptions = [
    { 
      label: 'Connect Wallet', 
      href: '#', 
      isWallet: true 
    },
  ];

  // Header configurations
  const headerConfigs = {
    landing: {
      button: (
        <button
          onClick={() => {}}
          className="h-12 border-2 border-black hover:border-black bg-black px-4 py-3 rounded-xl text-base font-semibold text-white hover:bg-white hover:text-black transition-colors shadow-xs dark:border-white dark:bg-white dark:text-black dark:hover:bg-black dark:hover:text-white"
        >
          <div>Get Early Access</div>
        </button>
      )
    },
    app: {
      additionalElements: (
        <div className="hidden md:flex items-center gap-4">
        </div>
      ),
      button: (
        <ConnectButton.Custom>
          {({ account, chain, openConnectModal, mounted }) => {
            const ready = mounted;
            const connected = ready && account && chain;
            return (
              <>
                <div className="md:hidden">
                  <HeaderDropdown 
                    options={navigationOptions} 
                    darkMode={isDarkMode} 
                    toggleDarkMode={toggleDarkMode}
                    onWalletConnectClick={() => {
                      if (openConnectModal && !connected) openConnectModal();
                    }}
                  />
                </div>
                <div className="hidden md:block">
                  <div
                    {...(!ready && {
                      'aria-hidden': true,
                      style: {
                        opacity: 0,
                        pointerEvents: 'none',
                        userSelect: 'none',
                      },
                    })}
                  >
                    {(() => {
                      if (!connected) {
                        return (
                          <button
                            onClick={openConnectModal}
                            className="w-48 h-12 py-3 px-4 flex items-center justify-between border-2 border-transparent rounded-lg bg-futarchyGray122 hover:border-futarchyGray122 hover:bg-transparent group dark:bg-white dark:hover:border-white dark:hover:bg-transparent"
                          >
                            <div className="flex items-center gap-2 text-futarchyDarkGray2 group-hover:text-futarchyGray122 transition-colors dark:text-black dark:group-hover:text-white">
                              <WalletIcon className="transition-colors" />
                              <span className="font-semibold text-base leading-6">
                                Connect Wallet
                              </span>
                            </div>
                          </button>
                        );
                      }
                      return <ConnectButton />;
                    })()}
                  </div>
                </div>
              </>
            );
          }}
        </ConnectButton.Custom>
      ),
      className: "bg-futarchyDarkGray2 border-futarchyDarkGray42 dark:bg-futarchyDarkGray2 dark:border-futarchyDarkGray42"
    }
  };

  const currentConfig = headerConfigs[config] || headerConfigs['app'];

  // Determine which logo to use. The app header always uses the white text logo.
  const getLogo = () => {
    return "/assets/futarchy-fi-logo-text-white.svg";
  };

  // Mock data for milestone and company
  const milestoneMarkets = [
    {
      title: "What will be the impact on GNO price if this milestone is achieved?",
      type: "milestone",
      impact: "+10.3%",
      endDate: "2025-12-20"
    }
  ];

  const companies = [
    {
      title: "GnosisDAO",
      type: "company",
      description: "Infrastructure & Tools",
      image: "/assets/gnosis-dao-logo.png"
    }
  ];

  const searchData = [
    ...companies,
    ...fireCeoMarkets.map(item => ({ title: item.title, type: 'fire_ceo', ...item })),
    ...milestoneMarkets
  ];

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 ${currentConfig.className || 'bg-futarchyDarkGray2 dark:bg-futarchyDarkGray2'}`}>
      <div className={`h-20 border-b-2 ${currentConfig.className ? 'border-futarchyDarkGray42 dark:border-futarchyDarkGray42' : 'border-futarchyDarkGray42 dark:border-futarchyDarkGray42'}`}>
        <div className="container mx-auto px-5 h-full flex items-center justify-between">
          <div className="flex items-center gap-14">
            {/* Logo Section */}
            <Link
              href="/"
              className="flex items-center gap-2 group cursor-pointer"
            >
              <Image
                src={getLogo()}
                alt="Futarchy Logo"
                width={128}
                height={22}
                className="transition-opacity group-hover:opacity-70"
                priority
              />
            </Link>

            {/* Additional Elements (e.g., Home button for proposals) */}
            {currentConfig.additionalElements}
          </div>

          {/* Search Bar */}
          <div className="flex-1 flex justify-center">
            <div className="relative w-full max-w-md">
              <input
                type="text"
                placeholder="Search CEO, milestones, companies..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="hidden w-full pl-10 pr-4 py-2 rounded-lg bg-futarchyGray122/20 text-white placeholder-futarchyGray122 focus:outline-none focus:ring-2 focus:ring-futarchyGray122 transition-all"
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 100)}
              />
              <span className="hidden absolute left-3 top-1/2 -translate-y-1/2 text-futarchyGray122">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
                </svg>
              </span>
              {/* Dropdown for combined search results: CEO, milestones, companies */}
              {(isSearchFocused || searchTerm) && (
                <div className="absolute left-0 mt-2 w-full bg-futarchyDarkGray2 border border-futarchyGray122/30 rounded-lg shadow-lg z-50">
                  {(() => {
                    const filteredResults = searchData.filter(m =>
                      m.title.toLowerCase().includes(searchTerm.toLowerCase())
                    );

                    return (
                      <>
                        {/* Fire the CEO Section */}
                        {filteredResults.filter(item => item.type === 'fire_ceo').length > 0 && (
                          <>
                            <div className="p-2 text-xs text-futarchyGray122 font-semibold">Fire the CEO</div>
                            {filteredResults.filter(item => item.type === 'fire_ceo').map((item, idx) => (
                              <div key={`fireceo-${idx}`} className="flex items-center justify-between gap-2 px-4 py-2 cursor-pointer hover:bg-blue-600 hover:text-white rounded-lg">
                                <span>{item.title}</span>
                              </div>
                            ))}
                          </>
                        )}
                        {/* Milestone Section */}
                        {filteredResults.filter(item => item.type === 'milestone').length > 0 && (
                          <>
                            <div className="p-2 text-xs text-futarchyGray122 font-semibold">Milestone</div>
                            {filteredResults.filter(item => item.type === 'milestone').map((item, idx) => (
                              <div key={`milestone-${idx}`} className="flex items-center justify-between gap-2 px-4 py-2 cursor-pointer hover:bg-blue-600 hover:text-white rounded-lg">
                                <span>{item.title}</span>
                              </div>
                            ))}
                          </>
                        )}
                        {/* Company Section */}
                        {filteredResults.filter(item => item.type === 'company').length > 0 && (
                          <>
                            <div className="p-2 text-xs text-futarchyGray122 font-semibold">Company</div>
                            {filteredResults.filter(item => item.type === 'company').map((item, idx) => (
                              <div key={`company-${idx}`} className="flex items-center justify-between gap-2 px-4 py-2 cursor-pointer hover:bg-blue-600 hover:text-white rounded-lg">
                                <span>{item.title}</span>
                              </div>
                            ))}
                          </>
                        )}
                        {/* No Results */}
                        {filteredResults.length === 0 && (
                          <div className="px-4 py-2 text-futarchyGray122 text-sm">No results found.</div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Right side buttons */}
          <div className="flex items-center gap-4">
            {/* Chain Selector Button - Mobile */}
            {config !== 'landing' && (
              <div className="md:hidden">
                <ConnectButton.Custom>
                  {({ chain, openChainModal, mounted }) => {
                    const ready = mounted;
                    return (
                      <div
                        {...(!ready && {
                          'aria-hidden': true,
                          style: {
                            opacity: 0,
                            pointerEvents: 'none',
                            userSelect: 'none',
                          },
                        })}
                      >
                        {chain && openChainModal && (
                          <button
                            onClick={openChainModal}
                            className="h-12 w-12 bg-transparent border-2 border-futarchyDarkGray42 rounded-xl text-futarchyGray122 hover:text-futarchyGray122/70 hover:border-futarchyGray122 dark:border-futarchyDarkGray42 dark:text-white dark:hover:text-white/70 dark:hover:border-white transition-colors flex items-center justify-center"
                            aria-label="Switch network"
                          >
                            {chain.hasIcon && chain.iconUrl && (
                              <img
                                alt={chain.name ?? 'Chain icon'}
                                src={chain.iconUrl}
                                className="w-6 h-6"
                              />
                            )}
                          </button>
                        )}
                      </div>
                    );
                  }}
                </ConnectButton.Custom>
              </div>
            )}

            {/* Dark Mode Toggle */}
            <DarkModeToggle isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />

            {/* Currency selector - show on Gnosis Chain (or assume Gnosis if no chain detected) */}
            {config !== 'landing' && (!chain || isGnosis) && allowWXDAI && baseTokenSymbol && (
              <div className="hidden md:flex items-center gap-2 p-1 text-sm font-medium text-futarchyGray122 border border-futarchyGray122/20 rounded-lg dark:text-white dark:border-white/20">
                {/* Base token from config (e.g., SDAI, USDS, etc.) */}
                <button
                  onClick={() => setSelectedCurrency(baseTokenSymbol)}
                  className={`py-1 px-3 rounded transition-colors ${
                    selectedCurrency === baseTokenSymbol
                      ? 'bg-futarchyGray122/10 text-futarchyGray122 dark:bg-white/10 dark:text-white'
                      : 'text-futarchyGray122 hover:bg-futarchyGray122/10 dark:text-white dark:hover:bg-white/10'
                  }`}
                >
                  {baseTokenSymbol}
                </button>
                {/* WXDAI option - only on Gnosis Chain */}
                {allowWXDAI && (
                  <button
                    onClick={() => setSelectedCurrency('WXDAI')}
                    className={`py-1 px-3 rounded transition-colors ${
                      selectedCurrency === 'WXDAI'
                        ? 'bg-futarchyGray122/10 text-futarchyGray122 dark:bg-white/10 dark:text-white'
                        : 'text-futarchyGray122 hover:bg-futarchyGray122/10 dark:text-white dark:hover:bg-white/10'
                    }`}
                  >
                    WXDAI
                  </button>
                )}
              </div>
            )}
            {currentConfig.button}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
