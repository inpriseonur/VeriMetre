import { BlurView } from 'expo-blur';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Building2, LandPlot, Lock, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, StatusBar, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

export interface TrendDataPoint {
    period_label: string;
    permit_count: number;
    avg_m2: number;
    year_month: string;
}

interface TrendModalProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    data: TrendDataPoint[];
    isPremium: boolean;
    isAuthenticated: boolean;
    onLogin?: () => void;
    onUpgrade?: () => void;
}

export default function TrendModal({ visible, onClose, title, data, isPremium, isAuthenticated, onLogin, onUpgrade }: TrendModalProps) {
    const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
    const [activeTab, setActiveTab] = useState<'COUNT' | 'AVG_M2'>('COUNT');
    const [timeFilter, setTimeFilter] = useState<'6M' | '1Y' | 'ALL'>('1Y');

    // --- Orientation & Status Bar Logic ---
    useEffect(() => {
        // Lock to landscape and hide status bar when mounted
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        StatusBar.setHidden(true, 'slide');

        // Return to portrait and show status bar when unmounted
        return () => {
            ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
            StatusBar.setHidden(false, 'slide');
        };
    }, []);

    // --- Filter Logic ---
    const filteredData = useMemo(() => {
        if (!data || data.length === 0) return [];

        let months = data.length;
        if (timeFilter === '6M') months = 6;
        if (timeFilter === '1Y') months = 12;

        return data.slice(0, months).reverse(); // Assuming API returns newest first
    }, [data, timeFilter]);

    // --- Chart Data Preparation ---
    const chartData = useMemo(() => {
        return filteredData.map((d, index) => {
            const rawValue = activeTab === 'COUNT' ? d.permit_count : d.avg_m2;
            return {
                value: rawValue,
                label: index % 3 === 0 ? d.period_label : '', // Show label every 3 points to avoid clutter
                dataPointText: '',
                // Tooltip Custom Data
                date: d.period_label,
            };
        });
    }, [filteredData, activeTab]);

    const maxValue = useMemo(() => {
        return Math.max(...chartData.map(d => d.value)) * 1.2;
    }, [chartData]);


    const renderChart = () => (
        <View style={{ alignItems: 'center' }}>
            <LineChart
                areaChart
                data={chartData}
                height={SCREEN_HEIGHT * 0.55} // Use generic height based on screen
                width={SCREEN_WIDTH - 100} // Wider in landscape
                spacing={SCREEN_WIDTH / (chartData.length + 2)} // Dynamic spacing
                initialSpacing={20}
                color={activeTab === 'COUNT' ? "#3b82f6" : "#22c55e"}
                startFillColor={activeTab === 'COUNT' ? "#3b82f6" : "#22c55e"}
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
                                height: 90,
                                width: 100,
                                backgroundColor: '#1e293b',
                                borderRadius: 8,
                                justifyContent: 'center',
                                paddingLeft: 16,
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.1)'
                            }}>
                                <Text style={{ color: 'lightgray', fontSize: 12, marginBottom: 4 }}>{item.date}</Text>
                                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>
                                    {item.value.toLocaleString('tr-TR')}
                                    {activeTab === 'AVG_M2' ? ' m²' : ''}
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

                {/* Header - Compact for Landscape */}
                <View className="flex-row justify-between items-center mb-2">
                    <View className="flex-row items-center gap-4">
                        <Text className="text-white text-xl font-bold">{title}</Text>

                        {/* Tab Switcher - More compact */}
                        <View className="flex-row bg-slate-900 p-1 rounded-xl">
                            <TouchableOpacity
                                className={`flex-row items-center justify-center py-1.5 px-3 rounded-lg gap-2 ${activeTab === 'COUNT' ? 'bg-slate-700' : ''}`}
                                onPress={() => setActiveTab('COUNT')}
                            >
                                <Building2 size={14} color={activeTab === 'COUNT' ? 'white' : '#64748b'} />
                                <Text className={`${activeTab === 'COUNT' ? 'text-white font-bold' : 'text-slate-500 font-medium'} text-[10px]`}>
                                    Adet
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className={`flex-row items-center justify-center py-1.5 px-3 rounded-lg gap-2 ${activeTab === 'AVG_M2' ? 'bg-slate-700' : ''}`}
                                onPress={() => setActiveTab('AVG_M2')}
                            >
                                <LandPlot size={14} color={activeTab === 'AVG_M2' ? 'white' : '#64748b'} />
                                <Text className={`${activeTab === 'AVG_M2' ? 'text-white font-bold' : 'text-slate-500 font-medium'} text-[10px]`}>
                                    Ortalama m²
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity onPress={onClose} className="bg-slate-800 p-2 rounded-full">
                        <X size={24} color="#cbd5e1" />
                    </TouchableOpacity>
                </View>


                {/* Main Content Area */}
                <View className="flex-1 justify-center relative bg-slate-900/30 rounded-3xl border border-white/5 p-4 mb-4">

                    {/* The Chart (Always Rendered) */}
                    {renderChart()}

                    {/* Overlay Logic: Guest OR Free User */}
                    {(!isAuthenticated || !isPremium) && (
                        <BlurView
                            intensity={100}
                            tint="dark"
                            style={[StyleSheet.absoluteFill, {
                                borderRadius: 24,
                                justifyContent: 'center',
                                alignItems: 'center',
                                zIndex: 10,
                                overflow: 'hidden' // Ensure blur is contained
                            }]}
                        >
                            <View className="bg-black/60 p-6 rounded-2xl items-center border border-white/10 w-[60%]">
                                <View className="bg-yellow-500/20 p-4 rounded-full mb-4">
                                    <Lock size={32} color="#fbbf24" strokeWidth={2.5} />
                                </View>

                                {/* Content based on Auth Status */}
                                {!isAuthenticated ? (
                                    <>
                                        <Text className="text-white text-lg font-bold text-center mb-2">Analizleri Keşfedin</Text>
                                        <Text className="text-slate-300 text-center text-sm mb-6 leading-5">
                                            Bu veriye erişmek için lütfen giriş yapın.
                                        </Text>
                                        <TouchableOpacity
                                            onPress={onLogin}
                                            className="bg-yellow-500 w-full py-3 rounded-xl active:bg-yellow-600"
                                        >
                                            <Text className="text-black font-bold text-center">Giriş Yap / Kayıt Ol</Text>
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <>
                                        <Text className="text-white text-lg font-bold text-center mb-2">Trend Analizini Görüntüle</Text>
                                        <Text className="text-slate-300 text-center text-sm mb-6 leading-5">
                                            Konut piyasasının tarihsel değişimini ve m² trendlerini incelemek için Premium'a geçin.
                                        </Text>
                                        <TouchableOpacity
                                            onPress={onUpgrade}
                                            className="bg-yellow-500 w-full py-3 rounded-xl active:bg-yellow-600"
                                        >
                                            <Text className="text-black font-bold text-center">Premium'a Yükselt</Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                        </BlurView>
                    )}
                </View>

                {/* Time Filters - Bottom Bar */}
                <View className="flex-row justify-center gap-4">
                    {['6M', '1Y', 'ALL'].map((f) => (
                        <TouchableOpacity
                            key={f}
                            onPress={() => setTimeFilter(f as any)}
                            disabled={!isPremium && isAuthenticated} // Disable only if logged in but free. Guests also disabled by overlay.
                            className={`px-4 py-2 rounded-lg border ${timeFilter === f ? 'bg-blue-600 border-blue-500' : 'bg-slate-800 border-white/10'} ${(!isPremium) ? 'opacity-30' : ''}`}
                        >
                            <Text className={`${timeFilter === f ? 'text-white' : 'text-slate-400'} font-bold text-xs`}>
                                {f === 'ALL' ? 'Tümü 👑' : f === '6M' ? '6 Ay' : '1 Yıl'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

            </View>
        </Modal>
    );
}
