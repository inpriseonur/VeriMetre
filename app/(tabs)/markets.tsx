import { LivingStandardsChart } from '@/components/LivingStandardsChart';
import { SalaryInputModal } from '@/components/SalaryInputModal';
import { getLastSalaryEntry, getLivingStandardsHistory, getUserPurchasingPower, upsertUserSalary } from '@/lib/marketService';
import { useAuth } from '@/providers/AuthProvider';
import { useMarket } from '@/providers/MarketProvider';
import { ViewLivingStandards } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { ArrowLeftRight, Banknote, Bitcoin, Calculator, Coins, DollarSign, Euro, TrendingDown, TrendingUp } from 'lucide-react-native';
import { default as React, useEffect, useState } from 'react';
import {
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
    const { marketData, indicators, refreshData: refreshContext, isLoading: isContextLoading } = useMarket();
    const { user, isGuest, isPremium } = useAuth();
    const router = useRouter();
    const navigation = useNavigation();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [bottomPadding, setBottomPadding] = useState(40);

    React.useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => <HeaderProfileButton />,
        });
    }, [navigation]);

    const [chartHistory, setChartHistory] = useState<ViewLivingStandards[]>([]);
    const [inflationSource, setInflationSource] = useState<'TÜİK' | 'ENAG' | 'İTO' | 'ORTALAMA'>('TÜİK');

    const [userPurchasingPower, setUserPurchasingPower] = useState<any[]>([]);
    const [lastSalaryRecord, setLastSalaryRecord] = useState<{ amount: number, valid_from: string } | null>(null);
    const [chartMode, setChartMode] = useState<ChartMode>('MIN_WAGE');
    const [isSalaryModalVisible, setSalaryModalVisible] = useState(false);
    const [pendingSalaryData, setPendingSalaryData] = useState<{ amount: number, validFrom: string } | null>(null);

    const [amount, setAmount] = useState('1');
    const [selectedCurrencyId, setSelectedCurrencyId] = useState<number | null>(null);
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);
    const insets = useSafeAreaInsets();

    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener(
            'keyboardDidShow',
            () => {
                setKeyboardVisible(true);
                setBottomPadding(100);
            }
        );
        const keyboardDidHideListener = Keyboard.addListener(
            'keyboardDidHide',
            () => {
                setKeyboardVisible(false);
                setBottomPadding(40);
            }
        );

        return () => {
            keyboardDidHideListener.remove();
            keyboardDidShowListener.remove();
        };
    }, []);

    useEffect(() => {
        if (marketData.length > 0 && !selectedCurrencyId) {
            const defaultCurr = marketData.find(item => item.id !== 4);
            if (defaultCurr) setSelectedCurrencyId(defaultCurr.id);
        }
    }, [marketData, selectedCurrencyId]);

    const loadUserPurchasingPower = async () => {
        const [chartData, lastRecord] = await Promise.all([
            getUserPurchasingPower(),
            getLastSalaryEntry()
        ]);

        setUserPurchasingPower(chartData);
        setLastSalaryRecord(lastRecord);
    };

    const loadData = async (silent = false) => {
        if (!silent) setLoading(true);

        const [hRes] = await Promise.all([
            getLivingStandardsHistory(13)
        ]);

        if (hRes) {
            setChartHistory(hRes);
        }

        if (user && !isGuest) {
            loadUserPurchasingPower();
        }

        if (refreshing) {
            await refreshContext(true);
        }

        if (!silent) setLoading(false);
        setRefreshing(false);
    };

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        await refreshContext(true);
        loadData(true);
    }, [refreshContext]);

    useFocusEffect(
        React.useCallback(() => {
            loadData(true);
        }, [])
    );

    useEffect(() => {
        if (user && !isGuest) {
            setChartMode('USER_SALARY');
            loadUserPurchasingPower();
        } else {
            setUserPurchasingPower([]);
            setLastSalaryRecord(null);
        }
    }, [user, isGuest]);

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
        const interval = setInterval(() => {
            loadData(true);
        }, 60000);

        const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
            setBottomPadding(280);
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
        });
        const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
            setBottomPadding(40);
        });

        return () => {
            clearInterval(interval);
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    const handleUnlockPremium = () => {
        alert("Premium özelliği yakında!");
    };

    const handleSalarySuccess = (data: { amount: number, validFrom: string }) => {
        if ((!user || isGuest) && data) {
            setPendingSalaryData(data);
            setSalaryModalVisible(false);
            router.push('/login-modal');
        } else {
            loadUserPurchasingPower();
            setChartMode('USER_SALARY');
        }
    };

    const gridItems = marketData;

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
                        <View className="mt-2">
                            {/* --- Skeleton: Economic Indicators (Horizontal Scroll) --- */}
                            <View className="mb-6">
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 20 }}>
                                    {[1, 2, 3].map((i) => (
                                        <View key={i} className="bg-slate-800/50 rounded-2xl p-4 w-40 h-32 border border-white/5 animate-pulse justify-between">
                                            <View className="h-4 w-24 bg-slate-700 rounded" />
                                            <View>
                                                <View className="h-8 w-20 bg-slate-700 rounded mb-2" />
                                                <View className="h-3 w-12 bg-slate-700 rounded" />
                                            </View>
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>

                            {/* --- Skeleton: Chart --- */}
                            <View className="mb-6">
                                <View className="flex-row justify-between mb-4">
                                    <View className="h-6 w-32 bg-slate-800/50 rounded animate-pulse" />
                                    <View className="h-8 w-40 bg-slate-800/50 rounded animate-pulse" />
                                </View>
                                <View className="h-[300px] bg-slate-800/50 rounded-2xl border border-white/5 animate-pulse" />
                            </View>

                            {/* --- Skeleton: Grid Overview --- */}
                            <View className="mb-4">
                                <View className="h-5 w-48 bg-slate-800/50 rounded mb-4 animate-pulse" />
                                <View className="flex-row flex-wrap justify-between">
                                    {[1, 2, 3, 4, 5, 6].map((i) => (
                                        <View key={i} className="bg-slate-800/50 w-[48%] h-24 mb-3 rounded-xl border border-white/5 animate-pulse p-3 justify-between">
                                            <View className="flex-row justify-between">
                                                <View className="h-4 w-10 bg-slate-700 rounded" />
                                                <View className="h-4 w-12 bg-slate-700 rounded" />
                                            </View>
                                            <View className="h-7 w-20 bg-slate-700 rounded" />
                                        </View>
                                    ))}
                                </View>
                            </View>
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
