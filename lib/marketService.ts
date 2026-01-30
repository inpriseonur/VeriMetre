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
        tuik: { value: number; reference_date: string; trend: 'up' | 'down' | 'neutral' };
        enag: { value: number; reference_date: string; trend: 'up' | 'down' | 'neutral' };
        ito: { value: number; reference_date: string; trend: 'up' | 'down' | 'neutral' };
        average: { value: number; reference_date: string; trend: 'up' | 'down' | 'neutral' };
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
        const [tuikRes, enagRes, itoRes, avgRes] = await Promise.all([
            // TUIK
            supabase
                .from('view_living_standards')
                .select('inflation_tuik, reference_date')
                .not('inflation_tuik', 'is', null)
                .order('reference_date', { ascending: false })
                .limit(2),
            // ENAG
            supabase
                .from('view_living_standards')
                .select('inflation_enag, reference_date')
                .not('inflation_enag', 'is', null)
                .order('reference_date', { ascending: false })
                .limit(2),
            // ITO
            supabase
                .from('view_living_standards')
                .select('inflation_ito, reference_date')
                .not('inflation_ito', 'is', null)
                .order('reference_date', { ascending: false })
                .limit(2),
            // AVERAGE (New)
            supabase
                .from('view_living_standards')
                .select('inflation_average, reference_date')
                .not('inflation_average', 'is', null)
                .order('reference_date', { ascending: false })
                .limit(2)
        ]);

        const getTrend = (current: number, previous: number): 'up' | 'down' | 'neutral' => {
            if (current > previous) return 'up';
            if (current < previous) return 'down';
            return 'neutral';
        };

        const tuikData = tuikRes.data || [];
        const enagData = enagRes.data || [];
        const itoData = itoRes.data || [];
        const avgData = avgRes.data || [];

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
                    value: tuikData[0]?.inflation_tuik || 0,
                    reference_date: tuikData[0]?.reference_date || baseData.reference_date,
                    trend: getTrend(tuikData[0]?.inflation_tuik || 0, tuikData[1]?.inflation_tuik || 0)
                },
                enag: {
                    value: enagData[0]?.inflation_enag || 0,
                    reference_date: enagData[0]?.reference_date || baseData.reference_date,
                    trend: getTrend(enagData[0]?.inflation_enag || 0, enagData[1]?.inflation_enag || 0)
                },
                ito: {
                    value: itoData[0]?.inflation_ito || 0,
                    reference_date: itoData[0]?.reference_date || baseData.reference_date,
                    trend: getTrend(itoData[0]?.inflation_ito || 0, itoData[1]?.inflation_ito || 0)
                },
                average: {
                    value: avgData[0]?.inflation_average || 0,
                    reference_date: avgData[0]?.reference_date || baseData.reference_date,
                    trend: getTrend(avgData[0]?.inflation_average || 0, avgData[1]?.inflation_average || 0)
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
        // Fetch last N months descending (latest first) to ensure we get the *latest* data
        const { data, error } = await supabase
            .from('view_living_standards')
            .select('*')
            .order('reference_date', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('getLivingStandardsHistory error:', error);
            return [];
        }

        // Sort Ascending (Oldest -> Newest)
        return (data || []).sort((a, b) => new Date(a.reference_date).getTime() - new Date(b.reference_date).getTime());
    } catch (err) {
        console.error('getLivingStandardsHistory exception:', err);
        return [];
    }
};

// --- Rent Calculator Helper ---
export interface LatestInflationRates {
    tuik: number;
    enag: number;
    ito: number;
}

