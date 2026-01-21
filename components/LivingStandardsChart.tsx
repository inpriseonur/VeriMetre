
import { ViewLivingStandards } from '@/types/database';
import React, { useMemo } from 'react';
import { Dimensions, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

const { width } = Dimensions.get('window');

interface LivingStandardsChartProps {
    data: ViewLivingStandards[];
    loading?: boolean;
}

export default function LivingStandardsChart({ data, loading }: LivingStandardsChartProps) {

    // Process Data
    const processedData = useMemo(() => {
        if (!data || data.length === 0) return { minWageLine: [], hungerLine: [], latest: null };

        // 1. Sort by Date Ascending (Old -> New) for Chart Logic
        const sorted = [...data].sort((a, b) => new Date(a.reference_date).getTime() - new Date(b.reference_date).getTime());

        // 2. Take last 13 months for readability
        const recentData = sorted.slice(-13);

        const minWageLine = recentData.map(d => ({
            value: d.current_min_wage,
            label: new Date(d.reference_date).toLocaleString('tr-TR', { month: 'short' }),
            dataPointText: '',
            date: d.reference_date,
            // Step Chart removed for stability
        }));

        const hungerLine = recentData.map(d => ({
            value: d.hunger_threshold,
            label: new Date(d.reference_date).toLocaleString('tr-TR', { month: 'short' }),
            dataPointText: '',
            date: d.reference_date
        }));

        const allValues = [...minWageLine.map(d => d.value), ...hungerLine.map(d => d.value)];
        const maxVal = Math.max(...allValues, 0);

        // Round up to nearest 10,000 for clean steps (e.g., 32,000 -> 40,000)
        const stepValue = 10000;
        const noOfSections = Math.ceil(maxVal / stepValue) || 4;
        const maxValue = noOfSections * stepValue;

        return {
            minWageLine,
            hungerLine,
            latest: sorted[sorted.length - 1],
            maxValue,
            noOfSections
        };
    }, [data]);

    const { latest, maxValue, noOfSections } = processedData;

    // Dynamic Summary Logic
    const summary = useMemo(() => {
        if (!latest) return null;
        const diff = latest.hunger_threshold - latest.current_min_wage;
        const isDanger = diff > 0;

        return {
            isDanger,
            message: isDanger
                ? `⚠️ Açlık sınırı, asgari ücretin ${diff.toLocaleString('tr-TR')} ₺ üzerinde!`
                : `✅ Asgari ücret, açlık sınırının üzerinde.`,
            diffVal: Math.abs(diff)
        };
    }, [latest]);

    // Tooltip Config
    const pointerConfig = {
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
        pointerLabelComponent: (items: any[]) => {
            const item = items[0] || {};
            const item2 = items[1] || {};

            // Identify which item is which (order matters in LineChart props)
            // We'll assume Line 1 is Min Wage, Line 2 is Hunger
            const wageVal = item.value;
            const hungerVal = item2.value;

            return (
                <View className="bg-slate-800 p-3 rounded-lg border border-slate-600 w-40 items-center justify-center opacity-95 ml-10">
                    <Text className="text-white text-xs font-bold mb-2 text-center">
                        {item.label || ''}
                    </Text>

                    <View className="flex-row items-center w-full justify-between mb-1">
                        <View className="flex-row items-center">
                            <View className="w-2 h-2 rounded-full bg-[#FF5252] mr-1" />
                            <Text className="text-slate-300 text-[10px]">Açlık:</Text>
                        </View>
                        <Text className="text-white text-[10px] font-bold">₺{Number(hungerVal).toLocaleString('tr-TR')}</Text>
                    </View>

                    <View className="flex-row items-center w-full justify-between">
                        <View className="flex-row items-center">
                            <View className="w-2 h-2 rounded-full bg-[#4CAF50] mr-1" />
                            <Text className="text-slate-300 text-[10px]">Maaş:</Text>
                        </View>
                        <Text className="text-white text-[10px] font-bold">₺{Number(wageVal).toLocaleString('tr-TR')}</Text>
                    </View>
                </View>
            );
        },
    };

    if (loading || processedData.minWageLine.length === 0) {
        return (
            <View className="bg-slate-800 rounded-2xl p-4 h-64 justify-center items-center border border-slate-700">
                <Text className="text-slate-500">Yükleniyor...</Text>
            </View>
        );
    }

    return (
        <View className="bg-slate-800 rounded-2xl p-4 shadow-sm shadow-black border border-slate-700 w-full mt-6">
            <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white text-lg font-semibold">Asgari Ücret vs Açlık Sınırı</Text>
            </View>

            {/* Chart */}
            <View className="overflow-hidden -ml-4">
                <LineChart
                    data={processedData.minWageLine} // Line 1: Min Wage (Green)
                    data2={processedData.hungerLine} // Line 2: Hunger (Red)

                    color1="#4CAF50"
                    color2="#FF5252"
                    thickness1={3}
                    thickness2={3}

                    // CRASH FIX: Removed stepChart1={true}
                    // It seems to be the cause of the native crash on Android in this version.

                    // Hunger Line has Area Fill
                    areaChart2={true}
                    startFillColor2="rgba(255, 82, 82, 0.2)"
                    endFillColor2="rgba(255, 82, 82, 0.05)"
                    startOpacity2={0.2}
                    endOpacity2={0.05}

                    // Dynamic Y-Axis
                    maxValue={maxValue}
                    noOfSections={noOfSections}
                    formatYLabel={(label) => {
                        const val = parseInt(label);
                        if (val === 0) return '0';
                        if (val >= 1000) return (val / 1000).toFixed(0) + 'k';
                        return val.toString();
                    }}

                    // Interaction
                    pointerConfig={pointerConfig}

                    hideDataPoints={false}
                    dataPointsColor1="#4CAF50"
                    dataPointsColor2="#FF5252"
                    dataPointsRadius={3}

                    initialSpacing={10}
                    spacing={40}
                    endSpacing={10}
                    scrollToEnd={true}

                    yAxisTextStyle={{ color: '#94a3b8', fontSize: 10 }}
                    xAxisLabelTextStyle={{ color: '#94a3b8', fontSize: 10 }}
                    rulesColor="#334155"
                    rulesType="solid"
                    hideRules={false}
                    yAxisColor="transparent"
                    xAxisColor="transparent"
                    height={220}
                    width={350}
                    curved={false}
                    isAnimated={false}
                />
            </View>

            {/* Dynamic Summary Footer */}
            {summary && (
                <View className={`mt-4 p-3 rounded-lg border ${summary.isDanger ? 'bg-red-900/20 border-red-800' : 'bg-green-900/20 border-green-800'}`}>
                    <Text className={`text-sm font-medium text-center ${summary.isDanger ? 'text-red-400' : 'text-green-400'}`}>
                        {summary.message}
                    </Text>
                </View>
            )}
        </View>
    );
}
