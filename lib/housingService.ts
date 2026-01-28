import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export interface HousingSummary {
    total_sales: number;
    percent_change: number;
    direction: 'up' | 'down' | 'neutral';
    reference_date: string;
}

const HOUSING_CACHE_KEY = 'housing_summary_cache';

// A) Hafif Kontrol: Tazelik Kontrolü
// City code = TR ve total_sales_count IS NOT NULL olan son kaydı bul
const checkHousingFreshness = async (): Promise<string | null> => {
    try {
        const { data, error } = await supabase
            .from('housing_metrics')
            .select('reference_date')
            .eq('city_code', 'TR')
            .not('total_sales_count', 'is', null) // Sadece satış verisi girilmiş olanlar
            .order('reference_date', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            console.error('Konut tazelik kontrolü hatası:', error.message);
            return null;
        }

        return data?.reference_date || null;
    } catch (err) {
        console.error('Konut tazelik kontrolü exception:', err);
        return null;
    }
};

// B) Akıllı Veri Çekme
export const getHousingSummary = async (): Promise<{ data: HousingSummary | null; source: 'cache' | 'rpc' }> => {
    try {
        // 1. LocalStorage Kontrolü
        const cachedString = await AsyncStorage.getItem(HOUSING_CACHE_KEY);
        let cachedData: HousingSummary | null = null;

        if (cachedString) {
            cachedData = JSON.parse(cachedString);
        }

        // 2. Veritabanındaki Son Tarihi Öğren
        const freshDate = await checkHousingFreshness();

        if (!freshDate) {
            return { data: cachedData, source: 'cache' };
        }

        // 3. Karşılaştırma
        const isCacheStale = !cachedData || (new Date(freshDate) > new Date(cachedData.reference_date));

        if (isCacheStale) {
            console.log('🏘️ Konut Cache bayatlamış. RPC çağrılıyor...');

            const { data, error } = await supabase.rpc('get_dashboard_housing_summary');

            if (error || !data) {
                console.error('Konut RPC Hatası:', error);
                return { data: cachedData, source: 'cache' };
            }

            const newData: HousingSummary = data as HousingSummary;

            await AsyncStorage.setItem(HOUSING_CACHE_KEY, JSON.stringify(newData));

            return { data: newData, source: 'rpc' };
        } else {
            console.log('✅ Konut Cache güncel.');
            return { data: cachedData, source: 'cache' };
        }

    } catch (error) {
        console.error('getHousingSummary genel hata:', error);
        return { data: null, source: 'cache' };
    }
};

const REAL_ESTATE_HEADER_CACHE_KEY = 'real_estate_header_cache';

export interface RealEstateHeaderStats {
    interest_card: {
        value: number;
        change: number;
        direction: 'up' | 'down' | 'neutral';
        reference_date: string;
    };
    sales_card: {
        value: number;
        percent_change: number;
        direction: 'up' | 'down' | 'neutral';
        reference_date: string;
    };
    cost_card: {
        value: number;
        percent_change: number;
        direction: 'up' | 'down' | 'neutral';
        reference_date: string;
    };
}

export const getRealEstateHeader = async (): Promise<{ data: RealEstateHeaderStats | null; source: 'cache' | 'rpc' }> => {
    try {
        const cachedString = await AsyncStorage.getItem(REAL_ESTATE_HEADER_CACHE_KEY);
        let cachedData: RealEstateHeaderStats | null = null;

        if (cachedString) {
            cachedData = JSON.parse(cachedString);
        }

        const freshDate = await checkHousingFreshness();

        if (!freshDate) {
            return { data: cachedData, source: 'cache' };
        }

        // Check against sales_card date as a proxy for freshness, or just general freshness if data is null
        const isCacheStale = !cachedData || (new Date(freshDate) > new Date(cachedData.sales_card.reference_date));

        if (isCacheStale) {
            console.log('🏘️ Emlak Header Cache bayatlamış. RPC çağrılıyor...');

            const { data, error } = await supabase.rpc('get_real_estate_header_stats');

            if (error || !data) {
                console.error('Emlak Header RPC Hatası:', error);
                return { data: cachedData, source: 'cache' };
            }

            const newData: RealEstateHeaderStats = data as RealEstateHeaderStats;
            await AsyncStorage.setItem(REAL_ESTATE_HEADER_CACHE_KEY, JSON.stringify(newData));

            return { data: newData, source: 'rpc' };
        } else {
            console.log('✅ Emlak Header Cache güncel.');
            return { data: cachedData, source: 'cache' };
        }

    } catch (error) {
        console.error('getRealEstateHeader genel hata:', error);
        return { data: null, source: 'cache' };
    }
};

