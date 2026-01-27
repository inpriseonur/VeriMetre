import { ViewLivingStandards } from '@/types/database';
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

// ... (existing exports)

export interface FundItem {
    fund_code: string;       // e.g. "AFT"
    title: string;      // e.g. "Ak Portföy Yeni Teknolojiler..."
    price: number;
    last_updated?: string;
}

export const searchFunds = async (query: string): Promise<FundItem[]> => {
    try {
        // Always send a body so the Edge Function doesn't fail on req.json()
        const options = {
            body: {
                query: query || ""
            }
        };

        const { data, error } = await supabase.functions.invoke('get-funds', options);

        if (error) {
            console.error('Edge Function get-funds failed:', error);
            // Fallback debugging
            console.log('Query was:', query);
            return [];
        }

        return data as FundItem[];
    } catch (err) {
        console.error('Exception in searchFunds:', err);
        return [];
    }
};

// New decoupled interface
export interface EconomicIndicators {
    minWage: { value: number, reference_date: string };
    hunger: { value: number, reference_date: string };
    inflation: {
        tuik: { value: number, reference_date: string };
        enag: { value: number, reference_date: string };
        ito: { value: number, reference_date: string };
    };
}

export const getEconomicIndicators = async (): Promise<EconomicIndicators | null> => {
    try {
        // 1. Get Base Data (Wage & Hunger) - Latest available
        const { data: baseData, error: baseError } = await supabase
            .from('view_living_standards')
            .select('*')
            .order('reference_date', { ascending: false })
            .limit(1)
            .single();

        if (baseError) {
            console.error('getEconomicIndicators base error:', baseError);
            return null;
        }

        // 2. Get Inflation Data - Fetch separately to find latest NON-NULL for each
        // We run these in parallel for speed
        const [tuikRes, enagRes, itoRes] = await Promise.all([
            // TUIK
            supabase
                .from('view_living_standards')
                .select('inflation_tuik, reference_date')
                .not('inflation_tuik', 'is', null)
                .order('reference_date', { ascending: false })
                .limit(1)
                .single(),
            // ENAG
            supabase
                .from('view_living_standards')
                .select('inflation_enag, reference_date')
                .not('inflation_enag', 'is', null)
                .order('reference_date', { ascending: false })
                .limit(1)
                .single(),
            // ITO
            supabase
                .from('view_living_standards')
                .select('inflation_ito, reference_date')
                .not('inflation_ito', 'is', null)
                .order('reference_date', { ascending: false })
                .limit(1)
                .single()
        ]);

        return {
            minWage: {
                value: baseData.current_min_wage,
                reference_date: baseData.reference_date
            },
            hunger: {
                value: baseData.hunger_threshold,
                reference_date: baseData.reference_date
            },
            inflation: {
                tuik: {
                    value: tuikRes.data?.inflation_tuik || 0,
                    reference_date: tuikRes.data?.reference_date || baseData.reference_date
                },
                enag: {
                    value: enagRes.data?.inflation_enag || 0,
                    reference_date: enagRes.data?.reference_date || baseData.reference_date
                },
                ito: {
                    value: itoRes.data?.inflation_ito || 0,
                    reference_date: itoRes.data?.reference_date || baseData.reference_date
                }
            }
        };

    } catch (err) {
        console.error('getEconomicIndicators exception:', err);
        return null;
    }
};

// Deprecated but kept for backward compatibility if needed, though we will replace usage
export const getLatestLivingStandards = async (): Promise<ViewLivingStandards | null> => {
    return null; // Disabled in favor of getEconomicIndicators
};

export const getLivingStandardsHistory = async (limit: number = 13): Promise<ViewLivingStandards[]> => {
    try {
        // Fetch last N months descending (latest first)
        const { data, error } = await supabase
            .from('view_living_standards')
            .select('*')
            .order('reference_date', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('getLivingStandardsHistory error:', error);
            return [];
        }

        // Reverse to have chronological order (Jan -> Dec)
        return (data || []).reverse();
    } catch (err) {
        console.error('getLivingStandardsHistory exception:', err);
        return [];
    }
};
