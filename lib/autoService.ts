import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export interface AutoSummary {
    total_sales: number;
    percent_change: number;
    direction: 'up' | 'down' | 'neutral';
    reference_date: string;
}

const AUTO_CACHE_KEY = 'auto_summary_cache';

// A) Hafif Kontrol: Tazelik Kontrolü
const checkAutoFreshness = async (): Promise<string | null> => {
    try {
        const { data, error } = await supabase
            .from('automotive_sales')
            .select('reference_date')
            .eq('fuel_type_id', 7) // Toplam Satışlar
            .gt('quantity', 0)     // Satış adedi 0'dan büyük olmalı
            .order('reference_date', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            console.error('Oto tazelik kontrolü hatası:', error.message);
            return null;
        }

        return data?.reference_date || null;
    } catch (err) {
        console.error('Oto tazelik kontrolü exception:', err);
        return null;
    }
};

// B) Akıllı Veri Çekme
export const getAutoSummary = async (): Promise<{ data: AutoSummary | null; source: 'cache' | 'rpc' }> => {
    try {
        const cachedString = await AsyncStorage.getItem(AUTO_CACHE_KEY);
        let cachedData: AutoSummary | null = null;

        if (cachedString) {
            cachedData = JSON.parse(cachedString);
        }

        const freshDate = await checkAutoFreshness();

        if (!freshDate) {
            return { data: cachedData, source: 'cache' };
        }

        const isCacheStale = !cachedData || (new Date(freshDate) > new Date(cachedData.reference_date));

        if (isCacheStale) {
            console.log('🚗 Oto Cache bayatlamış. RPC çağrılıyor...');

            const { data, error } = await supabase.rpc('get_dashboard_auto_summary');

            if (error || !data) {
                console.error('Oto RPC Hatası:', error);
                return { data: cachedData, source: 'cache' };
            }

            const newData: AutoSummary = data as AutoSummary;
            await AsyncStorage.setItem(AUTO_CACHE_KEY, JSON.stringify(newData));

            return { data: newData, source: 'rpc' };
        } else {
            console.log('✅ Oto Cache güncel.');
            return { data: cachedData, source: 'cache' };
        }

    } catch (error) {
        console.error('getAutoSummary genel hata:', error);
        return { data: null, source: 'cache' };
    }
};

export interface AutoPageHeaderStats {
    monthly_card: {
        total_sales: number;
        percent_change: number;
        direction: 'up' | 'down' | 'neutral';
        reference_date: string;
    };
    yearly_card: {
        display_year: number;
        current_year_total: number;
        prev_year_total: number;
    };
    top_fuel_card: {
        fuel_name: string;
        share_percent: number;
        reference_date: string;
    };
}


const AUTO_HEADER_CACHE_KEY = 'auto_header_stats_cache';

export const getAutoPageHeader = async (): Promise<{ data: AutoPageHeaderStats | null; source: 'cache' | 'rpc' }> => {
    try {
        const cachedString = await AsyncStorage.getItem(AUTO_HEADER_CACHE_KEY);
        let cachedData: AutoPageHeaderStats | null = null;

        if (cachedString) {
            cachedData = JSON.parse(cachedString);
        }

        const freshDate = await checkAutoFreshness();

        if (!freshDate) {
            return { data: cachedData, source: 'cache' };
        }

        const isCacheStale = !cachedData || (new Date(freshDate) > new Date(cachedData.monthly_card.reference_date));

        if (isCacheStale) {
            console.log('🚗 Oto Header Cache bayatlamış. RPC çağrılıyor...');

            const { data, error } = await supabase.rpc('get_auto_page_header_stats');

            if (error || !data) {
                console.error('Oto Header RPC Hatası:', error);
                return { data: cachedData, source: 'cache' };
            }

            const newData: AutoPageHeaderStats = data as AutoPageHeaderStats;
            await AsyncStorage.setItem(AUTO_HEADER_CACHE_KEY, JSON.stringify(newData));

            return { data: newData, source: 'rpc' };
        } else {
            console.log('✅ Oto Header Cache güncel.');
            return { data: cachedData, source: 'cache' };
        }

    } catch (error) {
        console.error('getAutoPageHeader genel hata:', error);
        return { data: null, source: 'cache' };
    }
};

export interface FuelAnalysisItem {
    fuel_name: string;
    sales_count: number;
    share_percent: number;
    change_rate: number;
    direction: 'up' | 'down' | 'neutral';
}

export interface FuelAnalysisResponse {
    monthly: {
        label: string;
        items: FuelAnalysisItem[];
    };
    yearly: {
        label: string;
        items: FuelAnalysisItem[];
    };
}

// CACHE BUSTING: Changed key to v3 for new monthly/yearly structure
const FUEL_ANALYSIS_CACHE_KEY = 'fuel_analysis_cache_v3';