const SALES_BREAKDOWN_CACHE_KEY = 'real_estate_sales_breakdown_cache';

export interface SalesLikelihoodItem {
    name: string;
    value: number;
    share: number;
    change_rate: number;
    direction: 'up' | 'down' | 'neutral';
}

export interface RealEstateSalesBreakdown {
    monthly: {
        label: string;
        payment_type: SalesLikelihoodItem[];
        housing_type: SalesLikelihoodItem[];
    };
    yearly: {
        label: string;
        payment_type: SalesLikelihoodItem[];
        housing_type: SalesLikelihoodItem[];
    };
}

export interface CityItem {
    city_code: string;
    city_name: string;
}

export const getActiveCities = async (): Promise<CityItem[]> => {
    try {
        const { data, error } = await supabase.rpc('get_active_cities');

        if (error) {
            console.error('Şehir listesi hatası:', error);
            return [];
        }

        return (data || []).map((item: any) => ({
            city_code: item.city_code || item.code || item.id,
            city_name: item.city_name || item.name || item.title
        }));
    } catch (error) {
        console.error('getActiveCities genel hata:', error);
        return [];
    }
};

export const getSalesBreakdown = async (cityCode: string = 'TR'): Promise<{ data: RealEstateSalesBreakdown | null; source: 'cache' | 'rpc' }> => {
    try {
        // Cache key includes city code
        const cacheKey = `${SALES_BREAKDOWN_CACHE_KEY}_${cityCode}`;
        const refDateKey = `${SALES_BREAKDOWN_CACHE_KEY}_${cityCode}_ref_date`;

        const cachedString = await AsyncStorage.getItem(cacheKey);
        let cachedData: RealEstateSalesBreakdown | null = null;

        if (cachedString) {
            cachedData = JSON.parse(cachedString);
        }

        const freshDate = await checkHousingFreshness();

        if (!freshDate) {
            return { data: cachedData, source: 'cache' };
        }

        const lastRefDate = await AsyncStorage.getItem(refDateKey);
        const isCacheStale = !cachedData || !lastRefDate || (new Date(freshDate) > new Date(lastRefDate));

        if (isCacheStale) {
            console.log(`🧪 Satış Dağılımı (${cityCode}) Cache bayatlamış. RPC çağrılıyor...`);

            // RPC now accepts city_code
            const { data, error } = await supabase.rpc('get_real_estate_sales_breakdown', { target_city_code: cityCode });

            if (error || !data) {
                console.error('Satış Dağılımı RPC Hatası:', error);
                return { data: cachedData, source: 'cache' };
            }

            const newData: RealEstateSalesBreakdown = data as RealEstateSalesBreakdown;
            await AsyncStorage.setItem(cacheKey, JSON.stringify(newData));
            await AsyncStorage.setItem(refDateKey, freshDate);

            return { data: newData, source: 'rpc' };
        } else {
            console.log(`✅ Satış Dağılımı (${cityCode}) Cache güncel.`);
            return { data: cachedData, source: 'cache' };
        }

    } catch (error) {
        console.error('getSalesBreakdown genel hata:', error);
        return { data: null, source: 'cache' };
    }
};

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
        const sortedCodes = cityCodes.length > 0 ? [...cityCodes].sort().join('_') : 'TOP5';
        const cacheKey = `${CITY_SALES_TREND_CACHE_KEY}_${sortedCodes}`;

        // Simple cache logic: check freshness like others
        const freshDate = await checkHousingFreshness();
        if (!freshDate) {
            // If we can't get fresh date, try to return cached data if exists, else RPC
            const cachedString = await AsyncStorage.getItem(cacheKey);
            return cachedString ? JSON.parse(cachedString) : [];
        }

        // Check if we have valid cache
        const cachedString = await AsyncStorage.getItem(cacheKey);
        const refDateKey = `${cacheKey}_ref_date`;
        const lastRefDate = await AsyncStorage.getItem(refDateKey);

        const isCacheStale = !cachedString || !lastRefDate || (new Date(freshDate) > new Date(lastRefDate));

        if (isCacheStale) {
            console.log(`📈 Trend Data (${sortedCodes}) Cache bayatlamış. RPC çağrılıyor...`);
            const { data, error } = await supabase.rpc('get_city_sales_trend', { target_city_codes: cityCodes });

            if (error) {
                console.error('Trend Data RPC Error:', error);
                return cachedString ? JSON.parse(cachedString) : [];
            }

            // Save to cache
            await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
            await AsyncStorage.setItem(refDateKey, freshDate);

            return data as CityTrendData[];
        } else {
            console.log(`✅ Trend Data (${sortedCodes}) Cache güncel.`);
            return JSON.parse(cachedString);
        }

    } catch (error) {
        console.error('getCitySalesTrend general error:', error);
        return [];
    }
};
const REAL_ESTATE_SUPPLY_CACHE_KEY = 'real_estate_supply_stats_cache';

