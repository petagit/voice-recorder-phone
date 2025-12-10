import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';

type Theme = 'light' | 'dark';

interface ThemeColors {
    background: string;
    card: string;
    text: string;
    subtext: string;
    border: string;
    tint: string;
    danger: string;
    success: string;
    warning: string;
    inputBackground: string;
    modalBackground: string;
    statusBadgeReachable: string;
    statusBadgeActive: string;
    statusBadgeDisconnected: string;
}

const lightColors: ThemeColors = {
    background: '#F2F2F7',
    card: '#FFFFFF',
    text: '#000000',
    subtext: '#666666',
    border: '#E5E5EA',
    tint: '#0A84FF',
    danger: '#FF3B30',
    success: '#30D158',
    warning: '#FFD60A',
    inputBackground: '#E5E5EA',
    modalBackground: '#FFFFFF',
    statusBadgeReachable: 'rgba(48, 209, 88, 0.2)',
    statusBadgeActive: 'rgba(10, 132, 255, 0.2)',
    statusBadgeDisconnected: 'rgba(255, 69, 58, 0.2)',
};

const darkColors: ThemeColors = {
    background: '#000000',
    card: '#1A1A1A',
    text: '#FFFFFF',
    subtext: '#888888',
    border: '#333333',
    tint: '#0A84FF',
    danger: '#FF3B30',
    success: '#30D158',
    warning: '#FFD60A',
    inputBackground: '#333333',
    modalBackground: '#1A1A1A',
    statusBadgeReachable: 'rgba(48, 209, 88, 0.2)',
    statusBadgeActive: 'rgba(10, 132, 255, 0.2)',
    statusBadgeDisconnected: 'rgba(255, 69, 58, 0.2)',
};

interface ThemeContextType {
    theme: Theme;
    colors: ThemeColors;
    isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const [theme, setTheme] = useState<Theme>('dark'); // Default to dark safe

    const checkTimeAndSetTheme = () => {
        const hour = new Date().getHours();
        // 6 AM to 6 PM is "Day" -> Light Mode
        // Otherwise -> Dark Mode
        if (hour >= 6 && hour < 18) {
            setTheme('light');
        } else {
            setTheme('dark');
        }
    };

    useEffect(() => {
        checkTimeAndSetTheme();

        // Check every minute
        const interval = setInterval(checkTimeAndSetTheme, 60000);

        // Also check when app comes to foreground
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                checkTimeAndSetTheme();
            }
        });

        return () => {
            clearInterval(interval);
            subscription.remove();
        };
    }, []);

    const colors = theme === 'dark' ? darkColors : lightColors;

    return (
        <ThemeContext.Provider value={{ theme, colors, isDark: theme === 'dark' }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