export const getFuelAnalysis = async (): Promise<{ data: FuelAnalysisResponse | null; source: 'cache' | 'rpc' }> => {
    try {
        const cachedString = await AsyncStorage.getItem(FUEL_ANALYSIS_CACHE_KEY);
        let cachedData: FuelAnalysisResponse | null = null;

        if (cachedString) {
            cachedData = JSON.parse(cachedString);
        }

        const freshDate = await checkAutoFreshness();

        if (!freshDate) {
            return { data: cachedData, source: 'cache' };
        }

        // UNIQUE fetch date key for this service
        const lastFetchDate = await AsyncStorage.getItem('fuel_last_fetch_date_v3');

        // Check if data is stale OR if the cached data structure is valid for new format
        // We check if 'monthly' property exists to validate structure
        const isStructureValid = cachedData && cachedData.monthly && Array.isArray(cachedData.monthly.items);
        const isCacheStale = !cachedData || !isStructureValid || !lastFetchDate || (new Date(freshDate) > new Date(lastFetchDate));

        if (isCacheStale) {
            console.log('⛽ Yakıt Analizi Cache bayatlamış (v3). RPC çağrılıyor...');

            const { data, error } = await supabase.rpc('get_fuel_distribution_analysis');

            if (error || !data) {
                console.error('Yakıt Analizi RPC Hatası:', error);
                return { data: cachedData, source: 'cache' };
            }

            const newData: FuelAnalysisResponse = data as FuelAnalysisResponse;

            await AsyncStorage.setItem(FUEL_ANALYSIS_CACHE_KEY, JSON.stringify(newData));
            await AsyncStorage.setItem('fuel_last_fetch_date_v3', freshDate);

            return { data: newData, source: 'rpc' };
        } else {
            console.log('✅ Yakıt Analizi Cache güncel (v3).');
            return { data: cachedData, source: 'cache' };
        }

    } catch (error) {
        console.error('getFuelAnalysis genel hata:', error);
        return { data: null, source: 'cache' };
    }
};

export interface AutoSalesHistoryItem {
    reference_date: string;
    quantity: number;
}

const HISTORY_CACHE_KEY = 'auto_sales_history_cache';

export const getSalesHistory = async (): Promise<{ data: AutoSalesHistoryItem[] | null; source: 'cache' | 'rpc' }> => {
    try {
        const cachedString = await AsyncStorage.getItem(HISTORY_CACHE_KEY);
        let cachedData: AutoSalesHistoryItem[] | null = null;

        if (cachedString) {
            cachedData = JSON.parse(cachedString);
        }

        const freshDate = await checkAutoFreshness();

        if (!freshDate) {
            return { data: cachedData, source: 'cache' };
        }

        let maxCachedDate = '';
        if (cachedData && cachedData.length > 0) {
            maxCachedDate = cachedData[cachedData.length - 1].reference_date;
        }

        const isCacheStale = !cachedData || !maxCachedDate || (new Date(freshDate) > new Date(maxCachedDate));

        if (isCacheStale) {
            console.log('📈 Tarihsel Trend Cache bayatlamış. RPC çağrılıyor...');

            const { data, error } = await supabase.rpc('get_auto_sales_history');

            if (error) {
                console.error('Tarihsel Trend RPC Hatası:', error);
                return { data: cachedData, source: 'cache' };
            }

            const historyData: AutoSalesHistoryItem[] = (data || []).map((item: any) => ({
                reference_date: item.reference_date,
                quantity: item.quantity
            })).sort((a: any, b: any) => new Date(a.reference_date).getTime() - new Date(b.reference_date).getTime());

            await AsyncStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(historyData));

            return { data: historyData, source: 'rpc' };
        } else {
            console.log('✅ Tarihsel Trend Cache güncel.');
            return { data: cachedData, source: 'cache' };
        }

    } catch (error) {
        console.error('getSalesHistory genel hata:', error);
        return { data: null, source: 'cache' };
    }
};

export interface BrandAnalysis {
    reference_date: string;
    summary: {
        domestic_share: number;
        import_share: number;
    };
    top_brands: {
        name: string;
        total_qty: number;
        domestic_qty: number;
        import_qty: number;
        market_share: number;
    }[];
}

const BRAND_ANALYSIS_CACHE_KEY = 'brand_analysis_cache';

export const getBrandAnalysis = async (): Promise<{ data: BrandAnalysis | null; source: 'cache' | 'rpc' }> => {
    try {
        const cachedString = await AsyncStorage.getItem(BRAND_ANALYSIS_CACHE_KEY);
        let cachedData: BrandAnalysis | null = null;

        if (cachedString) {
            cachedData = JSON.parse(cachedString);
        }

        const freshDate = await checkAutoFreshness();

        if (!freshDate) {
            return { data: cachedData, source: 'cache' };
        }

        const isCacheStale = !cachedData || (new Date(freshDate) > new Date(cachedData.reference_date));

        if (isCacheStale) {
            console.log('🏭 Marka Analizi Cache bayatlamış. RPC çağrılıyor...');

            const { data, error } = await supabase.rpc('get_brand_market_analysis');

            if (error || !data) {
                console.error('Marka Analizi RPC Hatası:', error);
                return { data: cachedData, source: 'cache' };
            }

            const newData: BrandAnalysis = data as BrandAnalysis;
            await AsyncStorage.setItem(BRAND_ANALYSIS_CACHE_KEY, JSON.stringify(newData));

            return { data: newData, source: 'rpc' };
        } else {
            console.log('✅ Marka Analizi Cache güncel.');
            return { data: cachedData, source: 'cache' };
        }

    } catch (error) {
        console.error('getBrandAnalysis genel hata:', error);
        return { data: null, source: 'cache' };
    }
};

