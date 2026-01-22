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
// fuel_type_id = 7 (Toplam) ve quantity > 0 olan son kaydı bul
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
        // 1. LocalStorage Kontrolü
        const cachedString = await AsyncStorage.getItem(AUTO_CACHE_KEY);
        let cachedData: AutoSummary | null = null;

        if (cachedString) {
            cachedData = JSON.parse(cachedString);
        }

        // 2. Veritabanındaki Son Tarihi Öğren
        const freshDate = await checkAutoFreshness();

        if (!freshDate) {
            return { data: cachedData, source: 'cache' };
        }

        // 3. Karşılaştırma
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
