import { supabase } from './supabase';

export interface MarketItem {
    id: number;
    symbol: string;      // e.g. "USDTRY", "XU100"
    name: string;        // e.g. "Dolar", "BIST 100"
    price: number;
    change_rate: number; // percentage, e.g. 0.45 or -1.20
    chart_data: { value: number }[]; // Simplified for sparkline
    last_updated: string;
}

export const fetchMarketData = async (): Promise<MarketItem[] | null> => {
    try {
        console.log('Triggering market data update...');
        // Step A: Trigger Edge Function (Fire and forget or wait? User said await)
        // We await it to ensure backend cache is updated before we fetch from DB
        const { error: invokeError } = await supabase.functions.invoke('get-market-data');

        if (invokeError) {
            console.warn('Edge Function trigger failed:', invokeError);
            // We continue even if trigger fails, maybe cache is still good enough
        }

        console.log('Fetching fresh data from RPC...');
        // Step B: Fetch from RPC
        const { data, error } = await supabase.rpc('get_dashboard_market_data');

        if (error) {
            console.error('RPC fetch failed:', error);
            return null;
        }

        return data as MarketItem[];

    } catch (err) {
        console.error('Exception in fetchMarketData:', err);
        return null;
    }
};

// ... (existing exports)

export interface FundItem {
    code: string;       // e.g. "AFT"
    title: string;      // e.g. "Ak Portföy Yeni Teknolojiler..."
    price: number;
    last_updated?: string;
}

export const searchFunds = async (query: string): Promise<FundItem[]> => {
    try {
        const { data, error } = await supabase.functions.invoke('get-funds', {
            body: { query }
        });

        if (error) {
            console.error('Edge Function get-funds failed:', error);
            return [];
        }

        return data as FundItem[];
    } catch (err) {
        console.error('Exception in searchFunds:', err);
        return [];
    }
};
