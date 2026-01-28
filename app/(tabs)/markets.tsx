import { LivingStandardsChart } from '@/components/LivingStandardsChart';
import { SalaryInputModal } from '@/components/SalaryInputModal';
import { EconomicIndicators, fetchMarketData, getEconomicIndicators, getLastSalaryEntry, getLivingStandardsHistory, getUserPurchasingPower, MarketItem, upsertUserSalary } from '@/lib/marketService';
import { useAuth } from '@/providers/AuthProvider';
import { ViewLivingStandards } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { ArrowLeftRight, Banknote, Bitcoin, Calculator, Coins, DollarSign, Euro, TrendingDown, TrendingUp } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

import HeaderProfileButton from '@/components/HeaderProfileButton';

// Available currencies for converter
const CURRENCIES = [
    { id: 'USD', name: 'Dolar', symbol: '$', icon: DollarSign },
    { id: 'EUR', name: 'Euro', symbol: '€', icon: Euro },
    { id: 'GBP', name: 'Sterlin', symbol: '£', icon: Banknote },
    { id: 'GA', name: 'Gram Altın', symbol: 'g', icon: Coins },
];

type ChartMode = 'MIN_WAGE' | 'USER_SALARY';

export default function MarketsScreen() {
    const { user, isGuest, isPremium } = useAuth();
    const router = useRouter();
    const navigation = useNavigation();
    const [marketData, setMarketData] = useState<MarketItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [bottomPadding, setBottomPadding] = useState(40);

    // Explicitly reset Header Right to remove any stale formatting (e.g. calculator icon)
    React.useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => <HeaderProfileButton />,
        });
    }, [navigation]);

    // Economic Indicators State
    const [indicators, setIndicators] = useState<EconomicIndicators | null>(null);
    const [chartHistory, setChartHistory] = useState<ViewLivingStandards[]>([]);
    const [inflationSource, setInflationSource] = useState<'TÜİK' | 'ENAG' | 'İTO' | 'ORTALAMA'>('TÜİK');

    // User Purchasing Power State
    const [userPurchasingPower, setUserPurchasingPower] = useState<any[]>([]);
    const [lastSalaryRecord, setLastSalaryRecord] = useState<{ amount: number, valid_from: string } | null>(null);
    const [chartMode, setChartMode] = useState<ChartMode>('MIN_WAGE');
    const [isSalaryModalVisible, setSalaryModalVisible] = useState(false);
    const [pendingSalaryData, setPendingSalaryData] = useState<{ amount: number, validFrom: string } | null>(null);

    // Converter State
    const [amount, setAmount] = useState('1');
    const [selectedCurrencyId, setSelectedCurrencyId] = useState<number | null>(null);
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);
    const insets = useSafeAreaInsets();

    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener(
            'keyboardDidShow',
            () => {
                setKeyboardVisible(true);
                setBottomPadding(100); // Add extra padding when keyboard is open
            }
        );
        const keyboardDidHideListener = Keyboard.addListener(
            'keyboardDidHide',
            () => {
                setKeyboardVisible(false);
                setBottomPadding(40); // Reset padding
            }
        );

        return () => {
            keyboardDidHideListener.remove();
            keyboardDidShowListener.remove();
        };
    }, []);

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

        if (user && !isGuest) {
            loadUserPurchasingPower();
        }

        if (!silent) setLoading(false);
        setRefreshing(false);
    };

    const loadUserPurchasingPower = async () => {
        // Fetch both chart history AND exact last salary record
        const [chartData, lastRecord] = await Promise.all([
            getUserPurchasingPower(),
            getLastSalaryEntry()
        ]);

        setUserPurchasingPower(chartData);
        setLastSalaryRecord(lastRecord);
    };

    useFocusEffect(
        React.useCallback(() => {
            loadData();
        }, [])
    );

    // Load user data when switching to Salary mode or on User change
    useEffect(() => {
        if (user && !isGuest) {
            setChartMode('USER_SALARY');
            loadUserPurchasingPower();
        } else {
            // User logged out or switched to guest -> Clear sensitive user data
            setUserPurchasingPower([]);
            setLastSalaryRecord(null);
        }
    }, [user, isGuest]);

    // Header Right injection removed per UI request
    // Calculator button moved to content body next to "ALIM GÜCÜ" header

    // Handle Auto-Save after Login
    useEffect(() => {
        const handlePendingSave = async () => {
            if (user && !isGuest && pendingSalaryData) {
                console.log("Auto-saving pending salary:", pendingSalaryData);
                const { amount, validFrom } = pendingSalaryData;
                const { success } = await upsertUserSalary(amount, validFrom);

                if (success) {
                    setPendingSalaryData(null);
                    await loadUserPurchasingPower();
                    setChartMode('USER_SALARY');
                    Alert.alert("Başarılı", "Giriş yapıldı, maaşınız kaydedildi ve analiz hazır!");
                } else {
                    Alert.alert("Hata", "Maaş kaydedilirken bir sorun oluştu.");
                }
            }
        };
        handlePendingSave();
    }, [user, isGuest, pendingSalaryData]);

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

    const handleUnlockPremium = () => {
        alert("Premium özelliği yakında!");
    };

    const handleSalarySuccess = (data: { amount: number, validFrom: string }) => {
        // If user is guest (or not cached yet) and passes an amount, it means they clicked save.
        if ((!user || isGuest) && data) {
            // Guest Flow: Store state and prompt login
            setPendingSalaryData(data);
            setSalaryModalVisible(false);
            router.push('/login-modal');
        } else {
            // Logged In Flow
            loadUserPurchasingPower();
            setChartMode('USER_SALARY');
        }
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
            case 'ORTALAMA': val = indicators.inflation.average.value; break;
            default: val = indicators.inflation.tuik.value; break;
        }
        return val ?? 0;
    };

    // Cycle Inflation Source
    const cycleInflationSource = () => {
        if (inflationSource === 'TÜİK') setInflationSource('ENAG');
        else if (inflationSource === 'ENAG') setInflationSource('İTO');
        else if (inflationSource === 'İTO') setInflationSource('ORTALAMA');
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

            {/* Moved Header Elements to Navigation Options */}

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
                    {loading && marketData.length === 0 ? (
                        <View className="mt-10 items-center">
                            <ActivityIndicator size="large" color="#3b82f6" />
                            <Text className="text-slate-400 mt-4">Piyasa verileri alınıyor...</Text>
                        </View>
                    ) : (
                        <>
                            {/* --- ECONOMIC INDICATORS SECTION --- */}
                            <View className="mb-6">
                                {/* Header Text Removed */}
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={{ gap: 12, paddingRight: 20 }}
                                >
                                    {/* 1. Enflasyon (Dynamic) */}
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={cycleInflationSource}
                                        className="bg-[#151C2F] rounded-2xl p-4 w-40 justify-between h-32 border border-slate-800/50"
                                    >
                                        <View>
                                            <View className="flex-row justify-between items-start mb-1">
                                                <Text className="text-slate-400 text-xs font-medium uppercase tracking-wider">ENFLASYON</Text>
                                                <Text className="text-slate-500 text-[10px] font-medium">
                                                    {indicators ? new Date(
                                                        inflationSource === 'ENAG' ? indicators.inflation.enag.reference_date :
                                                            inflationSource === 'İTO' ? indicators.inflation.ito.reference_date :
                                                                inflationSource === 'ORTALAMA' ? indicators.inflation.average.reference_date :
                                                                    indicators.inflation.tuik.reference_date
                                                    ).toLocaleString('tr-TR', { month: 'long' }) : ''}
                                                </Text>
                                            </View>
                                            <View className="flex-row items-center gap-2">
                                                <Text className="text-white text-xs font-bold tracking-wider">{inflationSource}</Text>
                                                <View className="bg-blue-500/20 px-1.5 py-0.5 rounded">
                                                    <Text className="text-blue-400 text-[8px] font-bold">DEĞİŞTİR</Text>
                                                </View>
                                            </View>
                                        </View>
                                        <View>
                                            <View className="flex-row items-center justify-between">
                                                <Text className="text-white text-xl font-bold">
                                                    %{indicators ? getInflationValue().toFixed(2) : '...'}
                                                </Text>
                                                {(() => {
                                                    const getTrend = () => {
                                                        if (!indicators) return 'neutral';
                                                        switch (inflationSource) {
                                                            case 'ENAG': return indicators.inflation.enag.trend;
                                                            case 'İTO': return indicators.inflation.ito.trend;
                                                            case 'ORTALAMA': return indicators.inflation.average.trend;
                                                            default: return indicators.inflation.tuik.trend;
                                                        }
                                                    };
                                                    const trend = getTrend();
                                                    if (trend === 'neutral') return null;
                                                    const isUp = trend === 'up';
                                                    return (
                                                        <View className={`p-1 rounded-md ${isUp ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
                                                            {isUp ? <TrendingUp size={14} color="#ef4444" /> : <TrendingDown size={14} color="#22c55e" />}
                                                        </View>
                                                    );
                                                })()}
                                            </View>
                                        </View>
                                    </TouchableOpacity>

                                    {/* 2. Açlık Sınırı */}
                                    <View className="bg-[#151C2F] rounded-2xl p-4 w-40 justify-between h-32 border border-slate-800/50">
                                        <View className="flex-row justify-between items-start">
                                            <Text className="text-slate-400 text-xs font-medium uppercase tracking-wider">AÇLIK SINIRI</Text>
                                            <Text className="text-slate-500 text-[10px] font-medium">
                                                {indicators ? new Date(indicators.hunger.reference_date).toLocaleString('tr-TR', { month: 'long' }) : ''}
                                            </Text>
                                        </View>
                                        <View>

                                            <Text className="text-white text-xl font-bold">
                                                {indicators ? indicators.hunger.value.toLocaleString('tr-TR') : '...'} ₺
                                            </Text>
                                        </View>
                                    </View>

                                    {/* 3. Asgari Ücret */}
                                    <View className="bg-[#151C2F] rounded-2xl p-4 w-40 justify-between h-32 border border-slate-800/50">
                                        <View className="flex-row justify-between items-start">
                                            <Text className="text-slate-400 text-xs font-medium uppercase tracking-wider">NET ASGARİ ÜCRET</Text>
                                        </View>
                                        <View>

                                            <Text className="text-white text-xl font-bold">
                                                {indicators ? indicators.minWage.value.toLocaleString('tr-TR') : '...'} ₺
                                            </Text>
                                        </View>
                                    </View>
                                </ScrollView>
                            </View>

                            {/* --- Living Standards Chart --- */}
                            <View className="mb-6">
                                <View className="flex-row items-center justify-between mb-4">
                                    <View className="flex-row items-center gap-2">
                                        <Text className="text-slate-300 text-sm font-bold uppercase tracking-wider">ALIM GÜCÜ</Text>
                                        <TouchableOpacity
                                            onPress={() => setSalaryModalVisible(true)}
                                            className="bg-slate-800 p-1.5 rounded-lg border border-white/10"
                                        >
                                            <Ionicons name="calculator-outline" size={16} color="#3b82f6" />
                                        </TouchableOpacity>
                                    </View>

                                    {/* Custom Segmented Control */}
                                    <View className="flex-row bg-slate-900 rounded-lg p-1 border border-white/5">
                                        <TouchableOpacity
                                            onPress={() => setChartMode('MIN_WAGE')}
                                            className={`px-3 py-1.5 rounded-md ${chartMode === 'MIN_WAGE' ? 'bg-slate-700' : 'transparent'}`}
                                        >
                                            <Text className={`text-xs font-bold ${chartMode === 'MIN_WAGE' ? 'text-white' : 'text-slate-500'}`}>
                                                Asgari Ücret
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => {
                                                if (isGuest) {
                                                    // Allow guest to switch but they will see empty state with "Add Salary"
                                                    // But the empty state requires USER_SALARY mode.
                                                    // Let's allow it.
                                                }
                                                setChartMode('USER_SALARY');
                                            }}
                                            className={`px-3 py-1.5 rounded-md ${chartMode === 'USER_SALARY' ? 'bg-blue-600' : 'transparent'}`}
                                        >
                                            <Text className={`text-xs font-bold ${chartMode === 'USER_SALARY' ? 'text-white' : 'text-slate-500'}`}>
                                                Maaşım
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                                <LivingStandardsChart
                                    data={chartHistory}
                                    loading={loading && chartHistory.length === 0}
                                    dataMode={chartMode}
                                    userPurchasingPowerData={userPurchasingPower}
                                    isPremium={isPremium}
                                    onUnlockPress={handleUnlockPremium}
                                    onAddSalaryPress={() => setSalaryModalVisible(true)}
                                />
                            </View>

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

            <SalaryInputModal
                visible={isSalaryModalVisible}
                onClose={() => setSalaryModalVisible(false)}
                onSuccess={handleSalarySuccess}
                currentSalary={lastSalaryRecord?.amount} // Use amount from actual record
                isPremium={!!isPremium}
                hasHistory={!!lastSalaryRecord} // Determine history based on actual record existence
                lastSalaryDate={lastSalaryRecord?.valid_from}
            />
        </SafeAreaView>
    );
}
