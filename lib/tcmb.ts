import axios from 'axios';

// TCMB Key yine lazım (Dolar/Euro için)
const TCMB_API_KEY = process.env.EXPO_PUBLIC_TCMB_API_KEY;
const MAX_RETRIES = 5;

// Sadece Dövizleri TCMB'den istiyoruz (Altını sildik buradan)
const TCMB_SERIES = 'TP.DK.USD.S.YTL-TP.DK.EUR.S.YTL';

export interface ExchangeRates {
    USD: number | null;
    EUR: number | null;
    Gold: number | null;
    BIST100: { price: string; rate: number } | null;
    Date: string;
}

const formatDate = (date: Date): string => {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
};

const getPreviousDate = (date: Date): Date => {
    const prev = new Date(date);
    prev.setDate(prev.getDate() - 1);
    return prev;
};

// YARDIMCI: Ücretsiz Altın Verisi (Truncgil API - Daha Sağlam)
const fetchFreeGoldPrice = async (): Promise<number | null> => {
    try {
        // Türkiye'nin en popüler açık kaynak finans API'si
        const response = await axios.get('https://finans.truncgil.com/today.json');

        // Veri yapısı: response.data['gram-altin'].Selling (veya 'Satis')
        const goldData = response.data['gram-altin'];

        // API keys are Turkish: Alış, Satış, Tür, Değişim
        if (goldData && goldData.Satış) {
            console.log("Altın Verisi (Truncgil):", goldData.Satış);

            // GELEN VERİ FORMATI:String "3.020,45" şeklinde geliyor.
            // ÖNCE: Binlik ayracı olan noktayı (.) siliyoruz -> "3020,45"
            // SONRA: Ondalık ayracı olan virgülü (,) noktaya (.) çeviriyoruz -> "3020.45"
            const cleanValue = goldData.Satış.replace(/\./g, '').replace(',', '.');

            return parseFloat(cleanValue);
        }
        return null;
    } catch (error) {
        console.log("Altın servisi (Truncgil) yanıt vermedi:", error);
        return null;
    }
};

// YARDIMCI: BIST 100 Verisi (Yahoo Finance Public API)
// Not: Yahoo Finance verileri genelde 15 dk gecikmeli olabilir (Borsa kuralı gereği)

// CACHE VARIABLES
let cachedBistData: { price: string; rate: number } | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 15 * 60 * 1000; // 15 Minutes

export const fetchBistData = async (): Promise<{ price: string; rate: number } | null> => {
    // 1. Check Cache
    const now = Date.now();
    if (cachedBistData && (now - lastFetchTime) < CACHE_DURATION) {
        // console.log("Serving BIST Data from Cache");
        return cachedBistData;
    }

    try {
        // Yahoo Finance BIST 100 Sembolü: XU100.IS
        const url = 'https://query1.finance.yahoo.com/v8/finance/chart/XU100.IS?interval=1d&range=1d';

        const response = await axios.get(url);
        const result = response.data?.chart?.result?.[0];

        if (result && result.meta) {
            // Son kapanış/işlem fiyatı
            const currentPrice = result.meta.regularMarketPrice;
            // Bir önceki kapanış (Değişimi hesaplamak için)
            const previousClose = result.meta.chartPreviousClose;

            // Yüzdelik Değişim Hesabı
            let changeRate = 0;
            if (currentPrice && previousClose) {
                changeRate = ((currentPrice - previousClose) / previousClose) * 100;
            }

            // Update Cache
            cachedBistData = {
                price: currentPrice.toLocaleString('tr-TR', { maximumFractionDigits: 0 }), // Örn: 9.150
                rate: changeRate // Örn: 1.5 (Pozitif veya negatif)
            };
            lastFetchTime = now;

            return cachedBistData;
        }

        // If API fails but we have stale cache, decide whether to return stale data or null.
        // For now, let's fallback to cache if available
        if (cachedBistData) return cachedBistData;

        return null;
    } catch (error) {
        console.log("BIST verisi alınamadı:", error);
        // Fallback to cache on error if exists
        if (cachedBistData) return cachedBistData;
        return null;
    }
};

export const fetchExchangeRates = async (
    date: Date = new Date(),
    retryCount: number = 0
): Promise<ExchangeRates | null> => {

    // 1. ADIM: Önce Altın ve BIST Fiyatını "Piyasadan" Çek
    let goldPrice = await fetchFreeGoldPrice();
    let bistData = await fetchBistData();

    if (!TCMB_API_KEY) return null;
    if (retryCount > MAX_RETRIES) return null;

    const dateStr = formatDate(date);

    // 2. ADIM: Dolar ve Euro'yu TCMB'den Çek
    const url = `https://evds2.tcmb.gov.tr/service/evds/series=${TCMB_SERIES}&startDate=${dateStr}&endDate=${dateStr}&type=json`;

    try {
        const response = await axios.get(url, { headers: { key: TCMB_API_KEY } });
        const items = response.data?.items;

        if (items && items.length > 0 && items[0]) {
            const item = items[0];
            const usdVal = item['TP_DK_USD_S_YTL'];
            const eurVal = item['TP_DK_EUR_S_YTL'];

            // Eğer Dolar yoksa (Hafta sonuysa), dünü dene
            if (!usdVal) {
                return fetchExchangeRates(getPreviousDate(date), retryCount + 1);
            }

            return {
                USD: parseFloat(usdVal),
                EUR: parseFloat(eurVal),
                Gold: goldPrice ? goldPrice : 0,
                BIST100: bistData, // New field (Syncs with updated Interface)
                Date: dateStr,
            };
        } else {
            // TCMB boş döndüyse dünü dene
            return fetchExchangeRates(getPreviousDate(date), retryCount + 1);
        }
    } catch (error) {
        // TCMB patlarsa dünü dene
        return fetchExchangeRates(getPreviousDate(date), retryCount + 1);
    }
};