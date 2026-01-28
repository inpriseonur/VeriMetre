import { CityItem, getActiveCities } from '@/lib/housingService';
import { BlurView } from 'expo-blur';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { Building2, Check, ChevronDown, LandPlot, Lock, Search, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

export interface TrendDataPoint {
    label: string;      // X-Axis Label (e.g. 'Oca 24')
    value: number;      // Main Value (Y-Axis)
    subValue?: number;  // Secondary Value (e.g. m2 or previous year)
    date: string;       // Full date for tooltip
    // Optional extras for specific modes
    permit_count?: number;
    avg_m2?: number;
}

export interface TrendModalProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    data: TrendDataPoint[];
    isPremium: boolean;
    isAuthenticated: boolean;
    onLogin?: () => void;
    onUpgrade?: () => void;

    // Filter Config
    filterType?: 'DATE_RANGE' | 'AGGREGATION';

    // Aggregation mode props
    showCityFilter?: boolean;
    selectedCity?: string;
    onCityChange?: (city: string) => void;
    selectedPeriod?: 'monthly' | 'yearly';
    onPeriodChange?: (period: 'monthly' | 'yearly') => void;

    // Simplified Mode
    hideFilters?: boolean;
}

export default function TrendModal({
    visible, onClose, title, data, isPremium, isAuthenticated,
    onLogin, onUpgrade,
    filterType = 'DATE_RANGE',
    showCityFilter, selectedCity, onCityChange,
    selectedPeriod, onPeriodChange,
    hideFilters = false
}: TrendModalProps) {
    const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
    const [activeTab, setActiveTab] = useState<'PRIMARY' | 'SECONDARY'>('PRIMARY'); // Generalized from COUNT/AVG_M2
    const [timeFilter, setTimeFilter] = useState<'1Y' | '3Y' | 'ALL'>('1Y');

    // City Filter State
    const [cityList, setCityList] = useState<CityItem[]>([]);
    const [isCitySelectorVisible, setCitySelectorVisible] = useState(false);
    const [citySearchQuery, setCitySearchQuery] = useState('');

    useEffect(() => {
        if (showCityFilter) {
            getActiveCities().then(cities => {
                // Ensure TR is at top
                const hasTR = cities.find(c => c.city_code === 'TR');
                let list = cities;
                if (!hasTR) {
                    list = [{ city_code: 'TR', city_name: 'Türkiye Geneli' }, ...cities];
                } else {
                    // Move TR to top if exists but not first? 
                    // Usually API handled, but safe to force.
                    list = [{ city_code: 'TR', city_name: 'Türkiye Geneli' }, ...cities.filter(c => c.city_code !== 'TR')];
                }
                setCityList(list);
            });
        }
    }, [showCityFilter]);

    const filteredCities = useMemo(() => {
        if (!citySearchQuery) return cityList;
        return cityList.filter(c =>
            c.city_name.toLowerCase().includes(citySearchQuery.toLowerCase())
        );
    }, [cityList, citySearchQuery]);

    const selectedCityName = useMemo(() => {
        const found = cityList.find(c => c.city_code === selectedCity);
        return found ? found.city_name : (selectedCity === 'TR' ? 'Türkiye Geneli' : selectedCity);
    }, [cityList, selectedCity]);

    useEffect(() => {
        // Force Landscape
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);

        // Listener to re-enforce StatusBar hidden if orientation causes it to show
        const subscription = ScreenOrientation.addOrientationChangeListener(() => {
            // Re-assert hidden on any orientation shift
            // Using standard RN StatusBar for imperative call as backup, 
            // even though we use expo-status-bar component for declarative.
            // But expo-status-bar calls are usually declarative.
            // Let's force a state update if needed, but simple re-render might process.
            // Actually, imperative setHidden is safest here.
        });

        return () => {
            ScreenOrientation.removeOrientationChangeListener(subscription);
            ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        };
    }, []);

    // --- Filter Logic ---
    const filteredData = useMemo(() => {
        if (!data || data.length === 0) return [];

        let processedData = [...data];

        // Date Range Filtering (Only applies if NOT in Aggregation mode or strict date mode)
        // Actually, sometimes even in aggregation mode we might want to limit visualized points?
        // But for Sales Trend (Aggregation), the backend handles content.

        if (filterType === 'DATE_RANGE') {
            let months = processedData.length;
            if (timeFilter === '1Y') months = 12;
            if (timeFilter === '3Y') months = 36;

            // Standard Logic: Input is Newest First (Descending) from API/State
            // We want the most recent N months.
            // slice(0, N) takes the top N (Newest).
            // .reverse() puts them in Chronological Order (Oldest -> Newest) for Chart.
            processedData = processedData.slice(0, months).reverse();
        } else {
            // Aggregation mode: API returns ready-to-display chronological order usually?
            // Let's assume passed data is already chronological for Aggregation, or check data.
            // If data comes from getHousingSalesChartData, it might be chrono.
            // We can check generic parsing logic later.
            // For now, trust the input order or reverse if needed.
            // If Sales Trend, we probably want NO reversing if API sends chronological.
        }

        return processedData;
    }, [data, timeFilter, filterType]);

    // --- Chart Data Preparation ---
    const chartData = useMemo(() => {
        const threshold = selectedPeriod === 'monthly' ? 12 : 3;
        return filteredData.map((d, index) => {
            // Determine value based on activeTab (for Permits: Count vs M2)
            // For Sales: Only Value usually.

            // Heuristic compatibility
            let val = d.value;
            if (d.permit_count !== undefined && activeTab === 'PRIMARY') val = d.permit_count;
            if (d.avg_m2 !== undefined && activeTab === 'SECONDARY') val = d.avg_m2;

            return {
                value: val,
                label: index % Math.ceil(filteredData.length / 6) === 0 ? d.label : '',
                dataPointText: '',
                date: d.date || d.label,
                isNearRightEdge: index >= filteredData.length - threshold, // Dynamic threshold
            };
        });
    }, [filteredData, activeTab, selectedPeriod]);

    const maxValue = useMemo(() => {
        const max = Math.max(...chartData.map(d => d.value), 0);
        return max > 0 ? max * 1.2 : 100;
    }, [chartData]);



    const renderChart = () => {
        // Calculate dynamic width
        // Modal Padding (px-5 = 20px * 2 = 40px) + Container Padding (p-4 = 16px * 2 = 32px) = 72px reserved.
        // Y-Axis Label width approx 40-50px.
        // Let's use a safe width calculation.
        const chartWidth = SCREEN_WIDTH - 80;

        return (
            <View style={{ alignItems: 'center', width: '100%' }}>
                <LineChart
                    areaChart
                    data={chartData}
                    height={SCREEN_HEIGHT * 0.55}
                    width={chartWidth}
                    // Dynamic Spacing to fill the width
                    spacing={chartData.length > 1 ? (chartWidth - 40) / (chartData.length - 1) : chartWidth / 2}
                    initialSpacing={20}
                    endSpacing={20}
                    color={activeTab === 'PRIMARY' ? "#3b82f6" : "#22c55e"}
                    startFillColor={activeTab === 'PRIMARY' ? "#3b82f6" : "#22c55e"}
                    startOpacity={0.2}
                    endOpacity={0.05}
                    thickness={3}
                    hideRules
                    hideYAxisText={false}
                    yAxisTextStyle={{ color: '#64748b', fontSize: 10 }}
                    xAxisLabelTextStyle={{ color: 'gray', fontSize: 10, width: 60, textAlign: 'center' }}
                    noOfSections={4}
                    maxValue={maxValue}
                    pointerConfig={{
                        pointerStripUptoDataPoint: true,
                        pointerStripColor: 'rgba(255,255,255,0.2)',
                        pointerStripWidth: 2,
                        strokeDashArray: [2, 5],
                        pointerColor: 'white',
                        radius: 4,
                        pointerLabelWidth: 100,
                        pointerLabelHeight: 120,
                        activatePointersOnLongPress: true,
                        autoAdjustPointerLabelPosition: false,
                        pointerLabelComponent: (items: any) => {
                            const item = items?.[0];
                            if (!item || item.value == null) return null;

                            const isRightEdge = item.isNearRightEdge;

                            return (
                                <View style={{
                                    height: 60,
                                    width: 100,
                                    backgroundColor: '#1e293b',
                                    borderRadius: 8,
                                    justifyContent: 'center',
                                    paddingLeft: 12,
                                    borderWidth: 1,
                                    borderColor: 'rgba(255,255,255,0.1)',
                                    transform: [{ translateX: isRightEdge ? -120 : 0 }] // Shift left for last points
                                }}>
                                    <Text style={{ color: 'lightgray', fontSize: 10, marginBottom: 2 }}>{item.date}</Text>
                                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>
                                        {item.value.toLocaleString('tr-TR')}
                                    </Text>
                                </View>
                            );
                        },
                    }}
                />
            </View>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            statusBarTranslucent={true}
            onRequestClose={onClose}
        >
            <StatusBar style="light" hidden={true} translucent />
            <View className="flex-1 bg-[#0B1121] px-5 pt-6 justify-between pb-6">

                {/* Header */}
                <View className="flex-row justify-between items-center mb-2">
                    <View className="flex-row items-center gap-4">
                        <Text className="text-white text-xl font-bold">{title}</Text>

                        {/* Conditional Secondary Tab (e.g. for Permits) */}
                        {!hideFilters && data.length > 0 && (data[0].avg_m2 !== undefined) && (
                            <View className="flex-row bg-slate-900 p-1 rounded-xl">
                                <TouchableOpacity
                                    className={`flex-row items-center justify-center py-1.5 px-3 rounded-lg gap-2 ${activeTab === 'PRIMARY' ? 'bg-slate-700' : ''}`}
                                    onPress={() => setActiveTab('PRIMARY')}
                                >
                                    <Building2 size={14} color={activeTab === 'PRIMARY' ? 'white' : '#64748b'} />
                                    <Text className={`${activeTab === 'PRIMARY' ? 'text-white font-bold' : 'text-slate-500 font-medium'} text-[10px]`}>Adet</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    className={`flex-row items-center justify-center py-1.5 px-3 rounded-lg gap-2 ${activeTab === 'SECONDARY' ? 'bg-slate-700' : ''}`}
                                    onPress={() => setActiveTab('SECONDARY')}
                                >
                                    <LandPlot size={14} color={activeTab === 'SECONDARY' ? 'white' : '#64748b'} />
                                    <Text className={`${activeTab === 'SECONDARY' ? 'text-white font-bold' : 'text-slate-500 font-medium'} text-[10px]`}>Ort. m²</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Filter Type: AGGREGATION Controls */}
                        {!hideFilters && filterType === 'AGGREGATION' && (
                            <View className="flex-row gap-2">
                                <View className="flex-row bg-slate-900 p-1 rounded-lg">
                                    <TouchableOpacity
                                        onPress={() => onPeriodChange && onPeriodChange('monthly')}
                                        className={`px-3 py-1 rounded-md ${selectedPeriod === 'monthly' ? 'bg-blue-600' : ''}`}
                                    >
                                        <Text className={`text-xs ${selectedPeriod === 'monthly' ? 'text-white font-bold' : 'text-slate-400'}`}>Aylık</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => onPeriodChange && onPeriodChange('yearly')}
                                        className={`px-3 py-1 rounded-md ${selectedPeriod === 'yearly' ? 'bg-blue-600' : ''}`}
                                    >
                                        <Text className={`text-xs ${selectedPeriod === 'yearly' ? 'text-white font-bold' : 'text-slate-400'}`}>Yıllık</Text>
                                    </TouchableOpacity>
                                </View>

                                {showCityFilter && (
                                    <>
                                        <TouchableOpacity
                                            onPress={() => setCitySelectorVisible(true)}
                                            className="flex-row items-center bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg gap-2"
                                        >
                                            <Text className="text-white text-xs font-bold">{selectedCityName}</Text>
                                            <ChevronDown size={14} color="#94a3b8" />
                                        </TouchableOpacity>

                                        {/* City Selector Modal */}
                                        <Modal
                                            visible={isCitySelectorVisible}
                                            animationType="fade"
                                            transparent={true}
                                            onRequestClose={() => setCitySelectorVisible(false)}
                                        >
                                            <TouchableOpacity
                                                activeOpacity={1}
                                                onPress={() => setCitySelectorVisible(false)}
                                                className="flex-1 bg-black/80 justify-center items-center px-20"
                                            >
                                                <TouchableOpacity
                                                    activeOpacity={1}
                                                    className="bg-[#1e293b] w-full max-w-lg h-[80%] rounded-2xl border border-white/10 overflow-hidden"
                                                >
                                                    {/* Modal Header */}
                                                    <View className="flex-row items-center justify-between p-4 border-b border-white/5 bg-slate-900">
                                                        <Text className="text-white font-bold text-lg">Şehir Seçin</Text>
                                                        <TouchableOpacity onPress={() => setCitySelectorVisible(false)} className="p-1">
                                                            <X size={20} color="#cbd5e1" />
                                                        </TouchableOpacity>
                                                    </View>

                                                    {/* Search Input */}
                                                    <View className="p-3 border-b border-white/5">
                                                        <View className="flex-row items-center bg-slate-800 rounded-xl px-3 h-10 border border-white/5">
                                                            <Search size={16} color="#94a3b8" />
                                                            <TextInput
                                                                className="flex-1 text-white ml-2 text-sm h-full"
                                                                placeholder="Şehir ara..."
                                                                placeholderTextColor="#64748b"
                                                                value={citySearchQuery}
                                                                onChangeText={setCitySearchQuery}
                                                                autoFocus={false}
                                                            />
                                                            {citySearchQuery.length > 0 && (
                                                                <TouchableOpacity onPress={() => setCitySearchQuery('')}>
                                                                    <X size={14} color="#64748b" />
                                                                </TouchableOpacity>
                                                            )}
                                                        </View>
                                                    </View>

                                                    {/* City List */}
                                                    <FlatList
                                                        data={filteredCities}
                                                        keyExtractor={(item) => item.city_code}
                                                        keyboardShouldPersistTaps="handled" // Important for touch inside list
                                                        renderItem={({ item }) => {
                                                            const isSelected = selectedCity === item.city_code;
                                                            return (
                                                                <TouchableOpacity
                                                                    onPress={() => {
                                                                        onCityChange && onCityChange(item.city_code);
                                                                        setCitySelectorVisible(false);
                                                                    }}
                                                                    className={`flex-row items-center justify-between p-4 border-b border-white/5 ${isSelected ? 'bg-blue-600/10' : 'active:bg-slate-800'}`}
                                                                >
                                                                    <Text className={`text-sm font-medium ${isSelected ? 'text-blue-400' : 'text-slate-300'}`}>
                                                                        {item.city_name}
                                                                    </Text>
                                                                    {isSelected && (
                                                                        <Check size={16} color="#60a5fa" />
                                                                    )}
                                                                </TouchableOpacity>
                                                            );
                                                        }}
                                                        ListEmptyComponent={
                                                            <View className="p-8 items-center">
                                                                <Text className="text-slate-500">Şehir bulunamadı.</Text>
                                                            </View>
                                                        }
                                                    />
                                                </TouchableOpacity>
                                            </TouchableOpacity>
                                        </Modal>
                                    </>
                                )}
                            </View>
                        )}
                    </View>

                    <TouchableOpacity onPress={onClose} className="bg-slate-800 p-2 rounded-full">
                        <X size={24} color="#cbd5e1" />
                    </TouchableOpacity>
                </View>

                {/* Main Content */}
                <View className="flex-1 justify-center relative bg-slate-900/30 rounded-3xl border border-white/5 p-4 mb-4">
                    {renderChart()}

                    {/* Overlay Logic */}
                    {(!isAuthenticated || !isPremium) && (
                        <BlurView intensity={100} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: 24, justifyContent: 'center', alignItems: 'center', zIndex: 10, overflow: 'hidden' }]}>
                            <View className="bg-black/60 p-6 rounded-2xl items-center border border-white/10 w-[60%]">
                                <View className="bg-yellow-500/20 p-4 rounded-full mb-4">
                                    <Lock size={32} color="#fbbf24" strokeWidth={2.5} />
                                </View>
                                <Text className="text-white text-lg font-bold text-center mb-2">{!isAuthenticated ? 'Analizleri Keşfedin' : 'Trend Analizini Görüntüle'}</Text>
                                <Text className="text-slate-300 text-center text-sm mb-6 leading-5">
                                    {!isAuthenticated ? 'Bu veriye erişmek için lütfen giriş yapın.' : 'Konut piyasasının tarihsel değişimini ve m² trendlerini incelemek için Premium\'a geçin.'}
                                </Text>
                                <TouchableOpacity onPress={!isAuthenticated ? onLogin : onUpgrade} className="bg-yellow-500 w-full py-3 rounded-xl active:bg-yellow-600">
                                    <Text className="text-black font-bold text-center">{!isAuthenticated ? 'Giriş Yap / Kayıt Ol' : 'Premium\'a Yükselt'}</Text>
                                </TouchableOpacity>
                            </View>
                        </BlurView>
                    )}
                </View>

                {/* Bottom Bar: Time Filters (Only for DATE_RANGE mode) */}
                {filterType === 'DATE_RANGE' && (
                    <View className="flex-row justify-center gap-4">
                        {['1Y', '3Y', 'ALL'].map((f) => (
                            <TouchableOpacity
                                key={f}
                                onPress={() => setTimeFilter(f as any)}
                                disabled={!isPremium && isAuthenticated}
                                className={`px-4 py-2 rounded-lg border ${timeFilter === f ? 'bg-blue-600 border-blue-500' : 'bg-slate-800 border-white/10'} ${(!isPremium) ? 'opacity-30' : ''}`}
                            >
                                <Text className={`${timeFilter === f ? 'text-white' : 'text-slate-400'} font-bold text-xs`}>
                                    {f === 'ALL' ? 'Tümü 👑' : f === '1Y' ? '1 Yıl' : '3 Yıl'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>
        </Modal>
    );
}
