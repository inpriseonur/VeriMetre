
import { ViewInflationCalculated } from '@/types/database';
import React, { useMemo, useState } from 'react';
import { Dimensions, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

const { width } = Dimensions.get('window');

interface InflationChartProps {
    data: ViewInflationCalculated[];
    loading?: boolean;
}

const SOURCES = {
    1: { name: 'ENAG', color: '#FF5252', width: 2 },
    2: { name: 'TÜİK', color: '#4CAF50', width: 4 }, // Thicker
    3: { name: 'İTO', color: '#2196F3', width: 2 },
};

export default function InflationChart({ data, loading }: InflationChartProps) {
    const [mode, setMode] = useState<'monthly' | 'yearly' | 'ytd'>('yearly');

    // Group and Transform Data
    const chartData = useMemo(() => {
        if (!data || data.length === 0) return { line1: [], line2: [], line3: [] };

        // 1. Get all unique dates
        const allDates = Array.from(new Set(data.map(d => d.reference_date)));

        // 2. Sort dates descending (New -> Old)
        const sortedDates = allDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

        // 3. Take latest 13 months (or N months)
        const latestDates = sortedDates.slice(0, 13);

        // 4. Reverse to get Chronological Order (Old -> New) for the X-Axis
        const timeline = latestDates.reverse();

        // 5. Build Lines aligned to this timeline
        const buildLine = (sourceId: number) => {
            return timeline.map(date => {
                const entry = data.find(d => d.source_id === sourceId && d.reference_date === date);
                if (entry) {
                    let val = 0;
                    if (mode === 'monthly') val = entry.monthly_rate;
                    else if (mode === 'yearly') val = entry.calculated_yearly_rate;
                    else if (mode === 'ytd') val = entry.calculated_ytd_rate || 0;

                    return {
                        value: val,
                        label: new Date(entry.reference_date).toLocaleString('tr-TR', { month: 'short' }),
                        dataPointText: '',
                        originalDate: entry.reference_date,
                        sourceName: SOURCES[sourceId as 1 | 2 | 3]?.name || '',
                        // Custom data point props for active points
                        customDataPoint: undefined
                    };
                }
                // If data missing for this date, provide null-like object or 0? 
                // LineChart needs a value. 0 is misleading. 
                // Ideally we filter these out if we want gaps, but for alignment index must match.
                // We'll return 0 but maybe hide the point.
                return {
                    value: 0,
                    label: new Date(date).toLocaleString('tr-TR', { month: 'short' }),
                    originalDate: date, // Ensure originalDate is present for index lookup
                    hideDataPoint: true
                };
            });
        };

        return {
            line1: buildLine(1), // ENAG
            line2: buildLine(2), // TUIK
            line3: buildLine(3), // ITO
        };
    }, [data, mode]);

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
        autoAdjustPointerLabelPosition: false, // Turn off auto adjust to use our manual logic strictly
        pointerLabelComponent: (items: any[]) => {
            // Find valid items from the pointer index
            const item0 = items[0] || {}; // Line 1 (ENAG)
            const item1 = items[1] || {}; // Line 2 (TUIK)
            const item2 = items[2] || {}; // Line 3 (ITO)

            // Find index to determine position (Left/Right check)
            // matching by originalDate which is unique per timeline point
            const currentDate = item0.originalDate || item1.originalDate || item2.originalDate;
            const index = chartData.line1.findIndex(d => d.originalDate === currentDate);
            const totalLength = chartData.line1.length;

            // If we are among the last 5 points, shift LEFT
            const isNearEnd = index !== -1 && index >= totalLength - 5;

            // Dynamic Style
            // Near End: Shifted LEFT (-140) to stay on screen.
            // Standard: Shifted RIGHT (+40) to separate from the dot.
            const containerStyle = isNearEnd ? { marginLeft: -140 } : { marginLeft: 40 };

            // Grab values if they exist at this index
            const val1 = item0.value;
            const val2 = item1.value;
            const val3 = item2.value;

            // Date label from first available item
            const dateLabel = item0.label || item1.label || item2.label || '';

            return (
                <View style={[containerStyle]} className="bg-slate-800 p-3 rounded-lg border border-slate-600 w-32 items-center justify-center opacity-95">
                    <Text className="text-white text-xs font-bold mb-2 text-center">{dateLabel}</Text>

                    {val1 !== undefined && (
                        <View className="flex-row items-center w-full justify-between mb-1">
                            <View className="w-2 h-2 rounded-full bg-[#FF5252] mr-1" />
                            <Text className="text-slate-300 text-[10px]">ENAG</Text>
                            <Text className="text-white text-[10px] font-bold">%{Number(val1).toFixed(2)}</Text>
                        </View>
                    )}

                    {val2 !== undefined && (
                        <View className="flex-row items-center w-full justify-between mb-1">
                            <View className="w-2 h-2 rounded-full bg-[#4CAF50] mr-1" />
                            <Text className="text-slate-300 text-[10px]">TÜİK</Text>
                            <Text className="text-white text-[10px] font-bold">%{Number(val2).toFixed(2)}</Text>
                        </View>
                    )}

                    {val3 !== undefined && (
                        <View className="flex-row items-center w-full justify-between">
                            <View className="w-2 h-2 rounded-full bg-[#2196F3] mr-1" />
                            <Text className="text-slate-300 text-[10px]">İTO</Text>
                            <Text className="text-white text-[10px] font-bold">%{Number(val3).toFixed(2)}</Text>
                        </View>
                    )}
                </View>
            );
        },
    };

    return (
        <View className="bg-[#151C2F] rounded-2xl p-4 border border-slate-800/50 w-full">
            {/* Header & Toggle */}
            <View className="flex-row items-center justify-between mb-6">
                <Text className="text-white text-lg font-bold">Enflasyon Trendi</Text>

                {/* Simple Segmented Control */}
                <View className="flex-row bg-slate-800 rounded-lg p-1">
                    <ToggleOption title="Aylık" isActive={mode === 'monthly'} onPress={() => setMode('monthly')} />
                    <ToggleOption title="Yıllık" isActive={mode === 'yearly'} onPress={() => setMode('yearly')} />
                    <ToggleOption title="Bu Yıl" isActive={mode === 'ytd'} onPress={() => setMode('ytd')} />
                </View>
            </View>

            {/* Legend */}
            <View className="flex-row justify-center space-x-4 mb-4">
                <LegendItem color={SOURCES[1].color} label="ENAG" />
                <LegendItem color={SOURCES[2].color} label="TÜİK" />
                <LegendItem color={SOURCES[3].color} label="İTO" />
            </View>

            {/* Chart */}
            <View className="overflow-hidden -ml-4">
                <LineChart
                    data={chartData.line1} // ENAG (Red)
                    data2={chartData.line2} // TUIK (Green)
                    data3={chartData.line3} // ITO (Blue)
                    color1={SOURCES[1].color}
                    color2={SOURCES[2].color}
                    color3={SOURCES[3].color}
                    thickness1={SOURCES[1].width}
                    thickness2={SOURCES[2].width}
                    thickness3={SOURCES[3].width}

                    // Interaction
                    pointerConfig={pointerConfig}

                    // Visuals
                    hideDataPoints={false}
                    dataPointsColor1={SOURCES[1].color}
                    dataPointsColor2={SOURCES[2].color}
                    dataPointsColor3={SOURCES[3].color}
                    dataPointsRadius={4}

                    // Remove Area Fill
                    areaChart1={false}

                    initialSpacing={10}
                    spacing={30} // Fit more points
                    endSpacing={10}
                    scrollToEnd={true} // Start at the end (newest data)
                    noOfSections={4}
                    yAxisTextStyle={{ color: '#94a3b8', fontSize: 10 }}
                    xAxisLabelTextStyle={{ color: '#94a3b8', fontSize: 10 }}
                    rulesColor="#334155"
                    rulesType="solid"
                    hideRules={false}
                    yAxisColor="transparent"
                    xAxisColor="transparent"
                    height={220}
                    width={350} // Fixed width
                    curved
                    isAnimated={false} // Disable animation to prevent glitches
                />
            </View>
        </View>
    );
}

function ToggleOption({ title, isActive, onPress }: { title: string, isActive: boolean, onPress: () => void }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            className={`px-3 py-1.5 rounded-md ${isActive ? 'bg-blue-600' : 'bg-transparent'}`}
        >
            <Text className={`text-xs font-bold ${isActive ? 'text-white' : 'text-slate-400'}`}>
                {title}
            </Text>
        </TouchableOpacity>
    );
}

function LegendItem({ color, label }: { color: string, label: string }) {
    return (
        <View className="flex-row items-center mr-3">
            <View style={{ backgroundColor: color }} className="w-2.5 h-2.5 rounded-full mr-1.5" />
            <Text className="text-slate-300 text-xs font-medium">{label}</Text>
        </View>
    );
}
