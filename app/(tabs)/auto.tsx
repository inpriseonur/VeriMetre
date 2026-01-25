import { AutoPageHeaderStats, AutoSalesHistoryItem, BrandAnalysis, FuelAnalysisResponse, getAutoPageHeader, getBrandAnalysis, getFuelAnalysis, getSalesHistory } from '@/lib/autoService';
import { Calendar, ChevronDown, ChevronUp, Layers, TrendingDown, TrendingUp, Zap } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, Modal, RefreshControl, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { LineChart, PieChart } from 'react-native-gifted-charts';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function AutoScreen() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Data States
    const [headerStats, setHeaderStats] = useState<AutoPageHeaderStats | null>(null);
    const [fuelAnalysis, setFuelAnalysis] = useState<FuelAnalysisResponse | null>(null);
    const [brandAnalysis, setBrandAnalysis] = useState<BrandAnalysis | null>(null);
    const [historyData, setHistoryData] = useState<AutoSalesHistoryItem[]>([]);

    // Filter States
    const [fuelWarFilter, setFuelWarFilter] = useState<'MONTH' | 'YEAR'>('MONTH');
    const [fuelWarTab, setFuelWarTab] = useState<'FUEL' | 'BRAND'>('FUEL');

    // Historical Trend Filter
    const [trendFilter, setTrendFilter] = useState<'1Y' | '7Y'>('1Y');
    const [isTrendMaximized, setIsTrendMaximized] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [headerRes, fuelRes, historyRes, brandRes] = await Promise.all([
                getAutoPageHeader(),
                getFuelAnalysis(),
                getSalesHistory(),
                getBrandAnalysis()
            ]);

            if (headerRes && headerRes.data) {
                setHeaderStats(headerRes.data);
            }

            if (fuelRes && fuelRes.data) {
                setFuelAnalysis(fuelRes.data);
            }

            if (historyRes && historyRes.data) {
                setHistoryData(historyRes.data);
            }

            if (brandRes && brandRes.data) {
                setBrandAnalysis(brandRes.data);
            }

        } catch (error) {
            console.error('Auto Screen Fetch Error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData();
    }, []);

    const formatNumber = (num: number) => {
        return num.toLocaleString('tr-TR');
    };

    const getMonthName = (dateStr: string) => {
        try {
            if (!dateStr) return '';
            return new Date(dateStr).toLocaleString('tr-TR', { month: 'long' });
        } catch {
            return '';
        }
    };

    // --- Helper: Get Current Fuel Data (Month vs Year) ---
    const getCurrentFuelData = () => {
        if (!fuelAnalysis) return null;
        return fuelWarFilter === 'MONTH' ? fuelAnalysis.monthly : fuelAnalysis.yearly;
    };

    const currentFuelData = getCurrentFuelData();

    // Helper for Pie Chart Data
    const getPieData = () => {
        const colors = ['#22c55e', '#ef4444', '#3b82f6', '#06b6d4', '#8b5cf6', '#f59e0b', '#64748b'];
        const items = currentFuelData?.items || [];
        return items.map((item, index) => ({
            value: item.share_percent,
            color: colors[index % colors.length],
        }));
    };

    // Helper to get color for a fuel
    const getFuelColor = (index: number) => {
        const colors = ['#22c55e', '#ef4444', '#3b82f6', '#06b6d4', '#8b5cf6', '#f59e0b', '#64748b'];
        return colors[index % colors.length];
    };

    // --- Helper: Prepare Historical Trend Chart Data ---
    const getChartData = () => {
        if (!historyData || historyData.length === 0) return [];

        let processedData = [];

        if (trendFilter === '1Y') {
            // Last 12 Months - Reversed (Newest on Left)
            const sliced = historyData.slice(-12);
            const reversed = sliced.reverse();

            processedData = reversed.map(item => ({
                value: item.quantity,
                label: new Date(item.reference_date).toLocaleString('tr-TR', { month: 'short' }),
                date: item.reference_date,
                displayLabel: new Date(item.reference_date).toLocaleString('tr-TR', { month: 'long', year: 'numeric' })
            }));
        } else {
            // 7Y Aggregation (Yearly Totals)
            const yearlyMap = new Map<number, number>();
            historyData.forEach(item => {
                const year = new Date(item.reference_date).getFullYear();
                const current = yearlyMap.get(year) || 0;
                yearlyMap.set(year, current + item.quantity);
            });

            const years = Array.from(yearlyMap.keys()).sort((a, b) => a - b);
            const last7Years = years.slice(-7);
            const reversedYears = last7Years.reverse();

            processedData = reversedYears.map(year => ({
                value: yearlyMap.get(year) || 0,
                label: year.toString(),
                date: `${year}-01-01`,
                displayLabel: year.toString()
            }));
        }

        return processedData.map((item, index) => {
            const isLatest = index === 0;

            return {
                ...item,
                labelTextStyle: { color: 'gray', fontSize: 10 },
                customDataPoint: isLatest && trendFilter === '1Y' ? () => (
                    <View
                        style={{
                            width: 12,
                            height: 12,
                            borderRadius: 6,
                            backgroundColor: 'white',
                            borderWidth: 2,
                            borderColor: '#06b6d4',
                            shadowColor: '#06b6d4',
                            shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: 0.8,
                            shadowRadius: 4,
                            elevation: 5,
                        }}
                    />
                ) : undefined
            };
        });
    };

    const chartData = getChartData();

    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    // Chart Component (Reusable)
    const renderChart = (width: number, height: number) => (
        <LineChart
            data={chartData}
            areaChart
            curved
            startFillColor="#06b6d4"
            startOpacity={0.8}
            endFillColor="#06b6d4"
            endOpacity={0.1}
            initialSpacing={20}
            color="#06b6d4"
            thickness={3}
            hideDataPoints={false}
            dataPointsColor="#06b6d4"
            dataPointsRadius={4}
            xAxisLabelTextStyle={{ color: 'gray', fontSize: 10 }}
            yAxisLabelWidth={45}
            yAxisTextStyle={{ color: 'gray', fontSize: 10 }}
            rulesColor="rgba(255,255,255,0.1)"
            width={width}
            height={height}
            pointerConfig={{
                pointerStripHeight: height,
                pointerStripColor: 'lightgray',
                pointerStripWidth: 2,
                pointerColor: 'lightgray',
                radius: 6,
                pointerLabelWidth: 100,
                pointerLabelHeight: 90,
                activatePointersOnLongPress: false,
                autoAdjustPointerLabelPosition: false,
                pointerLabelComponent: (items: any) => {
                    const item = items[0];
                    return (
                        <View
                            style={{
                                height: 90,
                                width: 100,
                                justifyContent: 'center',
                                marginTop: -30,
                                marginLeft: -40,
                            }}>
                            <View style={{ padding: 6, borderRadius: 8, backgroundColor: '#1e293b', opacity: 0.9 }}>
                                <Text style={{ color: 'gray', fontSize: 10, marginBottom: 2, textAlign: 'center' }}>
                                    {item.displayLabel}
                                </Text>
                                <Text style={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>
                                    {formatNumber(item.value)}
                                </Text>
                            </View>
                        </View>
                    );
                },
            }}
        />
    );

    return (
        <SafeAreaView className="flex-1 bg-[#0B1121]" edges={['left', 'right', 'bottom']}>
            <StatusBar barStyle="light-content" backgroundColor="#0B1121" />

            {/* Full Screen Modal */}
            <Modal visible={isTrendMaximized} transparent={true} animationType="fade">
                <View className="flex-1 bg-black/90 justify-center items-center">
                    {/* Rotate Container for Landscape Simulation */}
                    <View
                        style={{
                            width: Dimensions.get('window').height,
                            height: Dimensions.get('window').width,
                            transform: [{ rotate: '90deg' }],
                            backgroundColor: '#0B1121',
                            padding: 20
                        }}
                    >
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-white text-xl font-bold">Tarihsel Trend ({trendFilter})</Text>
                            <TouchableOpacity onPress={() => setIsTrendMaximized(false)} className="bg-slate-800 p-2 rounded-lg">
                                <Text className="text-white font-bold">Kapat ✕</Text>
                            </TouchableOpacity>
                        </View>

                        <View className="flex-1 justify-center pb-8">
                            {/* Render Bigger Chart */}
                            {renderChart(Dimensions.get('window').height - 100, Dimensions.get('window').width - 120)}
                        </View>
                    </View>
                </View>
            </Modal>

            <ScrollView
                className="flex-1 px-5 pt-4"
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
                }
            >
                {/* --- Header Removed --- */}

                {/* --- Piyasa Nabzı (Header Cards) --- */}
                <View className="mb-8">
                    <Text className="text-white text-lg font-bold mb-3">Piyasa Nabzı</Text>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 12, paddingRight: 20 }}
                    >
                        {/* 1. Monthly Card */}
                        <View className="bg-slate-800/50 border border-white/5 rounded-2xl p-4 w-40 justify-between h-32">
                            {loading || !headerStats ? (
                                <View>
                                    <View className="h-4 w-20 bg-slate-700 rounded mb-2 animate-pulse" />
                                    <View className="h-8 w-28 bg-slate-700 rounded mb-2 animate-pulse" />
                                    <View className="h-4 w-16 bg-slate-700 rounded animate-pulse" />
                                </View>
                            ) : (
                                <>
                                    <View className="flex-row items-center gap-1">
                                        <Calendar size={12} color="#94a3b8" />
                                        <Text className="text-slate-400 text-xs font-medium uppercase tracking-wider">{getMonthName(headerStats.monthly_card.reference_date)} Ayı</Text>
                                    </View>
                                    <View>
                                        <Text className="text-white text-xl font-bold mb-1">{formatNumber(headerStats.monthly_card.total_sales)}</Text>
                                        <View className="flex-row items-center gap-1">
                                            {headerStats.monthly_card.direction === 'up' ?
                                                <TrendingUp size={12} color="#22c55e" /> :
                                                <TrendingDown size={12} color="#ef4444" />
                                            }
                                            <Text className={`${headerStats.monthly_card.direction === 'up' ? 'text-green-500' : 'text-red-500'} text-xs font-bold`}>
                                                %{headerStats.monthly_card.percent_change}
                                            </Text>
                                        </View>
                                    </View>
                                </>
                            )}
                        </View>

                        {/* 2. Yearly Card */}
                        <View className="bg-slate-800/50 border border-white/5 rounded-2xl p-4 w-44 justify-between h-32">
                            {loading || !headerStats ? (
                                <View>
                                    <View className="h-4 w-24 bg-slate-700 rounded mb-2 animate-pulse" />
                                    <View className="h-8 w-32 bg-slate-700 rounded mb-2 animate-pulse" />
                                    <View className="h-3 w-28 bg-slate-700 rounded animate-pulse" />
                                </View>
                            ) : (
                                <>
                                    <View className="flex-row items-center gap-1">
                                        <Layers size={12} color="#94a3b8" />
                                        <Text className="text-slate-400 text-xs font-medium uppercase tracking-wider">{headerStats.yearly_card.display_year} Toplamı</Text>
                                    </View>
                                    <View>
                                        <Text className="text-white text-xl font-bold mb-1">{formatNumber(headerStats.yearly_card.current_year_total)}</Text>
                                        <Text className="text-slate-500 text-[10px]">
                                            {headerStats.yearly_card.display_year - 1}: {formatNumber(headerStats.yearly_card.prev_year_total)}
                                        </Text>
                                    </View>
                                </>
                            )}
                        </View>

                        {/* 3. Top Fuel Card */}
                        <View className="bg-slate-800/50 border border-white/5 rounded-2xl p-4 w-40 justify-between h-32">
                            {loading || !headerStats ? (
                                <View>
                                    <View className="h-4 w-24 bg-slate-700 rounded mb-2 animate-pulse" />
                                    <View className="h-8 w-24 bg-slate-700 rounded mb-2 animate-pulse" />
                                    <View className="h-4 w-12 bg-slate-700 rounded animate-pulse" />
                                </View>
                            ) : (
                                <>
                                    <View className="flex-row items-center gap-1">
                                        <Zap size={12} color="#f59e0b" />
                                        <Text className="text-slate-400 text-xs font-medium uppercase tracking-wider">Zirvedeki Yakıt</Text>
                                    </View>
                                    <View>
                                        <Text className="text-white text-xl font-bold mb-1">{headerStats.top_fuel_card.fuel_name}</Text>
                                        <Text className="text-amber-500 text-xs font-bold">
                                            %{headerStats.top_fuel_card.share_percent} <Text className="text-slate-500 font-normal">Pazar Payı</Text>
                                        </Text>
                                    </View>
                                </>
                            )}
                        </View>

                    </ScrollView>
                </View>

                {/* --- Yakıt Savaşları (Fuel Wars) --- */}
                <View className="mb-8 bg-slate-800/20 rounded-3xl p-5 border border-white/5">
                    <View className="flex-row justify-between items-center mb-6">
                        <View className="flex-row items-center gap-4">
                            <Text className="text-white text-lg font-bold">Pazar Analizi</Text>

                            {/* Main Type Toggle */}
                            <View className="flex-row bg-slate-800 rounded-lg p-0.5">
                                <TouchableOpacity
                                    onPress={() => setFuelWarTab('FUEL')}
                                    className={`px-3 py-1 rounded-md ${fuelWarTab === 'FUEL' ? 'bg-blue-600' : 'bg-transparent'}`}
                                >
                                    <Text className={`text-xs font-bold ${fuelWarTab === 'FUEL' ? 'text-white' : 'text-slate-400'}`}>Yakıt</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setFuelWarTab('BRAND')}
                                    className={`px-3 py-1 rounded-md ${fuelWarTab === 'BRAND' ? 'bg-blue-600' : 'bg-transparent'}`}
                                >
                                    <Text className={`text-xs font-bold ${fuelWarTab === 'BRAND' ? 'text-white' : 'text-slate-400'}`}>Markalar</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Period Toggle - Only for FUEL mode */}
                        {fuelWarTab === 'FUEL' && (
                            <View className="flex-row bg-slate-800 rounded-lg p-1">
                                <TouchableOpacity
                                    onPress={() => setFuelWarFilter('MONTH')}
                                    className={`px-3 py-1 rounded-md ${fuelWarFilter === 'MONTH' ? 'bg-blue-600' : 'bg-transparent'}`}
                                >
                                    <Text className={`text-xs font-bold ${fuelWarFilter === 'MONTH' ? 'text-white' : 'text-slate-400'}`}>Ay</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setFuelWarFilter('YEAR')}
                                    className={`px-3 py-1 rounded-md ${fuelWarFilter === 'YEAR' ? 'bg-blue-600' : 'bg-transparent'}`}
                                >
                                    <Text className={`text-xs font-bold ${fuelWarFilter === 'YEAR' ? 'text-white' : 'text-slate-400'}`}>Yıl</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {fuelWarTab === 'FUEL' ? (

                        loading && !currentFuelData ? (
                            <View className="h-40 items-center justify-center">
                                <Text className="text-slate-600">Yükleniyor...</Text>
                            </View>
                        ) : !currentFuelData ? (
                            <View className="h-40 items-center justify-center">
                                <Text className="text-slate-500">Veri bulunamadı.</Text>
                            </View>
                        ) : (
                            <View className="flex-col md:flex-row gap-6">
                                {/* A) Donut Chart */}
                                <View className="items-center justify-center py-2">
                                    <PieChart
                                        data={getPieData()}
                                        donut
                                        radius={80}
                                        innerRadius={60}
                                        innerCircleColor="#151C2F"
                                        centerLabelComponent={() => {
                                            // FORMAT: Custom format based on Dashboard Reference Date
                                            let centerText = '';
                                            if (headerStats?.monthly_card?.reference_date) {
                                                const dateObj = new Date(headerStats.monthly_card.reference_date);
                                                if (fuelWarFilter === 'MONTH') {
                                                    // Uppercase Turkish Month Name: ARALIK
                                                    centerText = dateObj.toLocaleString('tr-TR', { month: 'long' }).toLocaleUpperCase('tr-TR');
                                                } else {
                                                    // Just Year: 2025
                                                    centerText = dateObj.getFullYear().toString();
                                                }
                                            } else {
                                                // Fallback
                                                centerText = currentFuelData.label || '';
                                            }

                                            return (
                                                <View className="items-center justify-center w-24">
                                                    <Text className="text-slate-400 text-[10px] font-medium uppercase text-center">VERİ DÖNEMİ</Text>
                                                    {/* Allow 2 lines if needed */}
                                                    <Text className="text-white text-xl font-bold text-center" numberOfLines={2}>{centerText}</Text>
                                                </View>
                                            );
                                        }}
                                    />
                                </View>

                                {/* B) Rich List - SINGLE LINE ALIGNED LAYOUT */}
                                <View className="flex-1 gap-2">
                                    {currentFuelData.items.map((item, index) => (
                                        <View key={item.fuel_name} className="flex-row items-center justify-between py-1">
                                            {/* Main Content (Left Aligned Columns) */}
                                            <View className="flex-row items-center flex-1 mr-2">

                                                {/* Col 1: Dot + Name (Width 80px) */}
                                                <View className="flex-row items-center w-[70px] gap-2">
                                                    <View className="w-2 h-2 rounded-full" style={{ backgroundColor: getFuelColor(index) }} />
                                                    <Text className="text-white font-medium text-xs" numberOfLines={1}>{item.fuel_name}</Text>
                                                </View>

                                                {/* Col 2: Sales (Width 60px - Right Aligned or Fixed) */}
                                                <View className="w-[50px] items-end mr-3">
                                                    <Text className="text-slate-400 text-[10px]">{formatNumber(item.sales_count)}</Text>
                                                </View>

                                                {/* Col 3: Percent (Width 40px) */}
                                                <View className="w-[40px]">
                                                    <Text className="text-slate-300 text-xs font-bold">%{item.share_percent}</Text>
                                                </View>

                                                {/* Col 4: Bar (Flex) */}
                                                <View className="flex-1 h-1 bg-slate-700/50 rounded-full overflow-hidden max-w-[50px]">
                                                    <View
                                                        className="h-full rounded-full"
                                                        style={{ width: `${item.share_percent}%`, backgroundColor: getFuelColor(index) }}
                                                    />
                                                </View>
                                            </View>

                                            {/* Right Side: Trend Badge (Conditional) */}
                                            {Math.abs(item.change_rate) > 0 ? (
                                                <View className={`px-2 py-1 rounded-lg flex-row items-center gap-1 ${item.direction === 'up' ? 'bg-green-500/20' : 'bg-red-500/20'} w-[60px] justify-center`}>
                                                    {item.direction === 'up' ? <ChevronUp size={10} color="#22c55e" /> : <ChevronDown size={10} color="#ef4444" />}
                                                    <Text className={`text-[10px] font-bold ${item.direction === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                                                        %{Math.abs(item.change_rate)}
                                                    </Text>
                                                </View>
                                            ) : (
                                                // Empty Space to maintain alignment if no trend -> EXACT SAME SIZE AS BADGE
                                                <View className="px-2 py-1 rounded-lg flex-row items-center gap-1 w-[60px] justify-center opacity-0">
                                                    <Text className="text-[10px] font-bold">%0</Text>
                                                </View>
                                            )}
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )) : (
                        /* --- NEW BRAND VIEW --- */
                        loading && !brandAnalysis ? (
                            <View className="h-40 items-center justify-center">
                                <Text className="text-slate-600">Marka verileri yükleniyor...</Text>
                            </View>
                        ) : !brandAnalysis ? (
                            <View className="h-40 items-center justify-center">
                                <Text className="text-slate-500">Marka verisi bulunamadı.</Text>
                            </View>
                        ) : (
                            <View className="px-1">
                                {/* 1. Market Summary (Progress Bars) */}
                                <View className="mb-6 p-4 bg-slate-800/40 rounded-xl">
                                    <View className="flex-row justify-between mb-3">
                                        <Text className="text-white text-sm font-bold">Yerli / İthal Pazar Dağılımı</Text>
                                        <Text className="text-slate-400 text-xs">{new Date(brandAnalysis.reference_date).toLocaleString('tr-TR', { month: 'long' }).toLocaleUpperCase('tr-TR')}</Text>
                                    </View>

                                    <View className="flex-row items-center h-6 rounded-full overflow-hidden bg-slate-900 border border-slate-700/50">
                                        {/* Domestic - Cyan */}
                                        <View style={{ width: `${brandAnalysis.summary.domestic_share}%` }} className="h-full bg-cyan-500 justify-center items-center">
                                            {brandAnalysis.summary.domestic_share > 10 && <Text className="text-[9px] text-white font-bold">% {brandAnalysis.summary.domestic_share}</Text>}
                                        </View>
                                        {/* Import - Orange */}
                                        <View style={{ width: `${brandAnalysis.summary.import_share}%` }} className="h-full bg-orange-500 justify-center items-center">
                                            {brandAnalysis.summary.import_share > 10 && <Text className="text-[9px] text-white font-bold">% {brandAnalysis.summary.import_share}</Text>}
                                        </View>
                                    </View>

                                    {/* Legends */}
                                    <View className="flex-row justify-between mt-3 px-1">
                                        <View className="flex-row items-center gap-2">
                                            <View className="w-3 h-3 rounded-full bg-cyan-500" />
                                            <Text className="text-slate-300 text-xs font-medium">Yerli Üretim</Text>
                                        </View>
                                        <View className="flex-row items-center gap-2">
                                            <View className="w-3 h-3 rounded-full bg-orange-500" />
                                            <Text className="text-slate-300 text-xs font-medium">İthal Araç</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* 2. Top Brands List */}
                                <View>
                                    <Text className="text-white text-sm font-bold mb-4">En Çok Satan Markalar</Text>
                                    {brandAnalysis.top_brands.map((brand, idx) => (
                                        <View key={brand.name} className="mb-4">
                                            <View className="flex-row justify-between items-end mb-1.5">
                                                <View className="flex-row items-center gap-2">
                                                    <View className="w-5 h-5 bg-slate-700 rounded items-center justify-center">
                                                        <Text className="text-slate-300 text-xs font-bold">{idx + 1}</Text>
                                                    </View>
                                                    <Text className="text-white font-bold text-sm">{brand.name}</Text>
                                                </View>
                                                <View className="items-end">
                                                    <Text className="text-white font-bold text-sm">{formatNumber(brand.total_qty)}</Text>
                                                    <Text className="text-slate-500 text-[10px]">Pazar Payı: %{brand.market_share}</Text>
                                                </View>
                                            </View>

                                            {/* Stacked Bar */}
                                            <View className="h-2 flex-row rounded-full overflow-hidden bg-slate-800">
                                                {brand.domestic_qty > 0 && (
                                                    <View style={{ flex: brand.domestic_qty, backgroundColor: '#06b6d4' }} />
                                                )}
                                                {brand.import_qty > 0 && (
                                                    <View style={{ flex: brand.import_qty, backgroundColor: '#f97316' }} />
                                                )}
                                            </View>

                                            {/* Labels below bar */}
                                            <View className="flex-row justify-between mt-1">
                                                <Text className="text-[10px] text-cyan-400 font-medium">
                                                    {brand.domestic_qty > 0 ? `Yerli: ${formatNumber(brand.domestic_qty)}` : ''}
                                                </Text>
                                                <Text className="text-[10px] text-orange-400 font-medium">
                                                    {brand.import_qty > 0 ? `İthal: ${formatNumber(brand.import_qty)}` : ''}
                                                </Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )
                    )}
                </View>

                {/* --- Tarihsel Trend (Historical Trend) --- */}
                <View className="mb-20 bg-slate-800/20 rounded-3xl p-5 border border-white/5">
                    <View className="flex-row justify-between items-center mb-6">
                        <View className="flex-row items-center gap-2">
                            <Text className="text-white text-lg font-bold">Tarihsel Trend</Text>
                            <TouchableOpacity onPress={() => setIsTrendMaximized(true)} className="bg-slate-700/50 p-1.5 rounded-lg">
                                <Text className="text-cyan-400 text-xs font-bold">⤢</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Filter Controls */}
                        <View className="flex-row bg-slate-800 rounded-lg p-1">
                            {(['1Y', '7Y'] as const).map((opt) => (
                                <TouchableOpacity
                                    key={opt}
                                    onPress={() => setTrendFilter(opt)}
                                    className={`px-3 py-1 rounded-md ${trendFilter === opt ? 'bg-blue-600' : 'bg-transparent'}`}
                                >
                                    <Text className={`text-xs font-bold ${trendFilter === opt ? 'text-white' : 'text-slate-400'}`}>
                                        {opt}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {loading && historyData.length === 0 ? (
                        <View className="h-40 items-center justify-center">
                            <Text className="text-slate-600">Veriler yükleniyor...</Text>
                        </View>
                    ) : (
                        <View style={{ overflow: 'hidden' }}>
                            {renderChart(SCREEN_WIDTH - 80, 220)}
                        </View>
                    )}
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}
