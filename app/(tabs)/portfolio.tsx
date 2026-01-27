import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { Briefcase, Eye, EyeOff, Plus, TrendingDown, TrendingUp } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Platform,
    RefreshControl,
    StatusBar,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CreatePortfolioModal from '@/components/portfolio/CreatePortfolioModal';
import { PortfolioSummary, getPortfolios } from '@/lib/portfolioService';
import { useAuth } from '@/providers/AuthProvider';

export default function PortfolioScreen() {
    const { resetKey, user } = useAuth(); // Watch for logout events & user state
    const [portfolios, setPortfolios] = useState<PortfolioSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [privacyMode, setPrivacyMode] = useState(false);
    const [totalBalance, setTotalBalance] = useState(0);
    const [modalVisible, setModalVisible] = useState(false);

    // Clear data when user logs out (user becomes null) or resetKey changes
    useEffect(() => {
        if (!user) {
            setPortfolios([]);
            setTotalBalance(0);
            setLoading(false); // Stop loading if no user
        } else {
            loadData(); // Reload if user logs in/changes
        }
    }, [user, resetKey]);

    // Initial Load & Focus Effect -> Only if user exists
    useFocusEffect(
        useCallback(() => {
            if (user) loadData();
        }, [user, resetKey])
    );

    const loadData = async () => {
        if (!user) return; // Guard: Don't fetch if no user

        try {
            setLoading(true);
            const data = await getPortfolios();
            setPortfolios(data);

            // Calculate Total Balance
            const total = data.reduce((acc, curr) => acc + (curr.current_balance || 0), 0);
            setTotalBalance(total);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
    };

    const formatCurrency = (amount: number) => {
        return amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
    };

    const renderItem = ({ item }: { item: PortfolioSummary }) => (
        <TouchableOpacity
            onPress={() => router.push(`/portfolio/${item.portfolio_id}`)}
            className="bg-[#151C2F] mb-3 p-4 rounded-xl border border-white/5"
            activeOpacity={0.7}
        >
            <View className="flex-row justify-between items-start mb-2">
                <View className="flex-row items-center gap-2">
                    <View className="bg-orange-500/10 p-2 rounded-lg">
                        <Briefcase size={20} color="#F97316" />
                    </View>
                    <View>
                        <Text className="text-white font-bold text-base">{item.portfolio_name}</Text>
                        <Text className="text-slate-500 text-xs">{item.portfolio_type}</Text>
                    </View>
                </View>
                <View className="items-end">
                    <Text className="text-white font-bold text-lg">
                        {privacyMode ? '********' : formatCurrency(item.current_balance)}
                    </Text>
                </View>
            </View>

            {/* Profit/Loss Row */}
            <View className="mt-2 pt-2 border-t border-white/5 flex-row justify-between items-center">
                <Text className="text-slate-400 text-xs">Yatırılan: {privacyMode ? '***' : formatCurrency(item.total_invested)}</Text>

                <View className={`flex-row items-center gap-1 ${item.profit_loss_amount >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'} px-2 py-1 rounded`}>
                    {item.profit_loss_amount >= 0 ?
                        <TrendingUp size={12} color="#22c55e" /> :
                        <TrendingDown size={12} color="#ef4444" />
                    }
                    <Text className={`${item.profit_loss_amount >= 0 ? 'text-green-500' : 'text-red-500'} text-xs font-bold`}>
                        {item.profit_loss_amount >= 0 ? '+' : ''}{formatCurrency(item.profit_loss_amount)} (%{item.profit_loss_percentage?.toFixed(2)})
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView className="flex-1 bg-[#0B1121]" edges={['left', 'right', 'bottom']}>
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
                        {privacyMode ? '********' : formatCurrency(totalBalance)}
                    </Text>

                    <View className="mt-4 flex-row items-center gap-2">
                        {/* Optional summary tags */}
                    </View>
                </LinearGradient>
            </View>

            {/* --- List --- */}
            <View className="flex-1 px-5">
                <View className="flex-row justify-between items-center mb-4">
                    <Text className="text-white text-lg font-bold">Portföylerim</Text>
                    <Text className="text-slate-400 text-xs">{portfolios.length} Cüzdan</Text>
                </View>

                {loading && portfolios.length === 0 ? (
                    <ActivityIndicator color="#F97316" size="large" className="mt-10" />
                ) : portfolios.length === 0 ? (
                    <View className="flex-1 justify-center items-center mt-10 opacity-50">
                        <Ionicons name="briefcase-outline" size={64} color="#64748b" />
                        <Text className="text-slate-400 mt-4 text-center">Henüz bir portföy oluşturmadınız.</Text>
                        <Text className="text-slate-600 text-xs mt-1 text-center">Bireysel Emeklilik veya Yatırım hesabınızı ekleyin.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={portfolios}
                        keyExtractor={item => item.portfolio_id}
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

            <CreatePortfolioModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onCreated={() => {
                    loadData();
                }}
            />
        </SafeAreaView>
    );
}

// Remove old styles

