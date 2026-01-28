import TrendModal, { TrendDataPoint } from '@/components/TrendModal';
import {
    CityItem,
    CityTrendData,
    getActiveCities,
    getCitySalesTrend,
    getHousingInterestChartData,
    getHousingPermitTrends,
    getHousingSalesChartData,
    getRealEstateHeader,
    getRealEstateMacroHistory,
    getRealEstateSupplyStats,
    getSalesBreakdown,
    RealEstateHeaderStats,
    RealEstateSalesBreakdown,
    RealEstateSupplyStats
} from '@/lib/housingService';
import { useAuth } from '@/providers/AuthProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Check, Home, Info, Key, Lightbulb, MapPin, Maximize2, Plus, TrendingDown, TrendingUp, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList, Modal, NativeScrollEvent, NativeSyntheticEvent, RefreshControl, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_WIDTH = SCREEN_WIDTH - 40; // px-5 = 20px padding each side

import { useRouter } from 'expo-router';

export default function RealEstateScreen() {
    const router = useRouter();
    const { isPremium, session } = useAuth();
    const [isGlobalLoading, setGlobalLoading] = useState(true); // Initial load
    const [isSalesLoading, setSalesLoading] = useState(false); // For sales section updates
    const [refreshing, setRefreshing] = useState(false);
    const [headerStats, setHeaderStats] = useState<RealEstateHeaderStats | null>(null);
    const [salesBreakdown, setSalesBreakdown] = useState<RealEstateSalesBreakdown | null>(null);

    // State for Trend Modal (Permits)
    const [trendModalVisible, setTrendModalVisible] = useState(false);
    const [trendModalData, setTrendModalData] = useState<TrendDataPoint[]>([]);

    // State for Sales Trend Modal
    const [salesTrendVisible, setSalesTrendVisible] = useState(false);
    const [salesTrendData, setSalesTrendData] = useState<any[]>([]);
    const [salesCity, setSalesCity] = useState('TR');
    const [salesPeriod, setSalesPeriod] = useState<'monthly' | 'yearly'>('monthly');

    // State for Loan Trend Modal
    const [loanTrendVisible, setLoanTrendVisible] = useState(false);
    const [loanTrendData, setLoanTrendData] = useState<TrendDataPoint[]>([]);

    // City Filter
    const [cityList, setCityList] = useState<CityItem[]>([]);
    const [selectedCity, setSelectedCity] = useState<CityItem>({ city_code: 'TR', city_name: 'TÜRKİYE GENELİ' });
    const [isCityModalVisible, setCityModalVisible] = useState(false);

    // Filters
    const [salesTimeFilter, setSalesTimeFilter] = useState<'MONTH' | 'YEAR'>('MONTH');
    const [salesCategoryFilter, setSalesCategoryFilter] = useState<'PAYMENT' | 'HOUSING'>('PAYMENT');

    // Trend Race & Carousel
    const [activeSlide, setActiveSlide] = useState(0);
    const [trendCities, setTrendCities] = useState<string[]>([]); // City Codes
    const [trendData, setTrendData] = useState<CityTrendData[]>([]);
    const [isTrendLoading, setTrendLoading] = useState(false);
    const [isTrendCityModalVisible, setTrendCityModalVisible] = useState(false);

    // Supply & Future (Arz ve Gelecek)
    const [supplyStats, setSupplyStats] = useState<RealEstateSupplyStats | null>(null);
    const [isSupplyInfoVisible, setSupplyInfoVisible] = useState(false);

    // Macro Cycle State
    const [macroData, setMacroData] = useState<any[]>([]);
    const [macroFilter, setMacroFilter] = useState<24 | 60>(60);
    const [isMacroLoading, setMacroLoading] = useState(false);
    const carouselRef = useRef<ScrollView>(null);

    // Initial Trend Load
    useEffect(() => {
        loadTrendPreferences();
    }, []);

    // Fetch Trend Data when trendCities changes
    useEffect(() => {
        fetchTrendData();
    }, [trendCities]);

    const loadTrendPreferences = async () => {
        try {
            const savedCities = await AsyncStorage.getItem('user_trend_cities');
            if (savedCities) {
                setTrendCities(JSON.parse(savedCities));
            } else {
                setTrendCities([]); // Default to empty -> triggers Top 5
            }
        } catch (error) {
            console.error('Failed to load trend preferences', error);
        }
    };

    const fetchTrendData = async () => {
        try {
            setTrendLoading(true);
            const data = await getCitySalesTrend(trendCities);
            setTrendData(data);
        } catch (error) {
            console.error('Trend Data Fetch Error:', error);
        } finally {
            setTrendLoading(false);
        }
    };

    const toggleTrendCity = async (cityCode: string) => {
        let newCities = [...trendCities];

        // If "Top 5" mode (empty array) was active, we need to first populate it with current top 5 codes
        // But simpler logic: if empty, just start fresh or just add the new one. 
        // User request: "Default Top 5 loaded if empty". 
        // If user actively toggles, we switch to "Manual Mode".

        if (newCities.includes(cityCode)) {
            newCities = newCities.filter(c => c !== cityCode);
        } else {
            if (newCities.length >= 5) {
                // Alert or ignore? limit 5
                return;
            }
            newCities.push(cityCode);
        }

        setTrendCities(newCities);
        await AsyncStorage.setItem('user_trend_cities', JSON.stringify(newCities));
    };

    const resetTrendToTop5 = async () => {
        setTrendCities([]); // Empty triggers Top 5 in backend
        await AsyncStorage.removeItem('user_trend_cities');
    };

    const handleCarouselScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const slideSize = event.nativeEvent.layoutMeasurement.width;
        const index = event.nativeEvent.contentOffset.x / slideSize;
        const roundIndex = Math.round(index);
        if (roundIndex !== activeSlide) {
            setActiveSlide(roundIndex);
        }
    };

    // Initial Data Fetch (Header + Cities)
    useEffect(() => {
        fetchInitialData();
    }, []);

    // Sales Data Fetch (Triggers on City Change)
    useEffect(() => {
        fetchSalesData();
    }, [selectedCity]);

    const fetchInitialData = useCallback(async () => {
        try {
            setGlobalLoading(true);
            // Parallel Fetching
            const [activeCities, headerData, salesData, trendData, supplyData, macroHistory] = await Promise.all([
                getActiveCities(),
                getRealEstateHeader(),
                getSalesBreakdown(),
                getCitySalesTrend([]),
                getRealEstateSupplyStats(),
                getRealEstateMacroHistory(60) // Default 5 years
            ]);

            setCityList(activeCities);
            if (headerData.data) setHeaderStats(headerData.data);
            if (salesData.data) setSalesBreakdown(salesData.data);
            if (trendData) setTrendData(trendData);
            if (supplyData.data) setSupplyStats(supplyData.data);
            if (macroHistory.data) setMacroData(macroHistory.data);
        } catch (error) {
            console.error('Initial Fetch Error:', error);
        } finally {
            setGlobalLoading(false);
            setRefreshing(false);
        }
    }, []);

    const handleMacroFilterChange = async (months: 24 | 60) => {
        if (months === macroFilter) return;
        setMacroFilter(months);
        setMacroLoading(true);
        try {
            const { data } = await getRealEstateMacroHistory(months);
            if (data) setMacroData(data);
        } catch (error) {
            console.error('Macro Filter Error:', error);
        } finally {
            setMacroLoading(false);
        }
    };
    const fetchSalesData = async () => {
        try {
            setSalesLoading(true);
            const salesRes = await getSalesBreakdown(selectedCity.city_code);
            if (salesRes && salesRes.data) {
                setSalesBreakdown(salesRes.data);
            }
        } catch (error) {
            console.error('Sales Data Fetch Error:', error);
        } finally {
            setSalesLoading(false);
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([fetchInitialData(), fetchSalesData()]);
        setRefreshing(false);
    }, [selectedCity]);

    const formatNumber = (num: number) => {
        return num.toLocaleString('tr-TR');
    };

    const getFormattedDate = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        // Format: 'Ocak' (Only month)
        return d.toLocaleString('tr-TR', { month: 'long' });
    };

    const handleOpenTrendAnalysis = async () => {
        try {
            const { data } = await getHousingPermitTrends(24);
            if (data) {
                const mappedData: TrendDataPoint[] = data.map(d => ({
                    label: d.period_label,
                    value: d.permit_count,
                    subValue: d.avg_m2,
                    date: d.year_month,
                    permit_count: d.permit_count,
                    avg_m2: d.avg_m2
                }));
                setTrendModalData(mappedData);
                setTrendModalVisible(true);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const fetchSalesTrend = async (city: string, period: 'monthly' | 'yearly') => {
        try {
            const data = await getHousingSalesChartData(city, period);
            if (data) {
                // Map to TrendDataPoint format expected by TrendModal
                const mappedData: TrendDataPoint[] = data.map(d => ({
                    label: d.display_date, // Generic label
                    value: d.total_sales,
                    date: d.display_date
                    // No permit_count or avg_m2 here
                }));
                setSalesTrendData(mappedData);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleOpenSalesTrend = async () => {
        setSalesCity('TR');
        setSalesPeriod('monthly');
        await fetchSalesTrend('TR', 'monthly');
        setSalesTrendVisible(true);
    };

    const handleOpenLoanTrend = async () => {
        try {
            const data = await getHousingInterestChartData();
            if (data) {
                // Data comes as Oldest First (Ascending) from RPC (e.g. 2014 -> 2025)
                // TrendModal expects Newest First (Descending) input to work with its slice(0,N).reverse() logic.

                // 1. Reverse to make it Newest First (Descending)
                const descData = data.slice().reverse();

                // 2. Map and Localize
                const monthMap: { [key: string]: string } = {
                    'Jan': 'Oca', 'Feb': 'Şub', 'Mar': 'Mar', 'Apr': 'Nis', 'May': 'May', 'Jun': 'Haz',
                    'Jul': 'Tem', 'Aug': 'Ağu', 'Sep': 'Eyl', 'Oct': 'Eki', 'Nov': 'Kas', 'Dec': 'Ara'
                };

                const mappedData: TrendDataPoint[] = descData.map(d => {
                    // d.display_date expected format: "Jan 25" or similar
                    let trDate = d.display_date;
                    const parts = d.display_date.split(' ');
                    if (parts.length === 2) {
                        const enMonth = parts[0];
                        const year = parts[1];
                        if (monthMap[enMonth]) {
                            trDate = `${monthMap[enMonth]} ${year}`;
                        }
                    }

                    return {
                        label: trDate,
                        value: d.rate,
                        date: trDate,
                    };
                });

                // 3. Pass ALL data (Descending) to TrendModal
                // TrendModal will slice appropriate range (1Y, 3Y, All) and reverse back for chart.
                setLoanTrendData(mappedData);
                setLoanTrendVisible(true);
            }
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-[#0B1121]" edges={['left', 'right', 'bottom']}>
            <StatusBar barStyle="light-content" backgroundColor="#0B1121" />

            <ScrollView
                className="flex-1 px-5 pt-4"
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
                }
            >
                {/* --- Header Removed --- */}

                {/* --- Piyasa Ateşi (Header Stats) --- */}
                <View className="mb-8">
                    {/* Sub-header removed */}

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 12, paddingRight: 20 }}
                    >
                        {/* 1. Interest Card (Faiz) */}
                        <View className="bg-slate-800/50 border border-white/5 rounded-2xl p-4 w-40 justify-between h-32">
                            {isGlobalLoading || !headerStats ? (
                                <View>
                                    <View className="h-4 w-20 bg-slate-700 rounded mb-2 animate-pulse" />
                                    <View className="h-8 w-24 bg-slate-700 rounded mb-2 animate-pulse" />
                                </View>
                            ) : (
                                <>
                                    <View className="flex-row justify-between items-start mb-2">
                                        <Text className="text-slate-400 text-xs font-medium uppercase tracking-wider">Konut Kredisi</Text>
                                        <TouchableOpacity onPress={handleOpenLoanTrend} className="bg-slate-700/50 p-1.5 rounded-lg -mr-1 -mt-1 active:bg-slate-600">
                                            <Maximize2 size={12} color="#94a3b8" />
                                        </TouchableOpacity>
                                    </View>
                                    <View>
                                        <Text className="text-slate-500 text-[10px] mb-0.5 font-medium uppercase">{getFormattedDate(headerStats.interest_card.reference_date)}</Text>
                                        <Text className="text-white text-2xl font-bold mb-1">%{headerStats.interest_card.value}</Text>

                                        {/* Logic: UP -> RED (Bad) */}
                                        <View className={`flex-row items-center gap-1 self-start px-1.5 py-0.5 rounded ${headerStats.interest_card.direction === 'up' ? 'bg-red-500/20' : 'bg-green-500/20'} `}>
                                            {headerStats.interest_card.direction === 'up' ?
                                                <TrendingUp size={10} color="#ef4444" /> :
                                                <TrendingDown size={10} color="#22c55e" />
                                            }
                                            <Text className={`${headerStats.interest_card.direction === 'up' ? 'text-red-400' : 'text-green-400'} text-[10px] font-bold`}>
                                                {headerStats.interest_card.change} puan
                                            </Text>
                                        </View>
                                    </View>
                                </>
                            )}
                        </View>

                        {/* 2. Sales Card */}
                        <View className="bg-slate-800/50 border border-white/5 rounded-2xl p-4 w-40 justify-between h-32">
                            {isGlobalLoading || !headerStats ? (
                                <View>
                                    <View className="h-4 w-20 bg-slate-700 rounded mb-2 animate-pulse" />
                                    <View className="h-8 w-28 bg-slate-700 rounded mb-2 animate-pulse" />
                                </View>
                            ) : (
                                <>
                                    <View className="flex-row justify-between items-start mb-2">
                                        <Text className="text-slate-400 text-xs font-medium uppercase tracking-wider">Toplam Satış</Text>
                                        <TouchableOpacity onPress={handleOpenSalesTrend} className="bg-slate-700/50 p-1.5 rounded-lg -mr-1 -mt-1 active:bg-slate-600">
                                            <Maximize2 size={12} color="#94a3b8" />
                                        </TouchableOpacity>
                                    </View>
                                    <View>
                                        <Text className="text-slate-500 text-[10px] mb-0.5 font-medium uppercase">{getFormattedDate(headerStats.sales_card.reference_date)}</Text>
                                        <Text className="text-white text-xl font-bold mb-1">{formatNumber(headerStats.sales_card.value)}</Text>

                                        {/* Logic: UP -> GREEN (Good) */}
                                        <View className={`flex-row items-center gap-1 self-start px-1.5 py-0.5 rounded ${headerStats.sales_card.direction === 'up' ? 'bg-green-500/20' : 'bg-red-500/20'} `}>
                                            {headerStats.sales_card.direction === 'up' ?
                                                <TrendingUp size={10} color="#22c55e" /> :
                                                <TrendingDown size={10} color="#ef4444" />
                                            }
                                            <Text className={`${headerStats.sales_card.direction === 'up' ? 'text-green-400' : 'text-red-400'} text-[10px] font-bold`}>
                                                %{headerStats.sales_card.percent_change}
                                            </Text>
                                        </View>
                                    </View>
                                </>
                            )}
                        </View>

                        {/* 3. Cost Card (Maliyet) */}
                        <View className="bg-slate-800/50 border border-white/5 rounded-2xl p-4 w-40 justify-between h-32">
                            {isGlobalLoading || !headerStats ? (
                                <View>
                                    <View className="h-4 w-20 bg-slate-700 rounded mb-2 animate-pulse" />
                                    <View className="h-8 w-24 bg-slate-700 rounded mb-2 animate-pulse" />
                                </View>
                            ) : (
                                <>
                                    <View className="flex-row justify-between items-start mb-2">
                                        <Text className="text-slate-400 text-xs font-medium uppercase tracking-wider">Maliyet End.</Text>
                                        {/* Placeholder for Expand Icon if needed later */}
                                    </View>
                                    <View>
                                        <Text className="text-slate-500 text-[10px] mb-0.5 font-medium uppercase">{getFormattedDate(headerStats.cost_card.reference_date)}</Text>
                                        <Text className="text-white text-2xl font-bold mb-1">{headerStats.cost_card.value}</Text>

                                        {/* Logic: UP -> RED (Bad) */}
                                        <View className={`flex-row items-center gap-1 self-start px-1.5 py-0.5 rounded ${headerStats.cost_card.direction === 'up' ? 'bg-red-500/20' : 'bg-green-500/20'} `}>
                                            {headerStats.cost_card.direction === 'up' ?
                                                <TrendingUp size={10} color="#ef4444" /> :
                                                <TrendingDown size={10} color="#22c55e" />
                                            }
                                            <Text className={`${headerStats.cost_card.direction === 'up' ? 'text-red-400' : 'text-green-400'} text-[10px] font-bold`}>
                                                %{headerStats.cost_card.percent_change}
                                            </Text>
                                        </View>
                                    </View>
                                </>
                            )}
                        </View>
                    </ScrollView>
                </View>

                {/* --- Satışın Dağılımı section --- */}
                {/* --- Carousel Section --- */}
                <View className="mb-6">
                    <ScrollView
                        ref={carouselRef}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onScroll={handleCarouselScroll}
                        scrollEventThrottle={16}
                        contentContainerStyle={{ alignItems: 'flex-start' }}
                    >
                        {/* SLIDE 1: Satışın Kimyası (Original) */}
                        <View style={{ width: CAROUSEL_WIDTH }} className="bg-slate-800/20 rounded-3xl p-5 border border-white/5 h-[325px]">
                            {/* Header + Controls */}
                            <View className="flex-col gap-3 mb-6">
                                <View className="flex-row items-center gap-2">
                                    <Text className="text-white text-lg font-bold">Satış Adetleri</Text>
                                    <TouchableOpacity
                                        onPress={() => setCityModalVisible(true)}
                                        className="bg-slate-800 px-2 py-1 rounded-md flex-row items-center gap-1 border border-slate-700"
                                    >
                                        <MapPin size={10} color="#94a3b8" />
                                        <Text className="text-slate-300 text-[10px] font-bold uppercase">{selectedCity.city_name}</Text>
                                    </TouchableOpacity>
                                </View>

                                <View className="flex-row items-center gap-2 flex-wrap mt-6">
                                    {/* Category Toggle */}
                                    <View className="flex-row bg-slate-800 rounded-lg p-0.5">
                                        <TouchableOpacity
                                            onPress={() => setSalesCategoryFilter('PAYMENT')}
                                            className={`px-3 py-1 rounded-md ${salesCategoryFilter === 'PAYMENT' ? 'bg-blue-600' : 'bg-transparent'} `}
                                        >
                                            <Text className={`text-xs font-bold ${salesCategoryFilter === 'PAYMENT' ? 'text-white' : 'text-slate-400'} `}>Ödeme Tipi</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => setSalesCategoryFilter('HOUSING')}
                                            className={`px-3 py-1 rounded-md ${salesCategoryFilter === 'HOUSING' ? 'bg-blue-600' : 'bg-transparent'} `}
                                        >
                                            <Text className={`text-xs font-bold ${salesCategoryFilter === 'HOUSING' ? 'text-white' : 'text-slate-400'} `}>Konut Tipi</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Time Toggle */}
                                    <View className="flex-row bg-slate-800 rounded-lg p-0.5">
                                        <TouchableOpacity
                                            onPress={() => setSalesTimeFilter('MONTH')}
                                            className={`px-3 py-1 rounded-md ${salesTimeFilter === 'MONTH' ? 'bg-blue-600' : 'bg-transparent'} `}
                                        >
                                            <Text className={`text-xs font-bold ${salesTimeFilter === 'MONTH' ? 'text-white' : 'text-slate-400'} `}>Ay</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => setSalesTimeFilter('YEAR')}
                                            className={`px-3 py-1 rounded-md ${salesTimeFilter === 'YEAR' ? 'bg-blue-600' : 'bg-transparent'} `}
                                        >
                                            <Text className={`text-xs font-bold ${salesTimeFilter === 'YEAR' ? 'text-white' : 'text-slate-400'} `}>Yıl</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>

                            {isSalesLoading ? (
                                <View className="h-40 items-center justify-center">
                                    <Text className="text-slate-600">Veriler yükleniyor...</Text>
                                </View>
                            ) : !salesBreakdown ? (
                                <View className="h-40 items-center justify-center">
                                    <Text className="text-slate-500">Veri bulunamadı.</Text>
                                </View>
                            ) : (
                                <View className="flex-col gap-6 mt-4">
                                    {/* Logic to get current items */}
                                    {(() => {
                                        const currentData = salesTimeFilter === 'MONTH' ? salesBreakdown.monthly : salesBreakdown.yearly;
                                        const items = salesCategoryFilter === 'PAYMENT' ? currentData.payment_type : currentData.housing_type;

                                        // Colors based on category
                                        const getColors = () => {
                                            if (salesCategoryFilter === 'PAYMENT') return ['#8b5cf6', '#22c55e']; // Purple, Green
                                            return ['#06b6d4', '#f97316']; // Cyan, Orange
                                        };
                                        const colors = getColors();

                                        const pieData = items.map((item, idx) => ({
                                            value: item.share,
                                            color: colors[idx % colors.length],
                                            text: ''
                                        }));

                                        return (
                                            <View className="flex-row items-center">
                                                {/* Chart */}
                                                <View className="items-center justify-center">
                                                    <PieChart
                                                        data={pieData}
                                                        donut
                                                        radius={70}
                                                        innerRadius={50}
                                                        innerCircleColor="#151C2F"
                                                        centerLabelComponent={() => (
                                                            <View className="items-center justify-center w-24">
                                                                <Text className="text-slate-500 text-[10px] font-bold uppercase text-center">VERİ DÖNEMİ</Text>
                                                                <Text className="text-white text-base font-extrabold text-center" numberOfLines={1}>
                                                                    {(() => {
                                                                        const label = currentData.label || '';
                                                                        if (salesTimeFilter === 'YEAR') {
                                                                            const match = label.match(/\d{4}/);
                                                                            return match ? match[0] : label;
                                                                        }
                                                                        const parts = label.split(' ');
                                                                        const firstWord = parts[0] || '';
                                                                        const monthMap: Record<string, string> = {
                                                                            'January': 'OCAK', 'February': 'ŞUBAT', 'March': 'MART', 'April': 'NİSAN', 'May': 'MAYIS', 'June': 'HAZİRAN',
                                                                            'July': 'TEMMUZ', 'August': 'AĞUSTOS', 'September': 'EYLÜL', 'October': 'EKİM', 'November': 'KASIM', 'December': 'ARALIK',
                                                                            'Ocak': 'OCAK', 'Şubat': 'ŞUBAT', 'Mart': 'MART', 'Nisan': 'NİSAN', 'Mayıs': 'MAYIS', 'Haziran': 'HAZİRAN',
                                                                            'Temmuz': 'TEMMUZ', 'Ağustos': 'AĞUSTOS', 'Eylül': 'EYLÜL', 'Ekim': 'EKİM', 'Kasım': 'KASIM', 'Aralık': 'ARALIK',
                                                                            'ocak': 'OCAK', 'şubat': 'ŞUBAT', 'mart': 'MART', 'nisan': 'NİSAN', 'mayıs': 'MAYIS', 'haziran': 'HAZİRAN',
                                                                            'temmuz': 'TEMMUZ', 'ağustos': 'AĞUSTOS', 'eylül': 'EYLÜL', 'ekim': 'EKİM', 'kasım': 'KASIM', 'aralık': 'ARALIK'
                                                                        };
                                                                        return monthMap[firstWord] || firstWord.toUpperCase();
                                                                    })()}
                                                                </Text>
                                                            </View>
                                                        )}
                                                    />
                                                </View>

                                                {/* Legend List */}
                                                <View className="flex-1 ml-4 gap-3">
                                                    {items.map((item, idx) => (
                                                        <View key={item.name}>
                                                            <View className="flex-row justify-between mb-1">
                                                                <View className="flex-row items-center gap-2">
                                                                    <View className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[idx % colors.length] }} />
                                                                    <Text className="text-white text-xs font-bold">{item.name}</Text>
                                                                </View>
                                                                <Text className="text-white text-xs font-bold">{formatNumber(item.value)}</Text>
                                                            </View>
                                                            <View className="flex-row items-center gap-2">
                                                                <View className="flex-1 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                                                                    <View style={{ width: `${item.share}%`, backgroundColor: colors[idx % colors.length] }} className="h-full rounded-full" />
                                                                </View>
                                                                <Text className="text-slate-400 text-[10px] w-11 text-right" numberOfLines={1}>%{item.share}</Text>
                                                            </View>
                                                            {salesTimeFilter === 'MONTH' && (
                                                                <View className={`self-end mt-1 flex-row items-center gap-1 px-1.5 py-0.5 rounded ${item.direction === 'up' ? 'bg-green-500/10' : 'bg-red-500/10'} `}>
                                                                    {item.direction === 'up' ?
                                                                        <TrendingUp size={8} color="#22c55e" /> :
                                                                        <TrendingDown size={8} color="#ef4444" />
                                                                    }
                                                                    <Text className={`text-[9px] font-bold ${item.direction === 'up' ? 'text-green-500' : 'text-red-500'} `}>
                                                                        %{Math.abs(item.change_rate)}
                                                                    </Text>
                                                                </View>
                                                            )}
                                                        </View>
                                                    ))}
                                                </View>
                                            </View>
                                        );
                                    })()}
                                </View>
                            )}
                        </View>

                        {/* SLIDE 2: Trend Yarışı (New) */}
                        <View style={{ width: CAROUSEL_WIDTH }} className="bg-slate-800/20 rounded-3xl p-5 border border-white/5 h-[325px]">
                            {/* Header */}
                            <View className="flex-row justify-between items-center mb-6">
                                <View className="flex-row items-center gap-2">
                                    <Text className="text-white text-lg font-bold">Trend Yarışı</Text>
                                    <TouchableOpacity
                                        onPress={() => setTrendCityModalVisible(true)}
                                        className="bg-slate-800 px-2 py-1 rounded-md flex-row items-center gap-1 border border-slate-700"
                                    >
                                        <Plus size={10} color="#94a3b8" />
                                        <Text className="text-slate-300 text-[10px] font-bold uppercase">
                                            {trendCities.length > 0 ? `${trendCities.length} Şehir` : 'TOP 5'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Content */}
                            {isTrendLoading ? (
                                <View className="h-64 items-center justify-center">
                                    <Text className="text-slate-600">Trend verileri yükleniyor...</Text>
                                </View>
                            ) : trendData.length === 0 ? (
                                <View className="h-64 items-center justify-center">
                                    <Text className="text-slate-500">Veri bulunamadı.</Text>
                                </View>
                            ) : (
                                <View className="justify-center">
                                    {(() => {
                                        // Process Data for Gifted Charts
                                        // Colors: Blue, Red, Green, Purple, Orange
                                        const CHART_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#a855f7', '#f97316'];

                                        // We need to pass multiple datasets.
                                        // Gifted Charts LineChart supports data, data2, data3, data4, data5 props.
                                        // We will map our trendData to these props.

                                        const datasets = trendData.slice(0, 5).map((city, idx) => ({
                                            data: city.data.map((d, i) => ({
                                                value: d.value,
                                                label: d.date_label.split('-')[1],
                                                dataPointText: '',
                                                customData: {
                                                    cityName: city.city_name,
                                                    color: CHART_COLORS[idx % CHART_COLORS.length],
                                                    index: i // Inject index for tooltip positioning logic
                                                }
                                            })),
                                            color: CHART_COLORS[idx % CHART_COLORS.length],
                                            name: city.city_name
                                        }));

                                        const totalDataPoints = datasets[0]?.data.length || 0;

                                        // Calculate global maximum value for correct scaling
                                        // Flatten all data points from all visible datasets and find max
                                        const allValues = datasets.flatMap(d => d.data.map(p => p.value));
                                        const maxDataValue = Math.max(...allValues, 0);
                                        // Add 10% buffer and round to nice number
                                        const yAxisMax = Math.ceil(maxDataValue * 1.1);

                                        return (
                                            <LineChart
                                                maxValue={yAxisMax} // Explicitly set max value to prevent cutting off data
                                                data={datasets[0]?.data || []}
                                                data2={datasets[1]?.data}
                                                data3={datasets[2]?.data}
                                                data4={datasets[3]?.data}
                                                data5={datasets[4]?.data}
                                                color={datasets[0]?.color}
                                                color2={datasets[1]?.color}
                                                color3={datasets[2]?.color}
                                                color4={datasets[3]?.color}
                                                color5={datasets[4]?.color}
                                                thickness={2}
                                                height={200}
                                                width={CAROUSEL_WIDTH - 40} // Full width minus padding


                                                initialSpacing={10}
                                                spacing={30}
                                                hideRules
                                                yAxisColor="transparent"
                                                xAxisColor="transparent"
                                                yAxisTextStyle={{ color: '#64748b', fontSize: 10 }}
                                                xAxisLabelTextStyle={{ color: '#64748b', fontSize: 10 }}
                                                hideDataPoints={false}
                                                dataPointsColor={datasets[0]?.color}
                                                dataPointsColor2={datasets[1]?.color}
                                                dataPointsColor3={datasets[2]?.color}
                                                dataPointsColor4={datasets[3]?.color}
                                                dataPointsColor5={datasets[4]?.color}
                                                curved
                                                pointerConfig={{
                                                    pointerStripHeight: 160,
                                                    pointerStripColor: 'rgba(255, 255, 255, 0.2)',
                                                    pointerStripWidth: 2,
                                                    strokeDashArray: [2, 5],
                                                    pointerLabelWidth: 120,
                                                    pointerLabelHeight: 120,
                                                    activatePointersOnLongPress: true, // Better for Carousel scroll interference
                                                    autoAdjustPointerLabelPosition: false,
                                                    pointerLabelComponent: (items: any[]) => {
                                                        // items contains the data points for all lines at that index

                                                        // Determine position based on index to prevent overflow on right side
                                                        const pointIndex = items[0]?.customData?.index ?? 0;
                                                        const isNearRightEdge = pointIndex >= (totalDataPoints - 4);

                                                        // Shift left if near right edge: -140px (approx w-32 plus spacing)
                                                        // Normal: ml-4 (16px)
                                                        const marginLeft = isNearRightEdge ? -140 : 16;

                                                        return (
                                                            <View style={{ marginLeft }} className="bg-slate-900/95 border border-white/10 p-3 rounded-xl shadow-lg w-32">
                                                                {/* Date Header (from first item) */}
                                                                <Text className="text-slate-400 text-[10px] font-bold mb-2 text-center border-b border-white/5 pb-1">
                                                                    {items[0]?.label ? `${items[0].label}.AY` : 'Tarih'}
                                                                </Text>

                                                                {/* Iterate over items to show city values */}
                                                                {items.map((item, index) => {
                                                                    // Sometimes items might be empty or null if line ends earlier, but here usually equal length
                                                                    if (!item.value && item.value !== 0) return null;

                                                                    // We retrieve color/name from customData we injected (preferred) 
                                                                    // or fallback to datasets by index (risky if not ordered)
                                                                    // Note: gifted-charts passes the actual data object from 'data' prop array

                                                                    // We retrieve color/name from datasets array directly using index
                                                                    // because item.customData seems unreliable for multi-line (shows 1st city for all)
                                                                    const dataset = datasets[index];
                                                                    const color = dataset?.color || '#fff';
                                                                    const city = dataset?.name || '';

                                                                    return (
                                                                        <View key={index} className="flex-row justify-between items-center mb-1">
                                                                            <View className="flex-row items-center gap-1.5 overflow-hidden max-w-[60%]">
                                                                                <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                                                                                <Text className="text-white text-[9px] font-medium" numberOfLines={1}>{city}</Text>
                                                                            </View>
                                                                            <Text className="text-white text-[9px] font-bold">{formatNumber(item.value)}</Text>
                                                                        </View>
                                                                    );
                                                                })}
                                                            </View>
                                                        );
                                                    }
                                                }}
                                            />
                                        );
                                    })()}

                                    {/* Inline Legend */}
                                    <View className="flex-row flex-wrap gap-3 mt-4 mb-2 justify-center">
                                        {trendData.slice(0, 5).map((city, idx) => {
                                            const CHART_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#a855f7', '#f97316'];
                                            return (
                                                <View key={city.city_code} className="flex-row items-center gap-1.5">
                                                    <View className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                                                    <Text className="text-white text-[10px] font-bold">{city.city_name}</Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                </View>
                            )}
                        </View>
                    </ScrollView>

                    {/* Dots */}
                    <View className="flex-row justify-center items-center gap-2 mt-4">
                        {[0, 1].map(idx => (
                            <View
                                key={idx}
                                className={`h-2 rounded-full transition-all ${activeSlide === idx ? 'w-6 bg-blue-500' : 'w-2 bg-slate-700'} `}
                            />
                        ))}
                    </View>
                </View>



                {/* --- Arz ve Gelecek Section (Header Removed) --- */}
                <View className="mb-10">
                    <View className="flex-col gap-4">
                        {/* 1. İlan Havuzu (Satılık/Kiralık) */}
                        <View className="bg-slate-800/50 border border-white/5 rounded-2xl p-4">
                            {isGlobalLoading || !supplyStats ? (
                                <View>
                                    <View className="h-4 w-32 bg-slate-700 rounded mb-4 animate-pulse" />
                                    <View className="h-12 w-full bg-slate-700 rounded mb-2 animate-pulse" />
                                    <View className="h-12 w-full bg-slate-700 rounded animate-pulse" />
                                </View>
                            ) : (
                                <>
                                    <View className="flex-row justify-between items-center mb-4">
                                        <Text className="text-white font-bold text-base mb-0">İlan Havuzu</Text>

                                        <Text className="text-slate-500 text-[10px]">
                                            {(() => {
                                                if (!supplyStats.listings.reference_date) return '';
                                                const d = new Date(supplyStats.listings.reference_date);
                                                return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
                                            })()}
                                        </Text>
                                    </View>

                                    <View className="flex-row gap-2">
                                        {/* Satılık */}
                                        <View className="flex-1 flex-row items-center gap-3 bg-slate-900/30 p-2 rounded-xl border border-white/5">
                                            <View className="bg-orange-500/20 p-2 rounded-lg">
                                                <Home size={18} color="#f97316" />
                                            </View>
                                            <View>
                                                <Text className="text-white text-lg font-bold">{formatNumber(supplyStats.listings.for_sale)}</Text>
                                                <Text className="text-slate-400 text-[10px] font-medium">Satılık Konut</Text>
                                            </View>
                                        </View>

                                        {/* Kiralık */}
                                        <View className="flex-1 flex-row items-center gap-3 bg-slate-900/30 p-2 rounded-xl border border-white/5">
                                            <View className="bg-blue-500/20 p-2 rounded-lg">
                                                <Key size={18} color="#3b82f6" />
                                            </View>
                                            <View>
                                                <Text className="text-white text-lg font-bold">{formatNumber(supplyStats.listings.for_rent)}</Text>
                                                <Text className="text-slate-400 text-[10px] font-medium">Kiralık Konut</Text>
                                            </View>
                                        </View>
                                    </View>
                                </>
                            )}
                        </View>

                        {/* 2. Gelecek Arzı (İnşaat İzinleri) */}
                        <View className="bg-slate-800/50 border border-white/5 rounded-2xl p-4">
                            {isGlobalLoading || !supplyStats ? (
                                <View>
                                    <View className="h-4 w-32 bg-slate-700 rounded mb-4 animate-pulse" />
                                    <View className="h-16 w-full bg-slate-700 rounded mb-2 animate-pulse" />
                                </View>
                            ) : (
                                <>
                                    <View className="flex-row justify-between items-start mb-2">
                                        <View className="flex-row items-center gap-2">
                                            <Text className="text-white font-bold text-base">Yeni Konut İzni</Text>
                                            <TouchableOpacity
                                                onPress={handleOpenTrendAnalysis}
                                                className="bg-blue-600/20 p-1.5 rounded-md"
                                            >
                                                <Maximize2 size={12} color="#60a5fa" />
                                            </TouchableOpacity>
                                        </View>
                                        <Text className="text-slate-500 text-[10px]">
                                            {(() => {
                                                if (!supplyStats.permits.reference_date) return '';
                                                const d = new Date(supplyStats.permits.reference_date);
                                                // Eyl '25 format
                                                const month = d.toLocaleString('tr-TR', { month: 'short' });
                                                const year = d.getFullYear().toString().slice(2);
                                                return `${month} '${year}`;
                                            })()}
                                        </Text>
                                    </View>

                                    <View className="mt-4 flex-row justify-between items-start">
                                        <View>
                                            <Text className="text-white text-4xl font-extrabold tracking-tight">
                                                {formatNumber(supplyStats.permits.total_units)}
                                            </Text>

                                            {/* Trend */}
                                            <View className={`flex-row items-center gap-1 self-start px-2 py-1 rounded-md ${supplyStats.permits.direction === 'up' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                                                {supplyStats.permits.direction === 'up' ?
                                                    <TrendingUp size={14} color="#22c55e" /> :
                                                    <TrendingDown size={14} color="#ef4444" />
                                                }
                                                <Text className={`${supplyStats.permits.direction === 'up' ? 'text-green-400' : 'text-red-400'} text-xs font-bold`}>
                                                    %{Math.abs(supplyStats.permits.percent_change)}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Badge - Aligned with top of the number */}
                                        <View className="bg-slate-700/50 px-2 py-1 rounded-md flex-row items-center gap-1 border border-white/5 mt-2">
                                            <Info size={10} color="#94a3b8" />
                                            <Text className="text-slate-300 text-[10px] font-bold">Ort. {supplyStats.permits.avg_sqm} m²</Text>
                                        </View>
                                    </View>
                                </>
                            )}
                        </View>
                    </View>
                </View>

                {/* --- Büyük Resim (Macro Cycle) Section --- */}
                <View className="mb-24" >
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-white text-lg font-bold">Büyük Resim</Text>
                        <View className="flex-row bg-slate-800 rounded-lg p-1 border border-white/10">
                            <TouchableOpacity
                                onPress={() => handleMacroFilterChange(24)}
                                className={`px-3 py-1 rounded-md ${macroFilter === 24 ? 'bg-slate-700' : ''}`}
                            >
                                <Text className={`text-xs font-bold ${macroFilter === 24 ? 'text-white' : 'text-slate-400'}`}>2 YIL</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => handleMacroFilterChange(60)}
                                className={`px-3 py-1 rounded-md ${macroFilter === 60 ? 'bg-slate-700' : ''}`}
                            >
                                <Text className={`text-xs font-bold ${macroFilter === 60 ? 'text-white' : 'text-slate-400'}`}>5 YIL</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View className="bg-slate-800/50 border border-white/5 rounded-2xl p-4 overflow-hidden">
                        {isMacroLoading || isGlobalLoading || macroData.length === 0 ? (
                            <View className="h-[250px] justify-center items-center">
                                <Text className="text-slate-500">Veriler Yükleniyor...</Text>
                            </View>
                        ) : (
                            <View style={{ marginLeft: -10 }}>
                                <BarChart
                                    data={macroData.map((d, index) => {
                                        // Use date_label based on verifiable JSON
                                        const rawDate = d.date_label || d.year_month;

                                        // Safety Check
                                        if (!rawDate) {
                                            return {
                                                value: d.total_sales || 0,
                                                label: d.period_label || '',
                                                frontColor: '#4F46E5',
                                                secondaryValue: d.interest_rate || 0,
                                                tooltipDate: '',
                                                index: index
                                            };
                                        }

                                        // Date Formatting: 2024-12 -> Aralık '24
                                        const [year, month] = rawDate.split('-');
                                        const date = new Date(parseInt(year), parseInt(month) - 1);
                                        // Short label for X-Axis (e.g. 'Ara')
                                        const shortMonth = date.toLocaleDateString('tr-TR', { month: 'short' });
                                        // Long label for Tooltip (e.g. Aralık '24)
                                        const formattedDate = date.toLocaleDateString('tr-TR', { month: 'long' }) + " '" + year.slice(2);

                                        return {
                                            value: d.total_sales,
                                            label: '', // Hide from X-axis as requested
                                            frontColor: '#4F46E5',
                                            secondaryValue: d.interest_rate,
                                            tooltipDate: formattedDate,
                                            index: index
                                        };
                                    })}
                                    barWidth={macroFilter === 60 ? 4 : 8}
                                    spacing={macroFilter === 60 ? 4 : 12}
                                    roundedTop
                                    roundedBottom={false}
                                    hideRules
                                    xAxisThickness={0}
                                    yAxisThickness={0}
                                    yAxisTextStyle={{ color: '#94a3b8', fontSize: 10 }}
                                    noOfSections={4}

                                    // Combo Chart Setup
                                    showLine
                                    lineData={macroData.map(d => ({
                                        value: d.interest_rate,
                                    }))}
                                    lineConfig={{
                                        isSecondary: true,
                                        color: '#F97316',
                                        thickness: 3,
                                        curved: true,
                                        hideDataPoints: true,
                                        shiftY: 0,
                                        initialSpacing: 0,
                                    }}

                                    // Secondary Axis Configuration
                                    secondaryYAxis={{
                                        maxValue: 60,
                                        stepValue: 12,
                                        noOfSections: 5,
                                        yAxisTextStyle: { color: '#F97316', fontSize: 10 }
                                    }}

                                    // Pointer Interaction (Tooltip)
                                    pointerConfig={{
                                        pointerStripUptoDataPoint: true,
                                        pointerStripColor: 'lightgray',
                                        pointerStripWidth: 2,
                                        strokeDashArray: [2, 5],
                                        pointerColor: 'lightgray',
                                        radius: 4,
                                        pointerLabelWidth: 100,
                                        pointerLabelHeight: 120,
                                        activatePointersOnLongPress: false,
                                        autoAdjustPointerLabelPosition: false,
                                        pointerLabelComponent: (items: any) => {
                                            const item = items[0];
                                            const totalItems = macroData.length;
                                            // Shift left for the last 11 items to prevent overflow
                                            const isRightSide = item.index >= totalItems - 11;

                                            return (
                                                <View style={{
                                                    height: 100,
                                                    width: 100,
                                                    backgroundColor: '#282C34',
                                                    borderRadius: 4,
                                                    padding: 8,
                                                    // Dynamic positioning shift
                                                    transform: [{ translateX: isRightSide ? -100 : 0 }]
                                                }}>
                                                    <Text style={{ color: 'white', fontSize: 12, marginBottom: 4 }}>{item.tooltipDate}</Text>

                                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                                        <View style={{ width: 8, height: 8, backgroundColor: '#4F46E5', borderRadius: 4, marginRight: 4 }} />
                                                        <Text style={{ color: 'lightgray', fontSize: 10 }}>Satış: {formatNumber(item.value)}</Text>
                                                    </View>

                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                        <View style={{ width: 8, height: 8, backgroundColor: '#F97316', borderRadius: 4, marginRight: 4 }} />
                                                        <Text style={{ color: 'lightgray', fontSize: 10 }}>Faiz: %{item.secondaryValue}</Text>
                                                    </View>
                                                </View>
                                            );
                                        },
                                    }}
                                />
                            </View>
                        )}
                    </View>

                    {/* Analyst Note */}
                    <View className="flex-row gap-3 bg-slate-50 p-4 rounded-xl mt-4 items-start">
                        <View className="bg-yellow-100 p-2 rounded-full">
                            <Lightbulb size={20} color="#eab308" strokeWidth={2.5} />
                        </View>
                        <View className="flex-1">
                            <Text className="text-slate-800 text-sm font-semibold mb-1">Piyasa Kuralı</Text>
                            <Text className="text-slate-600 text-xs leading-5">
                                Kredi faizleri (Turuncu) yükseldiğinde, konut satışları (Mavi) genellikle baskılanır. Yatırım fırsatları genellikle makasın en açık olduğu dönemlerde oluşur.
                            </Text>
                        </View>
                    </View>
                </View>

                <Modal
                    visible={isTrendCityModalVisible}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setTrendCityModalVisible(false)}
                >
                    <View className="flex-1 bg-black/80 justify-center items-center px-5">
                        <View className="bg-[#1e293b] w-full max-h-[80%] rounded-2xl border border-white/10 overflow-hidden">
                            {/* Header */}
                            <View className="flex-row justify-between items-center p-4 border-b border-white/5 bg-slate-800">
                                <View>
                                    <Text className="text-white text-lg font-bold">Trend Şehirleri</Text>
                                    <Text className="text-slate-400 text-xs">En fazla 5 şehir seçebilirsiniz</Text>
                                </View>
                                <TouchableOpacity onPress={() => setTrendCityModalVisible(false)} className="bg-slate-700 p-1.5 rounded-full">
                                    <X size={20} color="#cbd5e1" />
                                </TouchableOpacity>
                            </View>

                            {/* Reset Button */}
                            <TouchableOpacity
                                onPress={() => {
                                    resetTrendToTop5();
                                    setTrendCityModalVisible(false);
                                }}
                                className="mx-4 mt-4 p-3 bg-blue-600/10 border border-blue-500/20 rounded-xl flex-row justify-center items-center gap-2"
                            >
                                <Text className="text-blue-400 font-bold text-sm">Fabrika Ayarlarına Dön (Top 5)</Text>
                            </TouchableOpacity>

                            {/* List */}
                            <FlatList
                                data={cityList}
                                keyExtractor={(item) => item.city_code}
                                contentContainerStyle={{ padding: 16 }}
                                renderItem={({ item }) => {
                                    const isSelected = trendCities.includes(item.city_code);
                                    return (
                                        <TouchableOpacity
                                            onPress={() => toggleTrendCity(item.city_code)}
                                            disabled={!isSelected && trendCities.length >= 5}
                                            className={`flex-row items-center justify-between p-4 rounded-xl mb-3 border ${isSelected ? 'bg-blue-600 border-blue-500' : 'bg-slate-800 border-white/5'} ${(!isSelected && trendCities.length >= 5) ? 'opacity-50' : ''}`}
                                        >
                                            <View className="flex-row items-center gap-3">
                                                <Text className={`text-base font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                                                    {item.city_name}
                                                </Text>
                                            </View>

                                            {isSelected && (
                                                <View className="bg-white/20 p-1 rounded-full">
                                                    <Check size={12} color="white" />
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                }}
                            />
                        </View>
                    </View>
                </Modal>

            </ScrollView>


            {/* City Selection Modal */}
            <Modal
                visible={isCityModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setCityModalVisible(false)}
            >
                <View className="flex-1 bg-black/80 justify-center items-center px-5">
                    <View className="bg-[#1e293b] w-full max-h-[80%] rounded-2xl border border-white/10 overflow-hidden">
                        {/* Header */}
                        <View className="flex-row justify-between items-center p-4 border-b border-white/5 bg-slate-800">
                            <Text className="text-white text-lg font-bold">Şehir Seçin</Text>
                            <TouchableOpacity onPress={() => setCityModalVisible(false)} className="bg-slate-700 p-1.5 rounded-full">
                                <X size={20} color="#cbd5e1" />
                            </TouchableOpacity>
                        </View>

                        {/* List */}
                        <FlatList
                            data={cityList}
                            keyExtractor={(item) => item.city_code}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    onPress={() => {
                                        setSelectedCity(item);
                                        setCityModalVisible(false);
                                    }}
                                    className={`flex-row items-center justify-between p-4 border-b border-white/5 ${selectedCity.city_code === item.city_code ? 'bg-blue-600/10' : ''}`}
                                >
                                    <Text className={`text-base font-medium ${selectedCity.city_code === item.city_code ? 'text-blue-400' : 'text-slate-300'}`}>
                                        {item.city_name}
                                    </Text>
                                    {selectedCity.city_code === item.city_code && (
                                        <Check size={18} color="#60a5fa" />
                                    )}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>

            {/* Supply Info Modal */}
            <Modal
                visible={isSupplyInfoVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setSupplyInfoVisible(false)}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setSupplyInfoVisible(false)}
                    className="flex-1 bg-black/60 justify-center items-center px-8"
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        className="bg-[#1e293b] w-full p-5 rounded-2xl border border-white/10 shadow-xl"
                    >
                        <View className="flex-row items-center gap-2 mb-3">
                            <Info size={18} color="#60a5fa" />
                            <Text className="text-white font-bold text-base">Veri Metodolojisi</Text>
                        </View>
                        <Text className="text-slate-300 text-sm leading-relaxed">
                            Piyasa trendlerini doğru yansıtmak amacıyla, mükerrer kayıtları önlemek için sadece en yüksek hacimli pazar yeri verileri baz alınmıştır.
                        </Text>

                        <TouchableOpacity
                            onPress={() => setSupplyInfoVisible(false)}
                            className="mt-4 self-end bg-slate-700/50 px-4 py-2 rounded-lg"
                        >
                            <Text className="text-white text-xs font-bold">Tamam</Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
            {/* Trend Analysis Modal (Permits) */}
            {
                trendModalVisible && (
                    <TrendModal
                        visible={true}
                        onClose={() => setTrendModalVisible(false)}
                        title="Yeni Konut İzni Trendi"
                        data={trendModalData}
                        isPremium={isPremium}
                        isAuthenticated={!!session}
                        onLogin={() => {
                            setTrendModalVisible(false);
                            router.push('/login-modal');
                        }}
                        onUpgrade={() => {
                            // Navigate to paywall or handle upgrade
                            console.log('Upgrade clicked');
                            setTrendModalVisible(false);
                        }}
                    />
                )
            }

            {/* Sales Trend Analysis Modal */}
            {
                salesTrendVisible && (
                    <TrendModal
                        visible={true}
                        onClose={() => setSalesTrendVisible(false)}
                        title="Satış Trendi Analizi"
                        data={salesTrendData}
                        isPremium={isPremium}
                        isAuthenticated={!!session}
                        filterType="AGGREGATION"
                        showCityFilter={true}
                        selectedCity={salesCity}
                        onCityChange={(city) => {
                            setSalesCity(city);
                            fetchSalesTrend(city, salesPeriod);
                        }}
                        selectedPeriod={salesPeriod}
                        onPeriodChange={(period) => {
                            setSalesPeriod(period);
                            fetchSalesTrend(salesCity, period);
                        }}
                        onLogin={() => {
                            setSalesTrendVisible(false);
                            router.push('/login-modal');
                        }}
                        onUpgrade={() => {
                            setSalesTrendVisible(false);
                        }}
                    />
                )
            }
            {/* 3. Loan Trend Logic */}
            {
                loanTrendVisible && (
                    <TrendModal
                        visible={true}
                        onClose={() => setLoanTrendVisible(false)}
                        title="Konut Kredisi Trendi"
                        data={loanTrendData}
                        isPremium={isPremium}
                        isAuthenticated={!!session}
                        hideFilters={true} // Simplified Mode
                        onLogin={() => {
                            setLoanTrendVisible(false);
                            router.push('/login-modal');
                        }}
                        onUpgrade={() => {
                            setLoanTrendVisible(false);
                        }}
                    />
                )
            }</SafeAreaView>
    );
}

// Force Refresh
