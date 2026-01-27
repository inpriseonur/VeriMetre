import { LivingStandardsChart } from '@/components/LivingStandardsChart';
import { EconomicIndicators, fetchMarketData, getEconomicIndicators, getLivingStandardsHistory, MarketItem } from '@/lib/marketService';
import { ViewLivingStandards } from '@/types/database';
import { useFocusEffect } from 'expo-router';
import { ArrowLeftRight, Banknote, Bitcoin, Calculator, Coins, DollarSign, Euro, TrendingUp } from 'lucide-react-native';
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
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function MarketsScreen() {
    const [marketData, setMarketData] = useState<MarketItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [bottomPadding, setBottomPadding] = useState(40);

    // Economic Indicators State (Decoupled)
    const [indicators, setIndicators] = useState<EconomicIndicators | null>(null);
    const [chartHistory, setChartHistory] = useState<ViewLivingStandards[]>([]);
    const [inflationSource, setInflationSource] = useState<'TÜİK' | 'ENAG' | 'İTO'>('TÜİK');

    // Converter State
    const [amount, setAmount] = useState('1');
    const [selectedCurrencyId, setSelectedCurrencyId] = useState<number | null>(null);

    // Header Time logic
    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const loadData = async (silent = false) => {
        if (!silent) setLoading(true);

        const [mRes, iRes, hRes] = await Promise.all([
            fetchMarketData(),
            getEconomicIndicators(),
            getLivingStandardsHistory(13)
        ]);

        if (mRes) {
            setMarketData(mRes);
            if (!selectedCurrencyId) {
                const defaultCurr = mRes.find(item => item.id !== 4); // Assuming 4 is BIST
                if (defaultCurr) setSelectedCurrencyId(defaultCurr.id);
            }
        }

        if (iRes) {
            setIndicators(iRes);
        }

        if (hRes) {
            setChartHistory(hRes);
        }

        if (!silent) setLoading(false);
        setRefreshing(false);
    };

    useFocusEffect(
        React.useCallback(() => {
            loadData();
        }, [])
    );

    useEffect(() => {
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



    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    // Derived Data
    const gridItems = marketData;

    // Helper for Inflation Value based on Source
    const getInflationValue = () => {
        if (!indicators) return 0;
        let val = 0;
        switch (inflationSource) {
            case 'ENAG': val = indicators.inflation.enag.value; break;
            case 'İTO': val = indicators.inflation.ito.value; break;
            default: val = indicators.inflation.tuik.value; break;
        }
        return val ?? 0;
    };

    // Cycle Inflation Source
    const cycleInflationSource = () => {
        if (inflationSource === 'TÜİK') setInflationSource('ENAG');
        else if (inflationSource === 'ENAG') setInflationSource('İTO');
        else setInflationSource('TÜİK');
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
        <SafeAreaView className="flex-1 bg-[#0B1121]" edges={['left', 'right', 'bottom']}>
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
                    {/* --- Header Removed --- */}

                    <Text className="text-white text-lg font-bold mb-4">Piyasalar</Text>

                    {loading && marketData.length === 0 ? (
                        <View className="mt-10 items-center">
                            <ActivityIndicator size="large" color="#3b82f6" />
                            <Text className="text-slate-400 mt-4">Piyasa verileri alınıyor...</Text>
                        </View>
                    ) : (
                        <>
                            {/* --- ECONOMIC INDICATORS SECTION (New) --- */}
                            <View className="mb-6">
                                <Text className="text-slate-300 text-sm font-bold mb-3 uppercase tracking-wider">Ekonomik Göstergeler</Text>
                                <View className="flex-row gap-3">
                                    {/* 1. Asgari Ücret */}
                                    <View className="flex-1 bg-[#151C2F] rounded-xl p-3 border border-slate-800/50 justify-between min-h-[100px]">
                                        <View className="flex-row justify-between items-start">
                                            <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">NET ASGARİ ÜCRET</Text>
                                            <View className="bg-green-500/10 p-1 rounded-md">
                                                <TrendingUp size={12} color="#22c55e" />
                                            </View>
                                        </View>
                                        <View>
                                            <Text className="text-white text-base font-bold">
                                                {indicators ? indicators.minWage.value.toLocaleString('tr-TR') : '...'} ₺
                                            </Text>
                                        </View>
                                    </View>

                                    {/* 2. Açlık Sınırı */}
                                    <View className="flex-1 bg-[#151C2F] rounded-xl p-3 border border-slate-800/50 justify-between min-h-[100px]">
                                        <View className="flex-row justify-between items-start">
                                            <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">AÇLIK SINIRI</Text>
                                            <View className="bg-red-500/10 p-1 rounded-md">
                                                <TrendingUp size={12} color="#ef4444" />
                                            </View>
                                        </View>
                                        <View>
                                            <Text className="text-white text-base font-bold">
                                                {indicators ? indicators.hunger.value.toLocaleString('tr-TR') : '...'} ₺
                                            </Text>
                                        </View>
                                    </View>

                                    {/* 3. Enflasyon (Dynamic) */}
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={cycleInflationSource}
                                        className="flex-1 bg-[#151C2F] rounded-xl p-3 border border-slate-800/50 justify-between min-h-[100px]"
                                    >
                                        <View className="flex-row justify-between items-center">
                                            <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">{inflationSource} ENFLASYON</Text>
                                            <View className="bg-blue-500/20 px-1 py-0.5 rounded flex-row items-center">
                                                <Text className="text-blue-400 text-[8px] font-bold">DEĞİŞTIREBİLİRSİN</Text>
                                            </View>
                                        </View>
                                        <View>
                                            <Text className="text-white text-base font-bold">
                                                %{indicators ? getInflationValue().toFixed(2) : '...'}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* --- Living Standards Chart (New) --- */}
                            <LivingStandardsChart data={chartHistory} loading={loading && chartHistory.length === 0} />

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
