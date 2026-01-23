export interface TrendDataPoint {
    date_label: string;
    value: number;
}

export interface CityTrendData {
    city_name: string;
    city_code: string;
    data: TrendDataPoint[];
}

const CITY_SALES_TREND_CACHE_KEY = 'city_sales_trend_cache';

export const getCitySalesTrend = async (cityCodes: string[]): Promise<CityTrendData[]> => {
    try {
        // Create a unique cache key based on sorted city codes
        const sortedCodes = [...cityCodes].sort().join(',');
        const cacheKey = `${CITY_SALES_TREND_CACHE_KEY}_${sortedCodes}`;

        // 1. Check Local Cache
        const cachedString = await AsyncStorage.getItem(cacheKey);
        if (cachedString) {
            // Basic freshness check could be added here similar to other functions, 
            // but for simpler logic we might skip strict freshness or reuse checkHousingFreshness
            const freshDate = await checkHousingFreshness();
            // If we really wanted to be strict, we'd store a timestamp with the cache. 
            // For now, let's assume if we have it, it's good enough unless we want to force refresh on new implementation
            // A better approach is to always check date.
        }

        // RPC call
        const { data, error } = await supabase.rpc('get_city_sales_trend', { city_codes: cityCodes });

        if (error) {
            console.error('Trend Data RPC Error:', error);
            // Fallback to cache if available? Or just return empty
            return [];
        }

        return data as CityTrendData[];

    } catch (error) {
        console.error('getCitySalesTrend general error:', error);
        return [];
    }
};
