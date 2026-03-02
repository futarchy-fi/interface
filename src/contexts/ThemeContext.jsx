import React, { createContext, useContext, useState, useEffect } from 'react';

/**
 * Theme options:
 * - 'light': Light mode
 * - 'dark': Dark mode  
 * - 'gradient': Dark mode with blue-to-gold gradient background
 */
const ThemeContext = createContext();

export const THEMES = {
    LIGHT: 'light',
    DARK: 'dark',
    GRADIENT: 'gradient',
};

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(THEMES.LIGHT);

    useEffect(() => {
        // Load saved theme from localStorage
        const savedTheme = localStorage.getItem('theme');
        // For now, only support light and dark (gradient is hidden)
        if (savedTheme && (savedTheme === THEMES.LIGHT || savedTheme === THEMES.DARK)) {
            setTheme(savedTheme);
        } else {
            // Fallback to system preference for dark/light
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            setTheme(prefersDark ? THEMES.DARK : THEMES.LIGHT);
        }
    }, []);

    useEffect(() => {
        // Apply theme to document
        const html = document.documentElement;

        // Remove all theme classes
        html.classList.remove('dark', 'gradient');
        html.removeAttribute('data-theme');

        if (theme === THEMES.DARK || theme === THEMES.GRADIENT) {
            html.classList.add('dark');
        }

        if (theme === THEMES.GRADIENT) {
            html.classList.add('gradient');
            html.setAttribute('data-theme', 'gradient');
        }

        // Save to localStorage
        localStorage.setItem('theme', theme);
    }, [theme]);

    const cycleTheme = () => {
        // For now, only toggle between light and dark (gradient hidden)
        setTheme(prev => prev === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT);
    };

    const value = {
        theme,
        setTheme,
        cycleTheme,
        isDarkMode: theme === THEMES.DARK || theme === THEMES.GRADIENT,
        isGradient: theme === THEMES.GRADIENT,
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
};

export default ThemeContext;