export const getLatestInflationRates = async (): Promise<LatestInflationRates> => {
    try {
        // Fetch latest yearly rate for each source from view_inflation_calculated
        const { data, error } = await supabase
            .from('view_inflation_calculated')
            .select('source_id, calculated_yearly_rate')
            .in('source_id', [1, 2, 3]) // 1: ENAG, 2: TUIK, 3: ITO (Assuming IDs based on previous code)
            .order('reference_date', { ascending: false });

        if (error) {
            console.error('getLatestInflationRates error:', error);
            return { tuik: 0, enag: 0, ito: 0 };
        }

        // We might get multiple rows per source, we only want the absolute latest one for each.
        // Since we ordered by reference_date desc, the first occurrence of each source_id is the latest.
        const rates: LatestInflationRates = { tuik: 0, enag: 0, ito: 0 };
        const found = { 1: false, 2: false, 3: false };

        for (const row of data || []) {
            if (!found[row.source_id as 1 | 2 | 3]) {
                if (row.source_id === 1) rates.enag = row.calculated_yearly_rate;
                else if (row.source_id === 2) rates.tuik = row.calculated_yearly_rate;
                else if (row.source_id === 3) rates.ito = row.calculated_yearly_rate;
                found[row.source_id as 1 | 2 | 3] = true;
            }
        }

        return rates;

    } catch (err) {
        console.error('getLatestInflationRates exception:', err);
        return { tuik: 0, enag: 0, ito: 0 };
    }
};

// --- Personal Purchasing Power Module ---

export interface UserPurchasingPower {
    reference_date: string;
    user_salary: number;
    user_gold_equivalent: number;
    user_usd_equivalent: number;
    inflation_rate: number;
}

export const getUserPurchasingPower = async (): Promise<UserPurchasingPower[]> => {
    try {
        const { data, error } = await supabase.rpc('get_user_purchasing_power');

        if (error) {
            console.error('getUserPurchasingPower error:', error);
            return [];
        }

        // Sort Ascending (Oldest -> Newest)
        return (data || []).sort((a: any, b: any) => new Date(a.reference_date).getTime() - new Date(b.reference_date).getTime());
    } catch (err) {
        console.error('getUserPurchasingPower exception:', err);
        return [];
    }
};

export const upsertUserSalary = async (amount: number, validFrom: string): Promise<{ success: boolean; error?: any }> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'User not authenticated' };

        // Using 'salary_history' based on user report
        // Assuming unique constraint is on (user_id, valid_from) or we just insert if it's history
        // If it is truly history, maybe we SHOULD be inserting new rows every time? 
        // But the previous error 'PGRST205' said table 'user_salaries' not found. 
        // So 'salary_history' must be the correct one.

        const { error } = await supabase
            .from('salary_history')
            .upsert({
                user_id: user.id,
                amount: amount,
                valid_from: validFrom
            }, { onConflict: 'user_id, valid_from' });

        if (error) {
            console.error('upsertUserSalary error:', error);
            return { success: false, error };
        }

        return { success: true };
    } catch (err) {
        return { success: false, error: err };
    }
};

export const getLastSalaryEntry = async (): Promise<{ amount: number, valid_from: string } | null> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('salary_history')
            .select('amount, valid_from')
            .eq('user_id', user.id)
            .order('valid_from', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            // It's normal to have no rows if user never entered salary
            if (error.code !== 'PGRST116') {
                console.error('getLastSalaryEntry error:', error);
            }
            return null;
        }

        return data;
    } catch (err) {
        console.error('getLastSalaryEntry exception:', err);
        return null;
    }
};

export const getActiveAnnouncement = async (): Promise<import('@/types/database').Announcement | null> => {
    try {
        const { data, error } = await supabase.rpc('get_active_announcement');

        if (error) {
            console.error('getActiveAnnouncement error:', error);
            return null;
        }

        if (!data) return null;

        // Create a normalized object
        let announcement = data;

        // If it's an array (which is common for RPCs returning setof record), take the first item
        if (Array.isArray(data)) {
            if (data.length === 0) return null;
            announcement = data[0];
        }

        console.log('Active Announcement Data:', announcement);
        return announcement as import('@/types/database').Announcement;
    } catch (err) {
        console.error('getActiveAnnouncement exception:', err);
        return null;
    }
};
