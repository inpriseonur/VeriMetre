import { AutoPageHeaderStats, AutoSalesHistoryItem, FuelAnalysisItem, getAutoPageHeader, getFuelAnalysis, getSalesHistory } from '@/lib/autoService';
import { BarChart3, Calendar, ChevronDown, ChevronUp, Layers, TrendingDown, TrendingUp, Zap } from 'lucide-react-native';
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
    const [fuelItems, setFuelItems] = useState<FuelAnalysisItem[]>([]);
    const [fuelDate, setFuelDate] = useState<string | null>(null);
    const [historyData, setHistoryData] = useState<AutoSalesHistoryItem[]>([]);

    // Filter State
    const [filter, setFilter] = useState<'1Y' | '7Y'>('1Y');
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [headerRes, fuelRes, historyRes] = await Promise.all([
                getAutoPageHeader(),
                getFuelAnalysis(),
                getSalesHistory()
            ]);

            if (headerRes && headerRes.data) {
                setHeaderStats(headerRes.data);
            }

            if (fuelRes && fuelRes.data) {
                setFuelItems(fuelRes.data.items || []);
                setFuelDate(fuelRes.data.reference_date);
            }

            if (historyRes && historyRes.data) {
                setHistoryData(historyRes.data);
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

    // Helper: Prepare Chart Data based on Filter
    const getChartData = () => {
        if (!historyData || historyData.length === 0) return [];

        let processedData = [];

        if (filter === '1Y') {
            // Last 12 Months
            // HISTORY is sorted ASC (Old -> New).
            // User wants: Newest on LEFT. (Reverse Chronological)
            const sliced = historyData.slice(-12); // Get last 12
            const reversed = sliced.reverse(); // Newest first

            processedData = reversed.map(item => ({
                value: item.quantity,
                label: new Date(item.reference_date).toLocaleString('tr-TR', { month: 'short' }),
                date: item.reference_date,
                displayLabel: new Date(item.reference_date).toLocaleString('tr-TR', { month: 'long', year: 'numeric' })
            }));
        } else {
            // 7Y Aggregation (Yearly Totals)
            // Group by Year
            const yearlyMap = new Map<number, number>();
            historyData.forEach(item => {
                const year = new Date(item.reference_date).getFullYear();
                const current = yearlyMap.get(year) || 0;
                yearlyMap.set(year, current + item.quantity);
            });

            // Convert map to array and take last 7 years
            const years = Array.from(yearlyMap.keys()).sort((a, b) => a - b);
            const last7Years = years.slice(-7);

            // Also reverse for consistency (Newest Year on Left)
            const reversedYears = last7Years.reverse();

            processedData = reversedYears.map(year => ({
                value: yearlyMap.get(year) || 0,
                label: year.toString(),
                date: `${year}-01-01`, // Dummy date for reference
                displayLabel: year.toString() // For tooltip
            }));
        }

        return processedData.map((item, index) => {
            // For Reverse Chronological, "Last Point" logically usually means "Latest Data"
            // Since we reversed, index 0 is the Latest Data.
            // If we want the pulse on the latest data (which is now on the left), index === 0.
            const isLatest = index === 0;

            return {
                ...item,
                labelTextStyle: { color: 'gray', fontSize: 10 },
                customDataPoint: isLatest && filter === '1Y' ? () => (
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

    // Helper for Pie Chart Data
    const getPieData = () => {
        const colors = ['#22c55e', '#ef4444', '#3b82f6', '#06b6d4', '#8b5cf6', '#f59e0b', '#64748b'];
        return (fuelItems || []).map((item, index) => ({
            value: item.share_percent,
            color: colors[index % colors.length],
            // text prop removed to keep chart clean
        }));
    };

    // Helper to get color for a fuel
    const getFuelColor = (index: number) => {
        const colors = ['#22c55e', '#ef4444', '#3b82f6', '#06b6d4', '#8b5cf6', '#f59e0b', '#64748b'];
        return colors[index % colors.length];
    };

    // Format Time for "Son Güncelleme"
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
                pointerStripHeight: height, // Dynamic height
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
        <SafeAreaView className="flex-1 bg-[#0B1121]">
            <StatusBar barStyle="light-content" backgroundColor="#0B1121" />

            {/* Full Screen Modal */}
            <Modal visible={isMaximized} transparent={true} animationType="fade">
                <View className="flex-1 bg-black/90 justify-center items-center">
                    {/* Rotate Container for Landscape Simulation */}
                    <View
                        style={{
                            width: Dimensions.get('window').height, // Swap width/height
                            height: Dimensions.get('window').width,
                            transform: [{ rotate: '90deg' }],
                            backgroundColor: '#0B1121',
                            padding: 20
                        }}
                    >
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-white text-xl font-bold">Tarihsel Trend ({filter})</Text>
                            <TouchableOpacity onPress={() => setIsMaximized(false)} className="bg-slate-800 p-2 rounded-lg">
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
                {/* --- Header (Same as Home) --- */}
                <View className="flex-row justify-between items-center mb-6">
                    <View className="flex-row items-center gap-2">
                        <View className="bg-blue-600 p-1.5 rounded-lg">
                            <BarChart3 size={20} color="white" />
                        </View>
                        <Text className="text-white text-2xl font-bold tracking-tight">VeriMatik</Text>
                    </View>
                    <View className="bg-slate-800/80 px-3 py-1.5 rounded-full">
                        <Text className="text-slate-400 text-xs font-medium">Son Güncelleme: {timeString}</Text>
                    </View>
                </View>

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
                    <Text className="text-white text-lg font-bold mb-4">Yakıt Savaşları</Text>

                    {loading && fuelItems.length === 0 ? (
                        <View className="h-40 items-center justify-center">
                            <Text className="text-slate-600">Yükleniyor...</Text>
                        </View>
                    ) : fuelItems.length === 0 ? (
                        <View className="h-40 items-center justify-center">
                            <Text className="text-slate-500">Bu dönem için veri bulunamadı.</Text>
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
                                    innerCircleColor="#151C2F" // Dark background matching card using hex
                                    centerLabelComponent={() => {
                                        return (
                                            <View className="items-center justify-center">
                                                <Text className="text-slate-400 text-[10px] font-medium uppercase">VERİ DÖNEMİ</Text>
                                                <Text className="text-white text-xl font-bold">{getMonthName(fuelDate || '')}</Text>
                                            </View>
                                        );
                                    }}
                                />
                            </View>

                            {/* B) Rich List - SINGLE LINE ALIGNED LAYOUT */}
                            <View className="flex-1 gap-2">
                                {fuelItems.map((item, index) => (
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

                                        {/* Right Side: Trend Badge (Unchanged) */}
                                        <View className={`px-2 py-1 rounded-lg flex-row items-center gap-1 ${item.direction === 'up' ? 'bg-green-500/20' : 'bg-red-500/20'} w-[60px] justify-center`}>
                                            {item.direction === 'up' ? <ChevronUp size={10} color="#22c55e" /> : <ChevronDown size={10} color="#ef4444" />}
                                            <Text className={`text-[10px] font-bold ${item.direction === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                                                %{Math.abs(item.change_rate)}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </View>

                {/* --- Tarihsel Trend (Historical Trend) --- */}
                <View className="mb-20 bg-slate-800/20 rounded-3xl p-5 border border-white/5">
                    <View className="flex-row justify-between items-center mb-6">
                        <View className="flex-row items-center gap-2">
                            <Text className="text-white text-lg font-bold">Tarihsel Trend</Text>
                            <TouchableOpacity onPress={() => setIsMaximized(true)} className="bg-slate-700/50 p-1.5 rounded-lg">
                                <Text className="text-cyan-400 text-xs font-bold">⤢</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Filter Controls */}
                        <View className="flex-row bg-slate-800 rounded-lg p-1">
                            {(['1Y', '7Y'] as const).map((opt) => (
                                <TouchableOpacity
                                    key={opt}
                                    onPress={() => setFilter(opt)}
                                    className={`px-3 py-1 rounded-md ${filter === opt ? 'bg-blue-600' : 'bg-transparent'}`}
                                >
                                    <Text className={`text-xs font-bold ${filter === opt ? 'text-white' : 'text-slate-400'}`}>
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
