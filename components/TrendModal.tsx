import { CityItem, getActiveCities } from '@/lib/housingService';
import { BlurView } from 'expo-blur';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { Building2, Check, ChevronDown, LandPlot, Lock, Search, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, StatusBar as RNStatusBar, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

export interface TrendDataPoint {
    label: string;
    value: number;
    subValue?: number;
    date: string;
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
    filterType?: 'DATE_RANGE' | 'AGGREGATION';
    showCityFilter?: boolean;
    selectedCity?: string;
    onCityChange?: (city: string) => void;
    selectedPeriod?: 'monthly' | 'yearly';
    onPeriodChange?: (period: 'monthly' | 'yearly') => void;
    hideFilters?: boolean;
    availableTimeFilters?: ('1Y' | '3Y' | '7Y' | 'ALL')[];
}

export default function TrendModal(props: TrendModalProps) {
    const {
        visible, onClose, title, data, isPremium, isAuthenticated,
        onLogin, onUpgrade, filterType = 'DATE_RANGE',
        showCityFilter, selectedCity, onCityChange,
        selectedPeriod, onPeriodChange, hideFilters = false
    } = props;
    const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
    const [activeTab, setActiveTab] = useState<'PRIMARY' | 'SECONDARY'>('PRIMARY');
    const [timeFilter, setTimeFilter] = useState<'1Y' | '3Y' | '7Y' | 'ALL'>('1Y');

    // Default filters if not provided
    const defaultFilters: ('1Y' | '3Y' | 'ALL')[] = ['1Y', '3Y', 'ALL'];

    // Configurable time filters
    const availableFilters = props.availableTimeFilters || defaultFilters;

    // ... (City Filter State skipped, unchanged)
    const [cityList, setCityList] = useState<CityItem[]>([]);
    const [isCitySelectorVisible, setCitySelectorVisible] = useState(false);
    const [citySearchQuery, setCitySearchQuery] = useState('');

    // ... (City useEffects unchanged)
    useEffect(() => {
        if (showCityFilter) {
            getActiveCities().then(cities => {
                const hasTR = cities.find(c => c.city_code === 'TR');
                let list = cities;
                if (!hasTR) {
                    list = [{ city_code: 'TR', city_name: 'Türkiye Geneli' }, ...cities];
                } else {
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

    // Custom Close Handler to prevent flicker (Rotate THEN Close)
    const handleClose = async () => {
        try {
            // 1. Force Portrait immediately while Modal is still up
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
            RNStatusBar.setHidden(false, 'slide');

            // 2. Small delay to let the rotation animation/layout start behind the modal
            setTimeout(() => {
                onClose();
            }, 150);
        } catch (error) {
            console.warn('Close orientation error:', error);
            onClose();
        }
    };

    useEffect(() => {
        const manageOrientation = async () => {
            if (visible) {
                try {
                    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
                    RNStatusBar.setHidden(true, 'slide');
                } catch (error) {
                    console.warn('Orientation lock failed:', error);
                }
            }
            // We do NOT automatically unlock here for 'else' case if we want to control it via handleClose
            // BUT for safety (e.g. back button on Android handled by OS, or parent hiding it) we should keep it.
            // If handleClose runs, this effect will run again after visible->false, which is fine (idempotent).
            else {
                try {
                    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
                    RNStatusBar.setHidden(false, 'slide');
                } catch (error) {
                    console.warn('Orientation unlock failed:', error);
                }
            }
        };

        manageOrientation();

        return () => {
            const unlockOrientation = async () => {
                try {
                    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
                    RNStatusBar.setHidden(false, 'slide');
                } catch (error) {
                }
            };
            unlockOrientation();
        };
    }, [visible]);

    const filteredData = useMemo(() => {
        if (!data || data.length === 0) return [];
        let processedData = [...data];

        if (filterType === 'DATE_RANGE') {
            let months = processedData.length;
            if (timeFilter === '1Y') months = 12;
            if (timeFilter === '3Y') months = 36;
            if (timeFilter === '7Y') months = 84;
            processedData = processedData.slice(0, months).reverse();
        }
        return processedData;
    }, [data, timeFilter, filterType]);

    const chartData = useMemo(() => {
        const threshold = selectedPeriod === 'monthly' ? 12 : 3;
        return filteredData.map((d, index) => {
            let val = d.value;
            if (d.permit_count !== undefined && activeTab === 'PRIMARY') val = d.permit_count;
            if (d.avg_m2 !== undefined && activeTab === 'SECONDARY') val = d.avg_m2;

            return {
                value: val,
                label: index % Math.ceil(filteredData.length / 6) === 0 ? d.label : '',
                dataPointText: '',
                date: d.date || d.label,
                isNearRightEdge: index >= filteredData.length - threshold,
            };
        });
    }, [filteredData, activeTab, selectedPeriod]);

    const maxValue = useMemo(() => {
        const max = Math.max(...chartData.map(d => d.value), 0);
        return max > 0 ? max * 1.2 : 100;
    }, [chartData]);

    const pointerConfig = useMemo(() => ({
        pointerStripUptoDataPoint: true,
        pointerStripColor: 'rgba(255,255,255,0.2)',
        pointerStripWidth: 2,
        strokeDashArray: [5, 5],
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
                    transform: [{ translateX: isRightEdge ? -120 : 0 }]
                }}>
                    <Text style={{ color: 'lightgray', fontSize: 10, marginBottom: 2 }}>{item.date}</Text>
                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>
                        {item.value.toLocaleString('tr-TR')}
                    </Text>
                </View>
            );
        },
    }), []);

    const chartWidth = SCREEN_WIDTH - 80;
    // Locked state helper
    const isLocked = !isAuthenticated || !isPremium;

    const renderChart = () => (
        <View style={{ alignItems: 'center', width: '100%' }}>
            <LineChart
                areaChart
                data={chartData}
                height={SCREEN_HEIGHT * 0.55}
                width={chartWidth}
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
                pointerConfig={pointerConfig}
            />
        </View>
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            statusBarTranslucent={true}
            onRequestClose={handleClose}
            supportedOrientations={['portrait', 'landscape']}
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
                                        disabled={isLocked}
                                        className={`px-3 py-1 rounded-md ${selectedPeriod === 'monthly' ? 'bg-blue-600' : ''} ${isLocked ? 'opacity-50' : ''}`}
                                    >
                                        <Text className={`text-xs ${selectedPeriod === 'monthly' ? 'text-white font-bold' : 'text-slate-400'}`}>Aylık</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => onPeriodChange && onPeriodChange('yearly')}
                                        disabled={isLocked}
                                        className={`px-3 py-1 rounded-md ${selectedPeriod === 'yearly' ? 'bg-blue-600' : ''} ${isLocked ? 'opacity-50' : ''}`}
                                    >
                                        <Text className={`text-xs ${selectedPeriod === 'yearly' ? 'text-white font-bold' : 'text-slate-400'}`}>Yıllık</Text>
                                    </TouchableOpacity>
                                </View>

                                {showCityFilter && (
                                    <>
                                        <TouchableOpacity
                                            onPress={() => setCitySelectorVisible(true)}
                                            disabled={isLocked}
                                            className={`flex-row items-center bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg gap-2 ${isLocked ? 'opacity-50' : ''}`}
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
                                            supportedOrientations={['landscape', 'portrait']}
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

                    <TouchableOpacity onPress={handleClose} className="bg-slate-800 p-2 rounded-full">
                        <X size={24} color="#cbd5e1" />
                    </TouchableOpacity>
                </View>

                {/* Main Content */}
                <View className="flex-1 justify-center relative bg-slate-900/30 rounded-3xl border border-white/5 p-4 mb-4">
                    {renderChart()}

                    {/* Overlay Logic */}
                    {(isLocked) && (
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
                        {availableFilters.map((f: any) => (
                            <TouchableOpacity
                                key={f}
                                onPress={() => setTimeFilter(f as any)}
                                disabled={isLocked}
                                className={`px-4 py-2 rounded-lg border ${timeFilter === f ? 'bg-blue-600 border-blue-500' : 'bg-slate-800 border-white/10'} ${isLocked ? 'opacity-30' : ''}`}
                            >
                                <Text className={`${timeFilter === f ? 'text-white' : 'text-slate-400'} font-bold text-xs`}>
                                    {f === 'ALL' ? 'Tümü 👑' : f === '1Y' ? '1 Yıl' : f === '3Y' ? '3 Yıl' : '7 Yıl'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>
        </Modal>
    );
}
