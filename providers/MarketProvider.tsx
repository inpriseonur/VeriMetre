import { EconomicIndicators, fetchMarketData, getEconomicIndicators, MarketItem } from '@/lib/marketService';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

interface MarketContextType {
    marketData: MarketItem[];
    indicators: EconomicIndicators | null;
    isLoading: boolean;
    lastUpdated: Date | null;
    refreshData: (silent?: boolean) => Promise<void>;
}

const MarketContext = createContext<MarketContextType | undefined>(undefined);

export const useMarket = () => {
    const context = useContext(MarketContext);
    if (!context) {
        throw new Error('useMarket must be used within a MarketProvider');
    }
    return context;
};

export const MarketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [marketData, setMarketData] = useState<MarketItem[]>([]);
    const [indicators, setIndicators] = useState<EconomicIndicators | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const refreshData = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        console.log('MarketProvider: Refreshing data...');

        try {
            const [mRes, iRes] = await Promise.all([
                fetchMarketData(),
                getEconomicIndicators()
            ]);

            if (mRes) setMarketData(mRes);
            if (iRes) setIndicators(iRes);

            setLastUpdated(new Date());
        } catch (error) {
            console.error('MarketProvider: Error fetching data:', error);
        } finally {
            if (!silent) setIsLoading(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        refreshData();
    }, [refreshData]);

    // Auto-refresh every 60 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            refreshData(true); // Silent refresh
        }, 60000);

        return () => clearInterval(interval);
    }, [refreshData]);

    // Refresh when app comes to foreground (optional but good UX)
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                refreshData(true);
            }
        });

        return () => {
            subscription.remove();
        };
    }, [refreshData]);

    return (
        <MarketContext.Provider value={{ marketData, indicators, isLoading, lastUpdated, refreshData }}>
            {children}
        </MarketContext.Provider>
    );
};
