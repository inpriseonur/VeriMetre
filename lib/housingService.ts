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
