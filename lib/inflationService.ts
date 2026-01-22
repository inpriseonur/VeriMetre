import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export interface TuikSummary {
    rate: number;
    change: number;
    direction: 'up' | 'down' | 'neutral';
    reference_date: string;
}

const CACHE_KEY = 'tuik_summary_cache';

// A) Hafif Kontrol: Sadece Tarih Sorgula
// RPC çağırmaz, sadece tablodaki en güncel tarihi döndürür.
const checkTuikFreshness = async (): Promise<string | null> => {
    try {
        const { data, error } = await supabase
            .from('inflation_metrics')
            .select('reference_date')
            .eq('source_id', 2) // TÜİK
            .order('reference_date', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            console.error('Tazelik kontrolü hatası:', error.message);
            return null;
        }

        return data?.reference_date || null;
    } catch (err) {
        console.error('Tazelik kontrolü exception:', err);
        return null;
    }
};

// B) Akıllı Veri Çekme
export const getTuikSummary = async (): Promise<{ data: TuikSummary | null; source: 'cache' | 'rpc' }> => {
    try {
        // 1. LocalStorage Kontrolü
        const cachedString = await AsyncStorage.getItem(CACHE_KEY);
        let cachedData: TuikSummary | null = null;

        if (cachedString) {
            cachedData = JSON.parse(cachedString);
        }

        // 2. Veritabanındaki Son Tarihi Öğren
        const freshDate = await checkTuikFreshness();

        if (!freshDate) {
            // Veritabanına ulaşılamadıysa ve cache varsa cache dön, yoksa null
            return { data: cachedData, source: 'cache' };
        }

        // 3. KARŞILAŞTIRMA MANTIĞI

        // Senaryo 1 & 2: Cache boş VEYA Bayatlamış (Fresh > Cache)
        const isCacheStale = !cachedData || (new Date(freshDate) > new Date(cachedData.reference_date));

        if (isCacheStale) {
            console.log('🔄 Cache bayatlamış veya yok. RPC çağırılıyor...');

            // RPC Çağır
            const { data, error } = await supabase.rpc('get_dashboard_tuik_summary');

            if (error || !data) {
                console.error('RPC Hatası:', error);
                // RPC patlarsa varsa eski cache'i dönelim bari
                return { data: cachedData, source: 'cache' };
            }

            // Gelen veri formatı RPC'den düzgün gelmeli. 
            // Supabase RPC result'ı 'data' değişkenindedir.
            const newData: TuikSummary = data as TuikSummary;

            // Cache'i güncelle
            await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newData));

            return { data: newData, source: 'rpc' };
        }

        // Senaryo 3: Veri Aynı (Fresh <= Cache)
        else {
            console.log('✅ Cache güncel. RPC çağrılmadı.');
            return { data: cachedData, source: 'cache' };
        }

    } catch (error) {
        console.error('getTuikSummary genel hata:', error);
        return { data: null, source: 'cache' };
    }
};
