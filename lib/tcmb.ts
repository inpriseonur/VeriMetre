import axios from 'axios';

// TCMB Key yine lazım (Dolar/Euro için)
const TCMB_API_KEY = process.env.EXPO_PUBLIC_TCMB_API_KEY;
const MAX_RETRIES = 5;

// Sadece Dövizleri TCMB'den istiyoruz
const TCMB_SERIES = 'TP.DK.USD.S.YTL-TP.DK.EUR.S.YTL';

export interface ExchangeRates {
    USD: { price: number; rate: number } | null;
    EUR: { price: number; rate: number } | null;
    Gold: { price: number; rate: number } | null;
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

// YARDIMCI: Ücretsiz Altın Verisi (Truncgil API)
const fetchFreeGoldPrice = async (): Promise<{ price: number; rate: number } | null> => {
    try {
        const response = await axios.get('https://finans.truncgil.com/today.json');
        const goldData = response.data['gram-altin'];

        if (goldData && goldData.Satış) {
            const cleanValue = goldData.Satış.replace(/\./g, '').replace(',', '.');
            const price = parseFloat(cleanValue);

            // Parse Change Rate (% Değişim)
            let rate = 0;
            // Truncgil "Değişim" field might be like "%0,45" or "0,45"
            if (goldData.Değişim) {
                const cleanRate = goldData.Değişim.replace('%', '').replace(',', '.');
                rate = parseFloat(cleanRate);
            }

            return { price, rate };
        }
        return null;
    } catch (error) {
        console.log("Altın servisi hatası:", error);
        return null;
    }
};

// YARDIMCI: BIST 100 Verisi (Yahoo Finance)
let cachedBistData: { price: string; rate: number } | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 15 * 60 * 1000;

export const fetchBistData = async (): Promise<{ price: string; rate: number } | null> => {
    const now = Date.now();
    if (cachedBistData && (now - lastFetchTime) < CACHE_DURATION) {
        return cachedBistData;
    }

    try {
        const url = 'https://query1.finance.yahoo.com/v8/finance/chart/XU100.IS?interval=1d&range=1d';
        const response = await axios.get(url);
        const result = response.data?.chart?.result?.[0];

        if (result && result.meta) {
            const currentPrice = result.meta.regularMarketPrice;
            const previousClose = result.meta.chartPreviousClose;
            let changeRate = 0;
            if (currentPrice && previousClose) {
                changeRate = ((currentPrice - previousClose) / previousClose) * 100;
            }

            cachedBistData = {
                price: currentPrice.toLocaleString('tr-TR', { maximumFractionDigits: 0 }),
                rate: changeRate
            };
            lastFetchTime = now;
            return cachedBistData;
        }
        if (cachedBistData) return cachedBistData;
        return null;
    } catch (error) {
        console.log("BIST verisi alınamadı:", error);
        if (cachedBistData) return cachedBistData;
        return null;
    }
};

export const fetchExchangeRates = async (
    date: Date = new Date(),
    retryCount: number = 0
): Promise<ExchangeRates | null> => {

    const goldData = await fetchFreeGoldPrice();
    const bistData = await fetchBistData();

    if (!TCMB_API_KEY) return null;
    if (retryCount > MAX_RETRIES) return null;

    // Fetch Today AND Yesterday to calculate change
    const endDateStr = formatDate(date);
    const startDateStr = formatDate(getPreviousDate(date)); // Get 2 days range

    // Note: TCMB range endpoint allows fetching multiple days
    const url = `https://evds2.tcmb.gov.tr/service/evds/series=${TCMB_SERIES}&startDate=${startDateStr}&endDate=${endDateStr}&type=json`;

    try {
        const response = await axios.get(url, { headers: { key: TCMB_API_KEY } });
        const items = response.data?.items;

        if (items && items.length > 0) {
            // items array should have 1 or 2 entries depending on weekend/holiday gaps
            // Sort by date just to be safe (although acts usually returns chronological)
            // But we can just find the latest valid entry and the one before it.

            // We need "Today's" value (or latest available) and "Previous" value
            // Since TCMB might skip weekends in range query, we just take the last two items.

            const latestItem = items[items.length - 1];
            const previousItem = items.length > 1 ? items[items.length - 2] : null;

            if (!latestItem || !latestItem['TP_DK_USD_S_YTL']) {
                // Latest date has no data? Try going back one more day via recursion
                return fetchExchangeRates(getPreviousDate(date), retryCount + 1);
            }

            const usdNow = parseFloat(latestItem['TP_DK_USD_S_YTL']);
            const eurNow = parseFloat(latestItem['TP_DK_EUR_S_YTL']);

            let usdRate = 0;
            let eurRate = 0;

            if (previousItem && previousItem['TP_DK_USD_S_YTL']) {
                const usdPrev = parseFloat(previousItem['TP_DK_USD_S_YTL']);
                const eurPrev = parseFloat(previousItem['TP_DK_EUR_S_YTL']);

                usdRate = ((usdNow - usdPrev) / usdPrev) * 100;
                eurRate = ((eurNow - eurPrev) / eurPrev) * 100;
            }

            return {
                USD: { price: usdNow, rate: usdRate },
                EUR: { price: eurNow, rate: eurRate },
                Gold: goldData,
                BIST100: bistData,
                Date: latestItem['Tarih'] || endDateStr,
            };
        } else {
            // No data found in range, try going back
            return fetchExchangeRates(getPreviousDate(date), retryCount + 1);
        }
    } catch (error) {
        return fetchExchangeRates(getPreviousDate(date), retryCount + 1);
    }
};