export interface RealEstateSupplyStats {
    listings: {
        for_sale: number;
        for_rent: number;
        reference_date: string;
    };
    permits: {
        total_units: number;
        avg_sqm: number;
        percent_change: number;
        direction: 'up' | 'down' | 'neutral';
        reference_date: string;
    };
}

export const getRealEstateSupplyStats = async (): Promise<{ data: RealEstateSupplyStats | null; source: 'cache' | 'rpc' }> => {
    try {
        const CACHE_DURATION = 30 * 60 * 1000; // 30 Minutes
        const fetchTimeKey = `${REAL_ESTATE_SUPPLY_CACHE_KEY}_time`;

        const cachedString = await AsyncStorage.getItem(REAL_ESTATE_SUPPLY_CACHE_KEY);
        const lastFetchTimeStr = await AsyncStorage.getItem(fetchTimeKey);

        let cachedData: RealEstateSupplyStats | null = null;
        if (cachedString) {
            cachedData = JSON.parse(cachedString);
        }

        const now = Date.now();
        const lastFetchTime = lastFetchTimeStr ? parseInt(lastFetchTimeStr, 10) : 0;
        const isCacheExpired = !cachedData || (now - lastFetchTime > CACHE_DURATION);

        if (isCacheExpired) {
            console.log('🏗️ Arz ve Gelecek Cache süresi dolmuş. RPC çağrılıyor...');
            const { data, error } = await supabase.rpc('get_real_estate_supply_stats');

            if (error || !data) {
                console.error('Arz RPC Hatası:', error);
                // Return cache if RPC fails
                return { data: cachedData, source: 'cache' };
            }

            const newData: RealEstateSupplyStats = data as RealEstateSupplyStats;
            await AsyncStorage.setItem(REAL_ESTATE_SUPPLY_CACHE_KEY, JSON.stringify(newData));
            await AsyncStorage.setItem(fetchTimeKey, now.toString());

            return { data: newData, source: 'rpc' };
        } else {
            console.log('✅ Arz ve Gelecek Cache güncel (Time-based).');
            return { data: cachedData, source: 'cache' };
        }

    } catch (error) {
        console.error('getRealEstateSupplyStats genel hata:', error);
        return { data: null, source: 'cache' };
    }
};

export interface RealEstateMacroData {
    period_label: string;
    total_sales: number;
    interest_rate: number;
    year_month: string; // YYYY-MM
}

const REAL_ESTATE_MACRO_CACHE_KEY = 'real_estate_macro_cache';

