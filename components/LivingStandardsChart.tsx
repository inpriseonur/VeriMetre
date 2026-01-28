import { ViewLivingStandards } from '@/types/database';
import { MaterialIcons } from '@expo/vector-icons';
import { Coins, DollarSign, TrendingUp } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Dimensions, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LivingStandardsChartProps {
    data: ViewLivingStandards[];
    loading?: boolean;
    dataMode?: 'MIN_WAGE' | 'USER_SALARY';
    userPurchasingPowerData?: any[];
    isPremium?: boolean;
    onUnlockPress?: () => void;
    onAddSalaryPress?: () => void;
}

type TabType = 'TL' | 'USD' | 'ALTIN';

export const LivingStandardsChart: React.FC<LivingStandardsChartProps> = ({
    data,
    loading,
    dataMode = 'MIN_WAGE',
    userPurchasingPowerData = [],
    isPremium = false,
    onUnlockPress,
    onAddSalaryPress
}) => {
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
    const RIGHT_MARGIN = 30;    // Increased to 30 to fix overflow (was 10)
    const TOTAL_AVAILABLE_WIDTH = SCREEN_WIDTH - Y_AXIS_LABEL_WIDTH - RIGHT_MARGIN;
    const INITIAL_SPACING = 20; // Increased to 35 to align start point with 'Şub' (was 25)
    const END_SPACING = 15;     // User requested balanced padding (15)

    // Determine which dataset to use
    const sourceData = dataMode === 'USER_SALARY' ? userPurchasingPowerData : data;

    // Safety check for empty user data
    if (dataMode === 'USER_SALARY' && sourceData.length === 0) {
        return (
            <View className="bg-[#151C2F] rounded-2xl p-6 border border-white/5 mb-6 items-center py-12 justify-center">
                <View className="bg-slate-800/50 p-4 rounded-full mb-4">
                    <Coins size={32} color="#94a3b8" />
                </View>
                <Text className="text-white font-bold text-lg mb-2">Maaş Analizi</Text>
                <Text className="text-slate-400 text-center mb-6 text-sm px-4">
                    Alım gücünüzün nasıl değiştiğini görmek için lütfen güncel maaş bilginizi girin.
                </Text>
                {onAddSalaryPress && (
                    <TouchableOpacity
                        onPress={onAddSalaryPress}
                        className="bg-[#F97316] px-6 py-3 rounded-lg flex-row items-center gap-2"
                    >
                        <MaterialIcons name="add" size={16} color="white" />
                        <Text className="text-white font-bold text-sm">Maaş Ekle</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    }

    // Limit to last 12 months (or less if user data is short)
    // 1. Sort Ascending (Oldest -> Newest) to be absolutely sure
    const sortedData = [...sourceData].sort((a, b) => new Date(a.reference_date).getTime() - new Date(b.reference_date).getTime());

    // 2. Take last 12 (which represents the most recent 12 months given the sort)
    // Filter out historical months with no salary data if in USER_SALARY mode
    const filteredData = sortedData.filter(d => dataMode === 'MIN_WAGE' || (d.user_salary && d.user_salary > 0));

    // 2. Take last 12 (or fewer if filtered)
    const visibleData = filteredData.slice(-13);

    const calculateSpacing = (dataCount: number) => {
        if (dataCount <= 1) return 0;
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

    visibleData.forEach((item, index) => {
        // Fix: Use correct date field depending on type
        const dateStr = item.reference_date;
        const label = getLabel(dateStr);

        // Teaser Logic: If NOT premium and in User Salary mode, only show first 2 months clearly
        // Actually, we want to SHOW the line but overlay blur.
        // But Gifted Charts doesn't easily blur segment by segment.
        // Strategy: We will render the full chart, and overlay a BlurView on the right side if needed.

        if (activeTab === 'TL') {
            if (dataMode === 'MIN_WAGE') {
                chartData1.push({
                    value: item.current_min_wage,
                    label: label,
                    dataPointText: '',
                    textColor: '#fff',
                    textShiftY: -10,
                    textFontSize: 10,
                });
                chartData2.push({
                    value: item.hunger_threshold,
                    label: label,
                });
                maxValue = Math.max(maxValue, item.current_min_wage, item.hunger_threshold);
            } else {
                // USER SALARY MODE
                chartData1.push({
                    value: item.user_salary,
                    label: label,
                    dataPointText: '',
                    textColor: '#fff',
                    textShiftY: -10,
                    textFontSize: 10,
                });
                // We might want to compare with Hunger Threshold still? 
                // Or maybe inflation adjusted salary?
                // The prompt says "Açlık sınırı, dolar ve altın karşısındaki alım güçleri"
                // So line 2 logic implies comparing to hunger threshold is still relevant in TL tab.
                // Assuming `view_living_standards` data is merged or we have hunger data available.
                // NOTE: `userPurchasingPowerData` RPC might NOT return hunger_threshold directly.
                // If it's pure RPC result, we might need to join/map.
                // For MVP, let's plot just Salary or assume the RPC result includes relevant comparison if modeled effectively.
                // If RPC result doesn't have hunger, we skip Line 2 or fetch it.
                // Assuming we just show Salary for now or use `inflation_rate` elsewhere.
                if (item.hunger_threshold) { // If provided in joined data
                    chartData2.push({
                        value: item.hunger_threshold,
                        label: label,
                    });
                    maxValue = Math.max(maxValue, item.user_salary, item.hunger_threshold);
                } else {
                    maxValue = Math.max(maxValue, item.user_salary);
                }
            }
        }
        else if (activeTab === 'USD') {
            const val = dataMode === 'MIN_WAGE' ? item.min_wage_usd_real : item.user_usd_equivalent;
            if (val) {
                chartData1.push({
                    value: val,
                    label: label,
                    dataPointLabelComponent: () => null,
                });
                maxValue = Math.max(maxValue, val);
            }
            if (dataMode === 'MIN_WAGE') yAxisOffset = 300;
            // Adjustable offset for user salary?
        }
        else if (activeTab === 'ALTIN') {
            const val = dataMode === 'MIN_WAGE' ? item.min_wage_gold_real : item.user_gold_equivalent;
            if (val) {
                chartData1.push({
                    value: val,
                    label: label,
                    dataPointLabelComponent: () => null,
                });
                maxValue = Math.max(maxValue, val);
            }
        }
    });

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

    const spacing = calculateSpacing(visibleData.length);

    // Blur Logic
    const shouldBlur = dataMode === 'USER_SALARY' && !isPremium && visibleData.length > 2;

    return (
        <View className="bg-[#151C2F] rounded-2xl p-4 border border-white/5 mb-6">
            {/* Header / Tabs */}
            <View className="bg-slate-900/50 p-1 rounded-xl flex-row mb-6">
                <TabButton id="TL" label="TL" icon={TrendingUp} color="#3b82f6" />
                <TabButton id="USD" label="USD" icon={DollarSign} color="#22c55e" />
                <TabButton id="ALTIN" label="ALTIN" icon={Coins} color="#f1c40f" />
            </View>

            {/* Chart Area */}
            <View style={{ width: SCREEN_WIDTH, flexDirection: 'row', paddingRight: RIGHT_MARGIN, marginLeft: -16 }}>
                <LineChart
                    key={`${activeTab}-${dataMode}`} // Force re-render on mode switch
                    data={chartData1}
                    data2={chartData2.length > 0 ? chartData2 : undefined}
                    height={220}
                    width={TOTAL_AVAILABLE_WIDTH}
                    yAxisLabelWidth={Y_AXIS_LABEL_WIDTH}

                    spacing={spacing}
                    initialSpacing={INITIAL_SPACING}
                    endSpacing={END_SPACING}
                    color1={activeTab === 'USD' ? '#22c55e' : activeTab === 'ALTIN' ? '#f1c40f' : '#3b82f6'}
                    color2="#ef4444"
                    textColor1="white"
                    textColor2="white"
                    dataPointsColor1={activeTab === 'USD' ? '#22c55e' : activeTab === 'ALTIN' ? '#f1c40f' : '#3b82f6'}
                    dataPointsColor2="#ef4444"
                    startFillColor1={activeTab === 'USD' ? '#22c55e' : activeTab === 'ALTIN' ? '#f1c40f' : '#3b82f6'}
                    startFillColor2="#ef4444"
                    startOpacity={0.1}
                    endOpacity={0.0}
                    thickness={3}
                    hideRules
                    yAxisThickness={0}
                    xAxisThickness={0}
                    yAxisTextStyle={{ color: '#64748b', fontSize: 10 }}
                    xAxisLabelTextStyle={{ color: 'gray', fontSize: 9, width: 40, textAlign: 'center', marginLeft: -20 }}
                    noOfSections={3}
                    maxValue={maxValue * 1.2}
                    formatYLabel={(label) => parseFloat(label).toFixed(0)}
                    yAxisOffset={activeTab === 'USD' ? yAxisOffset : 0}
                    areaChart={activeTab !== 'TL'}
                    pointerConfig={{
                        pointerStripUptoDataPoint: true,
                        pointerStripColor: 'rgba(255,255,255,0.2)',
                        pointerStripWidth: 2,
                        strokeDashArray: [2, 5],
                        pointerColor: 'rgba(255,255,255,0.8)',
                        radius: 4,
                        pointerLabelWidth: 100,
                        pointerLabelHeight: 90,
                        pointerLabelComponent: (items: any) => {
                            const val1 = items[0]?.value;
                            const val2 = items[1]?.value;
                            return (
                                <View className="bg-slate-800 p-2 rounded-lg border border-white/10 shadow-xl ml-4">
                                    <Text className="text-slate-400 text-[10px] mb-1">{items[0]?.label}</Text>
                                    <Text className={`text-xs font-bold ${activeTab === 'USD' ? 'text-green-400' : activeTab === 'ALTIN' ? 'text-yellow-400' : 'text-blue-400'}`}>
                                        {activeTab === 'USD' ? `${val1?.toFixed(0)} $` :
                                            activeTab === 'ALTIN' ? `${val1?.toFixed(2)} gr` :
                                                `Maaş: ${val1?.toLocaleString('tr-TR')} ₺`}
                                    </Text>
                                    {val2 && <Text className="text-red-400 text-xs font-bold">Açlık: {val2?.toLocaleString('tr-TR')} ₺</Text>}
                                </View>
                            );
                        },
                    }}
                />
            </View>

            {/* Teaser Blur Overlay */}
            {shouldBlur && (
                <View
                    style={{
                        position: 'absolute',
                        right: 0,
                        top: 80, // Offset header
                        bottom: 40, // Offset legend
                        width: '75%', // Cover roughly March onwards (10/12 months)
                        backgroundColor: 'rgba(21, 28, 47, 0.85)', // Fallback / Base blur color
                        justifyContent: 'center',
                        alignItems: 'center',
                        backdropFilter: 'blur(10px)', // For web support if needed, or implement native blur
                        zIndex: 10
                    }}
                >
                    {/* For React Native proper blur, we'd need @react-native-community/blur or Expo BlurView. 
                         Using semi-transparent overlay for simple MVP compatibility. */}
                    <TouchableOpacity onPress={onUnlockPress} activeOpacity={0.8} className="items-center">
                        <View className="bg-slate-800 p-3 rounded-full border border-white/20 mb-2 shadow-lg">
                            {/* Lock Icon */}
                            <View className="w-6 h-6 items-center justify-center">
                                <Text style={{ fontSize: 20 }}>🔒</Text>
                            </View>
                        </View>
                        <Text className="text-white font-bold text-center px-4">Premium ile Kilidi Aç</Text>
                        <Text className="text-slate-400 text-[10px] text-center px-4 mt-1">Yıllık analizi görmek için yükseltin</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Legend / Info */}
            <View className="mt-4 flex-row justify-center gap-4">
                {activeTab === 'TL' && (
                    <>
                        <View className="flex-row items-center gap-2">
                            <View className="w-3 h-3 rounded-full bg-blue-500" />
                            <Text className="text-slate-400 text-[10px]">
                                {dataMode === 'MIN_WAGE' ? 'Net Asgari Ücret' : 'Maaşım'}
                            </Text>
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
                        <Text className="text-slate-400 text-[10px]">
                            {dataMode === 'MIN_WAGE' ? 'Asgari Ücret ($)' : 'Maaşım ($)'}
                        </Text>
                    </View>
                )}
                {activeTab === 'ALTIN' && (
                    <View className="flex-row items-center gap-2">
                        <View className="w-3 h-3 rounded-full bg-yellow-400" />
                        <Text className="text-slate-400 text-[10px]">
                            {dataMode === 'MIN_WAGE' ? 'Asgari Ücret (Altın)' : 'Maaşım (Altın)'}
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
};

