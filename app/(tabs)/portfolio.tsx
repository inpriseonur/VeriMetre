import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Platform,
    RefreshControl,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import AddAssetModal from '@/components/portfolio/AddAssetModal';
import {
    PortfolioAsset,
    calculateTotalBalance,
    getPortfolioAssets,
    removePortfolioAsset,
    syncAssetPrices
} from '@/lib/localStorageService';
import { fetchMarketData } from '@/lib/marketService';

export default function PortfolioScreen() {
    const [assets, setAssets] = useState<PortfolioAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [privacyMode, setPrivacyMode] = useState(false);
    const [totalBalance, setTotalBalance] = useState(0);
    const [modalVisible, setModalVisible] = useState(false);

    // Initial Load & Focus Effect
    useFocusEffect(
        useCallback(() => {
            loadPortfolio();
        }, [])
    );

    const loadPortfolio = async () => {
        setLoading(true);
        const data = await getPortfolioAssets();
        setAssets(data);
        setTotalBalance(calculateTotalBalance(data));
        setLoading(false);
        setRefreshing(false);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        // Sync prices with latest market data
        try {
            const marketData = await fetchMarketData();
            if (marketData) {
                const updatedAssets = await syncAssetPrices(marketData);
                setAssets(updatedAssets);
                setTotalBalance(calculateTotalBalance(updatedAssets));
            } else {
                await loadPortfolio(); // Fallback to just reload
            }
        } catch (e) {
            console.error(e);
            await loadPortfolio();
        }
        setRefreshing(false);
    };

    const handleDelete = (symbol: string) => {
        Alert.alert(
            "Varlık Sil",
            `${symbol} portföyünüzden silinecek. Onaylıyor musunuz?`,
            [
                { text: "Vazgeç", style: "cancel" },
                {
                    text: "Sil",
                    style: "destructive",
                    onPress: async () => {
                        await removePortfolioAsset(symbol);
                        loadPortfolio();
                    }
                }
            ]
        );
    };

    // Render Item for List
    const renderRightActions = (progress: any, dragX: any, symbol: string) => {
        return (
            <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(symbol)}
            >
                <Trash2 size={24} color="white" />
            </TouchableOpacity>
        );
    };

    const renderItem = ({ item }: { item: PortfolioAsset }) => (
        <Swipeable renderRightActions={(p, d) => renderRightActions(p, d, item.symbol)}>
            <View className="bg-[#151C2F] mb-3 p-4 rounded-xl border border-white/5 flex-row justify-between items-center">
                <View>
                    <View className="flex-row items-center gap-2">
                        <Text className="text-white font-bold text-lg">{item.symbol}</Text>
                        <Text className="text-slate-400 text-xs">{item.name}</Text>
                    </View>
                    <Text className="text-slate-500 text-xs mt-1">
                        {item.quantity.toLocaleString('tr-TR')} Adet
                    </Text>
                </View>
                <View className="items-end">
                    <Text className="text-white font-bold text-lg">
                        {privacyMode ? '***' : (item.quantity * item.price).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                    </Text>
                    <Text className="text-slate-400 text-xs">
                        Birim: {item.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                    </Text>
                </View>
            </View>
        </Swipeable>
    );

    const insets = useSafeAreaInsets();

    return (
        <SafeAreaView className="flex-1 bg-[#0B1121]" edges={['top', 'left', 'right']}>
            <StatusBar barStyle="light-content" backgroundColor="#0B1121" />

            {/* --- Hero Card --- */}
            <View className="px-5 pt-4 pb-6">
                <LinearGradient
                    colors={['#1e293b', '#0f172a']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="p-6 rounded-3xl border border-white/10"
                >
                    <View className="flex-row justify-between items-start mb-2">
                        <Text className="text-slate-400 font-medium">Toplam Varlık</Text>
                        <TouchableOpacity onPress={() => setPrivacyMode(!privacyMode)} className="p-1">
                            {privacyMode ? <EyeOff size={20} color="#94a3b8" /> : <Eye size={20} color="#94a3b8" />}
                        </TouchableOpacity>
                    </View>

                    <Text className="text-white text-3xl font-bold tracking-tight">
                        {privacyMode ? '********' : totalBalance.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                    </Text>

                    <View className="mt-4 flex-row items-center gap-2">
                        <View className="bg-green-500/20 px-2 py-1 rounded">
                            <Text className="text-green-500 text-xs font-bold font-mono">GUEST MODE</Text>
                        </View>
                        <Text className="text-slate-500 text-xs">Cihazınızda saklanıyor</Text>
                    </View>
                </LinearGradient>
            </View>

            {/* --- List --- */}
            <View className="flex-1 px-5">
                <View className="flex-row justify-between items-center mb-4">
                    <Text className="text-white text-lg font-bold">Fonlarım</Text>
                    <Text className="text-slate-400 text-xs">{assets.length} Varlık</Text>
                </View>

                {loading ? (
                    <ActivityIndicator color="#F97316" size="large" className="mt-10" />
                ) : assets.length === 0 ? (
                    <View className="flex-1 justify-center items-center mt-10 opacity-50">
                        <Ionicons name="wallet-outline" size={64} color="#64748b" />
                        <Text className="text-slate-400 mt-4 text-center">Henüz varlık eklemediniz.</Text>
                        <Text className="text-slate-600 text-xs mt-1 text-center">Yatırım yolculuğuna başlamak için + butonuna basın.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={assets}
                        keyExtractor={item => item.symbol}
                        renderItem={renderItem}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
                        contentContainerStyle={{ paddingBottom: 100 }}
                    />
                )}
            </View>

            {/* --- FAB --- */}
            <TouchableOpacity
                className="absolute right-6 w-14 h-14 bg-[#F97316] rounded-full items-center justify-center shadow-lg shadow-orange-500/50"
                style={{
                    elevation: 8,
                    bottom: Platform.OS === 'ios' ? 100 : 24 // Raise it on iOS to clear TabBar
                }}
                onPress={() => setModalVisible(true)}
            >
                <Plus size={32} color="white" />
            </TouchableOpacity>

            <AddAssetModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onAssetAdded={() => {
                    loadPortfolio();
                }}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    deleteButton: {
        backgroundColor: '#ef4444',
        justifyContent: 'center',
        alignItems: 'center',
        width: 80,
        height: '100%',
        marginBottom: 12,
        borderRadius: 12,
        marginLeft: 10,
    }
});