export const getRealEstateMacroHistory = async (monthsBack: number = 60): Promise<{ data: RealEstateMacroData[] | null; source: 'cache' | 'rpc' }> => {
    try {
        // Cache key includes the time period filter
        const cacheKey = `${REAL_ESTATE_MACRO_CACHE_KEY}_${monthsBack}`;
        const refDateKey = `${cacheKey}_ref_date`;

        const cachedString = await AsyncStorage.getItem(cacheKey);
        let cachedData: RealEstateMacroData[] | null = null;

        if (cachedString) {
            cachedData = JSON.parse(cachedString);
        }

        // Check for data freshness
        const freshDate = await checkHousingFreshness();

        if (!freshDate) {
            return { data: cachedData, source: 'cache' };
        }

        const lastRefDate = await AsyncStorage.getItem(refDateKey);
        const isCacheStale = !cachedData || !lastRefDate || (new Date(freshDate) > new Date(lastRefDate));

        if (isCacheStale) {
            console.log(`🌍 Büyük Resim (${monthsBack} Ay) Cache bayatlamış. RPC çağrılıyor...`);

            const { data, error } = await supabase.rpc('get_real_estate_macro_history', { months_back: monthsBack });

            if (error || !data) {
                console.error('Macro Cycle RPC Hatası:', error);
                return { data: cachedData, source: 'cache' };
            }

            // The RPC returns data, we cast it
            const newData: RealEstateMacroData[] = data as RealEstateMacroData[];

            await AsyncStorage.setItem(cacheKey, JSON.stringify(newData));
            await AsyncStorage.setItem(refDateKey, freshDate);

            return { data: newData, source: 'rpc' };
        } else {
            console.log(`✅ Büyük Resim (${monthsBack} Ay) Cache güncel.`);
            return { data: cachedData, source: 'cache' };
        }

    } catch (error) {
        console.error('getRealEstateMacroHistory genel hata:', error);
        return { data: null, source: 'cache' };
    }
};

export interface TrendPermitData {
    period_label: string;
    permit_count: number;
    avg_m2: number;
    year_month: string;
}

const HOUSING_PERMIT_TREND_CACHE_KEY = 'housing_permit_trend_cache';

export const getHousingPermitTrends = async (monthsBack: number = 24): Promise<{ data: TrendPermitData[] | null; source: 'cache' | 'rpc' }> => {
    try {
        const cacheKey = `${HOUSING_PERMIT_TREND_CACHE_KEY}_${monthsBack}`;
        const refDateKey = `${cacheKey}_ref_date`;

        const cachedString = await AsyncStorage.getItem(cacheKey);
        let cachedData: TrendPermitData[] | null = null;

        if (cachedString) {
            cachedData = JSON.parse(cachedString);
        }

        const freshDate = await checkHousingFreshness();
        if (!freshDate) {
            return { data: cachedData, source: 'cache' };
        }

        const lastRefDate = await AsyncStorage.getItem(refDateKey);
        const isCacheStale = !cachedData || !lastRefDate || (new Date(freshDate) > new Date(lastRefDate));

        if (isCacheStale) {
            console.log(`🏗️ Konut İzni Trend (${monthsBack} Ay) Cache bayatlamış. RPC çağrılıyor...`);
            const { data, error } = await supabase.rpc('get_housing_permit_trends', { months_back: monthsBack });

            if (error) {
                console.warn('Permit Trend RPC Hatası (Parametreli):', error.message);

                // Fallback: Try calling without parameters
                console.log('⚠️ Parametresiz RPC deneniyor...');
                const { data: fallbackData, error: fallbackError } = await supabase.rpc('get_housing_permit_trends');

                if (fallbackError || !fallbackData) {
                    console.error('Permit Trend RPC Hatası (Parametresiz):', fallbackError);
                    return { data: cachedData, source: 'cache' };
                }

                const newData: TrendPermitData[] = fallbackData as TrendPermitData[];
                await AsyncStorage.setItem(cacheKey, JSON.stringify(newData));
                await AsyncStorage.setItem(refDateKey, freshDate);

                return { data: newData, source: 'rpc' };
            }

            if (!data) {
                return { data: cachedData, source: 'cache' };
            }

            const newData: TrendPermitData[] = data as TrendPermitData[];
            await AsyncStorage.setItem(cacheKey, JSON.stringify(newData));
            await AsyncStorage.setItem(refDateKey, freshDate);

            return { data: newData, source: 'rpc' };
        } else {
            console.log(`✅ Konut İzni Trend (${monthsBack} Ay) Cache güncel.`);
            return { data: cachedData, source: 'cache' };
        }

    } catch (error) {
        console.error('getHousingPermitTrends genel hata:', error);
        return { data: null, source: 'cache' };
    }
};
