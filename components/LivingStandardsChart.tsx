import { ViewLivingStandards } from '@/types/database';
import { Coins, DollarSign, TrendingUp } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Dimensions, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LivingStandardsChartProps {
    data: ViewLivingStandards[];
    loading?: boolean;
}

type TabType = 'TL' | 'USD' | 'ALTIN';

export const LivingStandardsChart: React.FC<LivingStandardsChartProps> = ({ data, loading }) => {
    const [activeTab, setActiveTab] = useState<TabType>('TL');

    if (loading) {
        return (
            <View className="bg-[#151C2F] rounded-2xl p-4 border border-white/5 mb-6 min-h-[300px] items-center justify-center">
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text className="text-slate-400 mt-3 text-xs">Grafik yükleniyor...</Text>
            </View>
        );
    }

    if (!data || data.length === 0) return null;

    // --- Chart Settings (Final Mathematical Layout) ---
    const Y_AXIS_LABEL_WIDTH = 50;
    const RIGHT_MARGIN = 20;
    const TOTAL_AVAILABLE_WIDTH = SCREEN_WIDTH - Y_AXIS_LABEL_WIDTH - RIGHT_MARGIN;
    const INITIAL_SPACING = 20;
    const END_SPACING = 40; // Increased to allow space for the last label text

    const calculateSpacing = (dataCount: number) => {
        if (dataCount <= 1) return 0;
        // Formula: (Total Available Width - Start Spacing - End Spacing) / (Intervals)
        const netDrawingWidth = TOTAL_AVAILABLE_WIDTH - INITIAL_SPACING - END_SPACING;
        return netDrawingWidth / (dataCount - 1);
    };

    // --- Data Preparation ---
    const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

    const getLabel = (dateStr: string) => {
        const date = new Date(dateStr);
        return months[date.getMonth()];
    };

    let chartData1: any[] = []; // Main Line
    let chartData2: any[] = []; // Secondary Line (only for TL tab)
    let yAxisOffset = 0;
    let maxValue = 0;

    // Limit to last 12 months
    const visibleData = data.slice(-12);

    // Prepare data based on active tab
    visibleData.forEach(item => {
        const label = getLabel(item.reference_date);

        if (activeTab === 'TL') {
            // Line 1: Min Wage (Blue)
            chartData1.push({
                value: item.current_min_wage,
                label: label,
                dataPointText: '', // Too crowded if we show all
                textColor: '#fff',
                textShiftY: -10,
                textFontSize: 10,
            });
            // Line 2: Hunger Threshold (Red)
            chartData2.push({
                value: item.hunger_threshold,
                label: label,
            });
            maxValue = Math.max(maxValue, item.current_min_wage, item.hunger_threshold);
        }
        else if (activeTab === 'USD') {
            // Line: USD Real (Green)
            if (item.min_wage_usd_real) {
                chartData1.push({
                    value: item.min_wage_usd_real,
                    label: label,
                    dataPointLabelComponent: () => {
                        return null;
                    },
                });
                maxValue = Math.max(maxValue, item.min_wage_usd_real);
            }
            yAxisOffset = 300; // As requested
        }
        else if (activeTab === 'ALTIN') {
            // Line: Gold Real (Yellow)
            if (item.min_wage_gold_real) {
                chartData1.push({
                    value: item.min_wage_gold_real,
                    label: label,
                    dataPointLabelComponent: () => {
                        return null;
                    }
                });
                maxValue = Math.max(maxValue, item.min_wage_gold_real);
            }
        }
    });

    // --- Tab Button Component ---
    const TabButton = ({ id, label, icon: Icon, color }: { id: TabType, label: string, icon?: any, color: string }) => {
        const isActive = activeTab === id;
        return (
            <TouchableOpacity
                onPress={() => setActiveTab(id)}
                className={`flex-1 flex-row items-center justify-center py-2 px-1 rounded-lg border ${isActive ? `bg-[${color}]/10 border-[${color}]/50` : 'bg-transparent border-transparent'}`}
                style={isActive ? { backgroundColor: `${color}20`, borderColor: `${color}50` } : {}}
            >
                {Icon && <Icon size={12} color={isActive ? color : '#64748b'} style={{ marginRight: 4 }} />}
                <Text style={{ color: isActive ? color : '#64748b', fontSize: 11, fontWeight: isActive ? '700' : '500' }}>
                    {label}
                </Text>
            </TouchableOpacity>
        );
    };

    const spacing = calculateSpacing(chartData1.length);

    return (
        <View className="bg-[#151C2F] rounded-2xl p-4 border border-white/5 mb-6">
            {/* Header / Tabs */}
            <View className="bg-slate-900/50 p-1 rounded-xl flex-row mb-6">
                <TabButton id="TL" label="TL (Geçim)" icon={TrendingUp} color="#3b82f6" />
                <TabButton id="USD" label="USD (Alım Gücü)" icon={DollarSign} color="#22c55e" />
                <TabButton id="ALTIN" label="ALTIN (Değer)" icon={Coins} color="#f1c40f" />
            </View>

            {/* Chart Area */}
            <View style={{ width: SCREEN_WIDTH, flexDirection: 'row', paddingRight: RIGHT_MARGIN, marginLeft: -16 }}>
                {activeTab === 'TL' && (
                    <LineChart
                        key={activeTab}
                        data={chartData1}
                        data2={chartData2}
                        height={220}
                        width={TOTAL_AVAILABLE_WIDTH}
                        yAxisLabelWidth={Y_AXIS_LABEL_WIDTH}
                        scrollEnabled={false}
                        spacing={spacing}
                        initialSpacing={INITIAL_SPACING}
                        endSpacing={END_SPACING}
                        color1="#3b82f6" // Wage
                        color2="#ef4444" // Hunger
                        textColor1="white"
                        textColor2="white"
                        dataPointsColor1="#3b82f6"
                        dataPointsColor2="#ef4444"
                        startFillColor1="#3b82f6"
                        startFillColor2="#ef4444"
                        startOpacity={0.1}
                        endOpacity={0.0}
                        thickness={3}
                        hideRules
                        yAxisThickness={0}
                        xAxisThickness={0}
                        yAxisTextStyle={{ color: '#64748b', fontSize: 10 }}
                        xAxisLabelTextStyle={{ color: 'gray', fontSize: 9, width: 80, textAlign: 'center', marginLeft: -10 }}
                        noOfSections={4}
                        maxValue={maxValue * 1.1} // +10% padding
                        pointerConfig={{
                            pointerStripUptoDataPoint: true,
                            pointerStripColor: 'rgba(255,255,255,0.2)',
                            pointerStripWidth: 2,
                            strokeDashArray: [2, 5],
                            pointerColor: 'rgba(255,255,255,0.8)',
                            radius: 4,
                            pointerLabelWidth: 100,
                            pointerLabelHeight: 120,
                            pointerLabelComponent: (items: any) => {
                                const wage = items[0]?.value;
                                const hunger = items[1]?.value;
                                return (
                                    <View className="bg-slate-800 p-2 rounded-lg border border-white/10 shadow-xl ml-4">
                                        <Text className="text-slate-400 text-[10px] mb-1">{items[0]?.label}</Text>
                                        <Text className="text-blue-400 text-xs font-bold mb-0.5">Maaş: {wage?.toLocaleString('tr-TR')} ₺</Text>
                                        {hunger && <Text className="text-red-400 text-xs font-bold">Açlık: {hunger?.toLocaleString('tr-TR')} ₺</Text>}
                                    </View>
                                );
                            },
                        }}
                    />
                )}

                {activeTab === 'USD' && (
                    <LineChart
                        key={activeTab}
                        data={chartData1}
                        height={220}
                        width={TOTAL_AVAILABLE_WIDTH}
                        yAxisLabelWidth={Y_AXIS_LABEL_WIDTH}
                        scrollEnabled={false}
                        spacing={spacing}
                        initialSpacing={INITIAL_SPACING}
                        endSpacing={END_SPACING}
                        color="#22c55e"
                        areaChart
                        startFillColor="#22c55e"
                        startOpacity={0.2}
                        endOpacity={0.0}
                        thickness={3}
                        isAnimated
                        hideRules
                        yAxisThickness={0}
                        xAxisThickness={0}
                        yAxisTextStyle={{ color: '#64748b', fontSize: 10 }}
                        xAxisLabelTextStyle={{ color: 'gray', fontSize: 9, width: 80, textAlign: 'center', marginLeft: -10 }}
                        noOfSections={4}
                        yAxisOffset={yAxisOffset}
                        maxValue={maxValue * 1.05}
                        pointerConfig={{
                            pointerStripUptoDataPoint: true,
                            pointerStripColor: 'rgba(255,255,255,0.2)',
                            pointerStripWidth: 2,
                            strokeDashArray: [2, 5],
                            pointerColor: '#22c55e',
                            radius: 4,
                            pointerLabelWidth: 100,
                            pointerLabelHeight: 60,
                            pointerLabelComponent: (items: any) => {
                                return (
                                    <View className="bg-slate-800 p-2 rounded-lg border border-white/10 shadow-xl ml-4">
                                        <Text className="text-slate-400 text-[10px] mb-1">{items[0]?.label}</Text>
                                        <Text className="text-green-400 text-xs font-bold">{items[0]?.value?.toFixed(0)} $</Text>
                                    </View>
                                );
                            },
                        }}
                    />
                )}

                {activeTab === 'ALTIN' && (
                    <LineChart
                        key={activeTab}
                        data={chartData1}
                        height={220}
                        width={TOTAL_AVAILABLE_WIDTH}
                        yAxisLabelWidth={Y_AXIS_LABEL_WIDTH}
                        scrollEnabled={false}
                        spacing={spacing}
                        initialSpacing={INITIAL_SPACING}
                        endSpacing={END_SPACING}
                        color="#f1c40f"
                        areaChart
                        startFillColor="#f1c40f"
                        startOpacity={0.2}
                        endOpacity={0.0}
                        thickness={3}
                        isAnimated
                        hideRules
                        yAxisThickness={0}
                        xAxisThickness={0}
                        yAxisTextStyle={{ color: '#64748b', fontSize: 10 }}
                        xAxisLabelTextStyle={{ color: 'gray', fontSize: 9, width: 80, textAlign: 'center', marginLeft: -10 }}
                        noOfSections={4}
                        pointerConfig={{
                            pointerStripUptoDataPoint: true,
                            pointerStripColor: 'rgba(255,255,255,0.2)',
                            pointerStripWidth: 2,
                            strokeDashArray: [2, 5],
                            pointerColor: '#f1c40f',
                            radius: 4,
                            pointerLabelWidth: 100,
                            pointerLabelHeight: 60,
                            pointerLabelComponent: (items: any) => {
                                return (
                                    <View className="bg-slate-800 p-2 rounded-lg border border-white/10 shadow-xl ml-4">
                                        <Text className="text-slate-400 text-[10px] mb-1">{items[0]?.label}</Text>
                                        <Text className="text-yellow-400 text-xs font-bold">{items[0]?.value?.toFixed(2)} gr</Text>
                                    </View>
                                );
                            },
                        }}
                    />
                )}
            </View>

            {/* Legend / Info */}
            <View className="mt-4 flex-row justify-center gap-4">
                {activeTab === 'TL' && (
                    <>
                        <View className="flex-row items-center gap-2">
                            <View className="w-3 h-3 rounded-full bg-blue-500" />
                            <Text className="text-slate-400 text-[10px]">Net Asgari Ücret</Text>
                        </View>
                        <View className="flex-row items-center gap-2">
                            <View className="w-3 h-3 rounded-full bg-red-500" />
                            <Text className="text-slate-400 text-[10px]">Açlık Sınırı</Text>
                        </View>
                    </>
                )}
                {activeTab === 'USD' && (
                    <View className="flex-row items-center gap-2">
                        <View className="w-3 h-3 rounded-full bg-green-500" />
                        <Text className="text-slate-400 text-[10px]">Asgari Ücret (USD Karşılığı)</Text>
                    </View>
                )}
                {activeTab === 'ALTIN' && (
                    <View className="flex-row items-center gap-2">
                        <View className="w-3 h-3 rounded-full bg-yellow-400" />
                        <Text className="text-slate-400 text-[10px]">Asgari Ücret (Gram Altın Karşılığı)</Text>
                    </View>
                )}
            </View>
        </View>
    );
};
