import { BlurView } from 'expo-blur';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Building2, LandPlot, Lock, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, StatusBar, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
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
}

export default function TrendModal({
    visible, onClose, title, data, isPremium, isAuthenticated,
    onLogin, onUpgrade,
    filterType = 'DATE_RANGE',
    showCityFilter, selectedCity, onCityChange,
    selectedPeriod, onPeriodChange
}: TrendModalProps) {
    const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
    const [activeTab, setActiveTab] = useState<'PRIMARY' | 'SECONDARY'>('PRIMARY'); // Generalized from COUNT/AVG_M2
    const [timeFilter, setTimeFilter] = useState<'6M' | '1Y' | 'ALL'>('1Y');

    // --- Orientation & Status Bar Logic ---
    useEffect(() => {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        StatusBar.setHidden(true, 'slide');
        return () => {
            ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
            StatusBar.setHidden(false, 'slide');
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
            if (timeFilter === '6M') months = 6;
            if (timeFilter === '1Y') months = 12;
            processedData = processedData.slice(0, months).reverse(); // Newest first from API assumed?
            // Actually API usually returns desc? If so slice(0,6) is last 6 months.
            // If API returns desc (newest first), slice(0,6) is newest 6. Reverse to show chronological left-to-right.
            // Need to verify API order. Assuming API sends Newest First.
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
            };
        });
    }, [filteredData, activeTab]);

    const maxValue = useMemo(() => {
        const max = Math.max(...chartData.map(d => d.value), 0);
        return max > 0 ? max * 1.2 : 100;
    }, [chartData]);

    // Default cities for filter (Simplified)
    const CITIES = [
        { code: 'TR', name: 'Türkiye' },
        { code: '34', name: 'İstanbul' },
        { code: '06', name: 'Ankara' },
        { code: '35', name: 'İzmir' },
        { code: '07', name: 'Antalya' },
        { code: '16', name: 'Bursa' },
    ];

    const renderChart = () => (
        <View style={{ alignItems: 'center' }}>
            <LineChart
                areaChart
                data={chartData}
                height={SCREEN_HEIGHT * 0.50}
                width={SCREEN_WIDTH - 120}
                spacing={(SCREEN_WIDTH - 120) / (chartData.length + 1)}
                initialSpacing={20}
                color={activeTab === 'PRIMARY' ? "#3b82f6" : "#22c55e"}
                startFillColor={activeTab === 'PRIMARY' ? "#3b82f6" : "#22c55e"}
                startOpacity={0.2}
                endOpacity={0.05}
                thickness={3}
                hideRules
                hideYAxisText={false}
                yAxisTextStyle={{ color: '#64748b', fontSize: 10 }}
                xAxisLabelTextStyle={{ color: 'gray', fontSize: 10, width: 40, textAlign: 'center' }}
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
                        const item = items[0];
                        return (
                            <View style={{
                                height: 60,
                                width: 100,
                                backgroundColor: '#1e293b',
                                borderRadius: 8,
                                justifyContent: 'center',
                                paddingLeft: 12,
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.1)'
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

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            statusBarTranslucent={true}
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-[#0B1121] px-5 pt-6 justify-between pb-6">

                {/* Header */}
                <View className="flex-row justify-between items-center mb-2">
                    <View className="flex-row items-center gap-4">
                        <Text className="text-white text-xl font-bold">{title}</Text>

                        {/* Conditional Secondary Tab (e.g. for Permits) */}
                        {data.length > 0 && (data[0].avg_m2 !== undefined) && (
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
                        {filterType === 'AGGREGATION' && (
                            <View className="flex-row gap-2">
                                {/* Period Selector */}
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

                                {/* City Selector (Simple Dropdown Trigger) - In real app, might need a modal or picker. Using a simple cycler or hardcoded list for now? 
                                    Better: A small horizontal list or modal. For simplicity in landscape: 
                                    Just hardcode top cities in a horizontal scroll or dropdown. 
                                */}
                                {showCityFilter && (
                                    <View className="flex-row bg-slate-900 p-1 rounded-lg items-center">
                                        {/* Simple Cyclic Toggle or List? Let's render a few buttons */}
                                        {CITIES.map(c => (
                                            <TouchableOpacity
                                                key={c.code}
                                                onPress={() => onCityChange && onCityChange(c.code)}
                                                className={`px-2 py-1 rounded-md ${selectedCity === c.code ? 'bg-slate-700 border border-slate-600' : ''}`}
                                            >
                                                <Text className={`text-[10px] ${selectedCity === c.code ? 'text-white font-bold' : 'text-slate-500'}`}>
                                                    {c.code === 'TR' ? 'TR' : c.name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
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
                        {['6M', '1Y', 'ALL'].map((f) => (
                            <TouchableOpacity
                                key={f}
                                onPress={() => setTimeFilter(f as any)}
                                disabled={!isPremium && isAuthenticated}
                                className={`px-4 py-2 rounded-lg border ${timeFilter === f ? 'bg-blue-600 border-blue-500' : 'bg-slate-800 border-white/10'} ${(!isPremium) ? 'opacity-30' : ''}`}
                            >
                                <Text className={`${timeFilter === f ? 'text-white' : 'text-slate-400'} font-bold text-xs`}>
                                    {f === 'ALL' ? 'Tümü 👑' : f === '6M' ? '6 Ay' : '1 Yıl'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>
        </Modal>
    );
}
