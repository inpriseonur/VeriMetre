import { fetchMarketData, MarketItem } from '@/lib/marketService';
import { ArrowLeftRight, Banknote, BarChart3, Bitcoin, Calculator, Coins, DollarSign, Euro, TrendingDown, TrendingUp } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function MarketsScreen() {
    const [marketData, setMarketData] = useState<MarketItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [bottomPadding, setBottomPadding] = useState(40);

    // Converter State
    const [amount, setAmount] = useState('1');
    const [selectedCurrencyId, setSelectedCurrencyId] = useState<number | null>(null);

    // Header Time logic
    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    useEffect(() => {
        loadData(); // Initial load

        // Auto-refresh every 60 seconds
        const interval = setInterval(() => {
            loadData(true); // Silent refresh
        }, 60000);

        // Keyboard listeners for dynamic padding
        const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
            setBottomPadding(280); // Increase space when keyboard opens
            // Scroll to end to ensure input is visible
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
        });
        const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
            setBottomPadding(40); // Reset space when keyboard closes (Smaller value)
        });

        return () => {
            clearInterval(interval);
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    const loadData = async (silent = false) => {
        if (!silent) setLoading(true);

        // If silent, we don't show global spinner, maybe small indicator? 
        // For now user requested "sessizce", so no UI change

        const data = await fetchMarketData();
        if (data) {
            setMarketData(data);
            // Default selected currency for converter (First available that is NOT BIST)
            if (!selectedCurrencyId) {
                const defaultCurr = data.find(item => item.id !== 4); // Assuming 4 is BIST
                if (defaultCurr) setSelectedCurrencyId(defaultCurr.id);
            }
        }
        if (!silent) setLoading(false);
        setRefreshing(false);
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    // Derived Data
    const heroItems = marketData.filter(item => [1, 2, 3, 4].includes(item.id)); // Core items
    const gridItems = marketData; // Show all in grid? Or remaining? User said "All instruments"

    // Component: Hero Card (Sparkline)
    // Helper render function for Hero Card (it doesn't use state, so it's safe to be here or outside, but purely presentational is fine)
    const renderHeroCard = (item: MarketItem) => {
        const isUp = item.change_rate >= 0;
        const color = isUp ? '#22c55e' : '#ef4444';
        const bgColor = isUp ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)';

        const chartData = (item.chart_data && item.chart_data.length > 0)
            ? item.chart_data
            : [{ value: item.price }, { value: item.price }];

        return (
            <View key={item.id} className="w-48 h-32 bg-[#151C2F] rounded-2xl border border-white/5 mr-4 p-3 justify-between overflow-hidden relative">
                <View className="absolute right-0 top-0 bottom-0 w-24 opacity-20" style={{ backgroundColor: bgColor }} />
                <View className="flex-row justify-between items-start z-10">
                    <Text className="text-white font-bold text-lg">{item.name}</Text>
                    <View className={`flex-row items-center gap-1 px-1.5 py-0.5 rounded ${isUp ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                        {isUp ? <TrendingUp size={10} color={color} /> : <TrendingDown size={10} color={color} />}
                        <Text className={`text-[10px] font-bold ${isUp ? 'text-green-500' : 'text-red-500'}`}>%{Math.abs(item.change_rate).toFixed(2)}</Text>
                    </View>
                </View>
                <View className="absolute bottom-0 left-0 right-0 h-16 opacity-80" pointerEvents="none">
                    <LineChart
                        data={chartData}
                        height={50}
                        width={180}
                        hideDataPoints
                        hideAxesAndRules
                        hideYAxisText
                        hideRules
                        thickness={2}
                        color={color}
                        startFillColor={color}
                        endFillColor={color}
                        startOpacity={0.2}
                        endOpacity={0.0}
                        areaChart
                        curved
                        adjustToWidth
                    />
                </View>
                <View className="z-10 mt-auto">
                    <Text className="text-white text-xl font-bold tracking-tight">
                        {item.price.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                    </Text>
                </View>
            </View>
        );
    };

    // Calculate Converter Result
    const getConverterResult = () => {
        if (!selectedCurrencyId || marketData.length === 0) return '0';
        const selectedItem = marketData.find(m => m.id === selectedCurrencyId);
        if (!selectedItem) return '0';
        const inputVal = parseFloat(amount.replace(',', '.')) || 0;
        return (inputVal * selectedItem.price).toLocaleString('tr-TR', { maximumFractionDigits: 2 });
    };

    // Scroll Ref for auto-scroll
    const scrollViewRef = React.useRef<ScrollView>(null);

    return (
        <SafeAreaView className="flex-1 bg-[#0B1121]">
            <StatusBar barStyle="light-content" backgroundColor="#0B1121" />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 150 : 0}
                className="flex-1"
            >
                <ScrollView
                    ref={scrollViewRef}
                    className="flex-1 px-5 pt-4"
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
                    }
                    contentContainerStyle={{ paddingBottom: bottomPadding }}
                >
                    {/* --- Header --- */}
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

                    <Text className="text-white text-lg font-bold mb-4">Piyasalar</Text>

                    {loading && marketData.length === 0 ? (
                        <View className="mt-10 items-center">
                            <ActivityIndicator size="large" color="#3b82f6" />
                            <Text className="text-slate-400 mt-4">Piyasa verileri alınıyor...</Text>
                        </View>
                    ) : (
                        <>
                            {/* --- Hero Section --- */}
                            <Text className="text-slate-300 text-sm font-bold mb-3 uppercase tracking-wider">Vitrin</Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                className="mb-8"
                                contentContainerStyle={{ paddingRight: 20 }}
                            >
                                {heroItems.map(item => renderHeroCard(item))}
                            </ScrollView>

                            {/* --- Grid Overview --- */}
                            <Text className="text-slate-300 text-sm font-bold mb-3 uppercase tracking-wider">Piyasa Genel Bakış</Text>
                            <View className="flex-row flex-wrap justify-between mb-8">
                                {gridItems.map((item, idx) => {
                                    const isUp = item.change_rate >= 0;
                                    return (
                                        <View
                                            key={item.id}
                                            className="bg-[#151C2F] w-[48%] mb-3 p-3 rounded-xl border border-white/5"
                                        >
                                            <View className="flex-row justify-between items-center mb-2">
                                                <Text className="text-slate-400 text-xs font-bold">{item.symbol}</Text>
                                                <Text className={`text-[10px] ${isUp ? 'text-green-500' : 'text-red-500'}`}>
                                                    %{item.change_rate.toFixed(2)}
                                                </Text>
                                            </View>
                                            <Text className="text-white font-bold text-lg">
                                                {item.price.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>

                            {/* --- Converter --- */}
                            {selectedCurrencyId && (
                                <View className="bg-[#151C2F] p-4 rounded-2xl border border-white/10 mb-8">
                                    <View className="flex-row items-center gap-2 mb-4">
                                        <Calculator size={20} color="#3b82f6" />
                                        <Text className="text-white font-bold text-lg">Hızlı Çevirici</Text>
                                    </View>

                                    <View className="flex-row items-center gap-3">
                                        {/* Amount Input */}
                                        <View className="flex-1 bg-slate-800/50 rounded-xl px-4 py-3 border border-white/5">
                                            <Text className="text-slate-400 text-xs mb-1">Miktar</Text>
                                            <TextInput
                                                value={amount}
                                                onChangeText={setAmount}
                                                keyboardType="numeric"
                                                className="text-white font-bold text-lg h-8 p-0"
                                                placeholder="0"
                                                placeholderTextColor="#64748b"
                                            />
                                        </View>

                                        {/* Currency Select */}
                                        <ScrollView horizontal className="max-w-[160px]" showsHorizontalScrollIndicator={false}>
                                            {marketData.filter(m => m.id !== 4).map(curr => {
                                                let Icon = Banknote;
                                                const s = curr.symbol.toUpperCase();
                                                if (s.includes('USD')) Icon = DollarSign;
                                                else if (s.includes('EUR')) Icon = Euro;
                                                else if (s.includes('ALTIN') || s.includes('GLD') || s === 'GA') Icon = Coins;
                                                else if (s.includes('BTC') || s.includes('BITCOIN')) Icon = Bitcoin;

                                                const isSelected = selectedCurrencyId === curr.id;
                                                return (
                                                    <TouchableOpacity
                                                        key={curr.id}
                                                        onPress={() => setSelectedCurrencyId(curr.id)}
                                                        className={`mr-2 w-10 h-10 items-center justify-center rounded-xl border ${isSelected ? 'bg-blue-600 border-blue-500' : 'bg-slate-800 border-white/10'}`}
                                                    >
                                                        <Icon size={20} color={isSelected ? 'white' : '#94a3b8'} />
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </ScrollView>
                                    </View>

                                    {/* Arrow */}
                                    <View className="items-center -my-2 z-10 relative top-2">
                                        <View className="bg-slate-700 p-1.5 rounded-full border border-[#151C2F]">
                                            <ArrowLeftRight size={16} color="#94a3b8" />
                                        </View>
                                    </View>

                                    {/* Result */}
                                    <View className="mt-2 bg-slate-900/50 rounded-xl px-4 py-4 border border-white/5 items-center">
                                        <Text className="text-slate-400 text-xs mb-1">Türk Lirası Karşılığı</Text>
                                        <Text className="text-white font-bold text-2xl">{getConverterResult()} ₺</Text>
                                    </View>
                                </View>
                            )}
                        </>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
