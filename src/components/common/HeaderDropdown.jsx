import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { WalletIcon, OpenMenuIcon, DocumentationIcon, HomeIcon } from "../futarchyFi/proposalsList/cards/Resources";
import { useAccount, useSwitchChain } from 'wagmi';

const HeaderDropdown = ({ options, config, darkMode, toggleDarkMode, onWalletConnectClick }) => {
  const { chain } = useAccount();
  const { chains, switchChain } = useSwitchChain();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [isDarkMode, setIsDarkMode] = useState(darkMode);

  // Update dark mode state when prop changes
  useEffect(() => {
    setIsDarkMode(darkMode);
  }, [darkMode]);

  // Also check system preference directly as a fallback
  useEffect(() => {
    if (darkMode === undefined) {
      const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(prefersDarkMode);
      
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e) => {
        setIsDarkMode(e.matches);
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }
  }, [darkMode]);

  const isCompaniesSection = config === 'companies';

  const getIcon = (option) => {
    // Determine icon color based on dark mode and section
    const iconColor = isDarkMode ? "white" : (isCompaniesSection ? "#000000" : "currentColor");
    
    if (option.isWallet) {
      return <WalletIcon className="w-4 h-4 transition-colors" fill={iconColor} />;
    }
    switch (option.label) {
      case 'Home':
        return <HomeIcon className="w-4 h-4 transition-colors" fill={iconColor} />;
      case 'Documentation':
        return <DocumentationIcon className="w-4 h-4 transition-colors" fill={iconColor} />;
      default:
        return null;
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`h-12 w-12 bg-transparent border-2 rounded-xl text-base font-semibold transition-colors flex items-center justify-center
          ${isCompaniesSection && !isDarkMode
            ? 'border-futarchyGray62 text-futarchyGray11 hover:text-futarchyGray11/70 hover:border-futarchyGray11' 
            : 'border-futarchyDarkGray42 text-futarchyGray122 hover:text-futarchyGray122/70 hover:border-futarchyGray122'
          }
          ${isDarkMode ? 'dark:border-futarchyDarkGray42 dark:text-white dark:hover:text-white/70 dark:hover:border-white' : ''}`}
      >
        <OpenMenuIcon 
          className="w-5 h-5" 
          fill={isDarkMode ? "white" : (isCompaniesSection ? "white" : "white")} 
        />
      </button>

      {isOpen && (
        <div className={`absolute top-full right-0 mt-1 w-48 rounded-xl shadow-lg z-50 
          ${isCompaniesSection && !isDarkMode
            ? 'bg-futarchyGray2 border border-futarchyGray4' 
            : 'bg-futarchyDarkGray2 border border-futarchyDarkGray42'
          }
          ${isDarkMode ? 'dark:bg-futarchyDarkGray2 dark:border-futarchyDarkGray42' : ''}`}
        >
          {/* Chain Selector */}
          {chain && chains && chains.length > 1 && (
            <>
              <div className={`px-4 py-2 text-xs font-semibold ${isDarkMode ? 'text-futarchyGray122' : 'text-futarchyGray122'}`}>
                Network
              </div>
              {chains.map((availableChain) => (
                <button
                  key={availableChain.id}
                  onClick={() => {
                    if (switchChain && availableChain.id !== chain?.id) {
                      switchChain({ chainId: availableChain.id });
                    }
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between gap-2 w-full px-4 py-3 transition-colors text-sm leading-5 font-normal text-left
                    ${isCompaniesSection && !isDarkMode
                      ? 'text-futarchyGray11 hover:text-futarchyGray11/70 hover:bg-futarchyGray4'
                      : 'text-futarchyGray122 hover:text-futarchyGray122/70 hover:bg-futarchyDarkGray42'
                    }
                    ${isDarkMode ? 'dark:text-white dark:hover:text-white/70 dark:hover:bg-futarchyDarkGray42' : ''}`}
                >
                  <span>{availableChain.name}</span>
                  {chain?.id === availableChain.id && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              ))}
              <div className={`border-t ${isDarkMode ? 'border-futarchyDarkGray42' : 'border-futarchyGray122/20'}`}></div>
            </>
          )}

          {/* Dark Mode Toggle in dropdown */}
          <button
            onClick={() => {
              if (toggleDarkMode) toggleDarkMode();
              setIsOpen(false);
            }}
            className={`flex items-center gap-2 w-full px-4 py-3 transition-colors text-sm leading-5 font-normal text-left first:rounded-t-xl
              ${isCompaniesSection && !isDarkMode
                ? 'text-futarchyGray11 hover:text-futarchyGray11/70 hover:bg-futarchyGray4'
                : 'text-futarchyGray122 hover:text-futarchyGray122/70 hover:bg-futarchyDarkGray42'
              }
              ${isDarkMode ? 'dark:text-white dark:hover:text-white/70 dark:hover:bg-futarchyDarkGray42' : ''}`}
          >
            {isDarkMode ? (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white"
                >
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-futarchyGray122"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
                <span>Dark Mode</span>
              </>
            )}
          </button>

          {options.map((option, index) => (
            option.isWallet ? (
              <button
                key={index}
                onClick={() => {
                  setIsOpen(false);
                  if (onWalletConnectClick) {
                    onWalletConnectClick();
                  }
                }}
                className={`flex items-center gap-2 w-full px-4 py-3 transition-colors text-sm leading-5 font-normal text-left ${index === options.length - 1 ? 'last:rounded-b-xl' : ''}
                  ${isCompaniesSection && !isDarkMode
                    ? 'text-futarchyGray11 hover:text-futarchyGray11/70 hover:bg-futarchyGray4' 
                    : 'text-futarchyGray122 hover:text-futarchyGray122/70 hover:bg-futarchyDarkGray42'
                  }
                  ${isDarkMode ? 'dark:text-white dark:hover:text-white/70 dark:hover:bg-futarchyDarkGray42' : ''}`}
              >
                {getIcon(option)}
                {option.label}
              </button>
            ) : (
              <Link
                key={index}
                href={option.href}
                className={`flex items-center gap-2 w-full px-4 py-3 transition-colors text-sm leading-5 font-normal text-left ${index === options.length - 1 ? 'last:rounded-b-xl' : ''}
                  ${isCompaniesSection && !isDarkMode
                    ? 'text-futarchyGray11 hover:text-futarchyGray11/70 hover:bg-futarchyGray4' 
                    : 'text-futarchyGray122 hover:text-futarchyGray122/70 hover:bg-futarchyDarkGray42'
                  }
                  ${isDarkMode ? 'dark:text-white dark:hover:text-white/70 dark:hover:bg-futarchyDarkGray42' : ''}`}
                onClick={() => setIsOpen(false)}
              >
                {getIcon(option)}
                {option.label}
              </Link>
            )
          ))}
        </div>
      )}
    </div>
  );
};

export default HeaderDropdown; 