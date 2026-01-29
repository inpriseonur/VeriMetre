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
import { createPortfolio, getPortfolios, PortfolioSummary } from '@/lib/portfolioService';
import { useAuth } from '@/providers/AuthProvider';
import { Alert } from 'react-native';

export default function PortfolioScreen() {
    const { resetKey, user, isGuest } = useAuth(); // Watch for logout & user state
    const [portfolios, setPortfolios] = useState<PortfolioSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [privacyMode, setPrivacyMode] = useState(false);
    const [totalBalance, setTotalBalance] = useState(0);
    const [modalVisible, setModalVisible] = useState(false);

    // Guest pending state
    const [pendingPortfolio, setPendingPortfolio] = useState<{ name: string, type: string, initialPrincipal: number } | null>(null);

    // Clear data when user logs out
    useEffect(() => {
        if (!user) {
            setPortfolios([]);
            setTotalBalance(0);
            setLoading(false); // Stop loading if no user
        } else {
            loadData(); // Reload if user logs in/changes
        }
    }, [user, resetKey]);

    // Auto-Save Effect (Guest -> User)
    useEffect(() => {
        const autoSave = async () => {
            if (user && !isGuest && pendingPortfolio) {
                console.log("Auto-saving pending portfolio:", pendingPortfolio);
                try {
                    await createPortfolio(pendingPortfolio.name, pendingPortfolio.type, pendingPortfolio.initialPrincipal);
                    setPendingPortfolio(null);
                    Alert.alert("Başarılı", "Giriş yapıldı, portföyünüz oluşturuldu! 🎉");
                    loadData();
                } catch (err: any) {
                    Alert.alert("Hata", "Otomatik kaydetme başarısız: " + err.message);
                }
            }
        };
        autoSave();
    }, [user, isGuest, pendingPortfolio]);

    // Initial Load & Focus Effect -> Only if user exists
    useFocusEffect(
        useCallback(() => {
            if (user) loadData();
        }, [user, resetKey])
    );

    const loadData = async () => {
        // If guest, maybe we show empty or demo? For now guard.
        if (!user && !isGuest) return;
        if (isGuest) {
            setLoading(false);
            return;
        }

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

    const handleCreatePortfolio = async (data: { name: string, type: string, initialPrincipal: number }) => {
        if (!user || isGuest) {
            // Guest Flow
            setPendingPortfolio(data);
            setModalVisible(false);

            router.push('/login-modal');
            return;
        }

        // User Flow
        await createPortfolio(data.name, data.type, data.initialPrincipal);
        loadData();
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
            {portfolios.length > 0 && (
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
            )}

            {/* --- List --- */}
            <View className="flex-1 px-5">
                {portfolios.length > 0 && (
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-white text-lg font-bold">Portföylerim</Text>
                        <Text className="text-slate-400 text-xs">{portfolios.length} Cüzdan</Text>
                    </View>
                )}

                {loading && portfolios.length === 0 ? (
                    <ActivityIndicator color="#F97316" size="large" className="mt-10" />
                ) : portfolios.length === 0 ? (
                    <View className="flex-1 justify-center items-center -mt-20 opacity-80">
                        <Ionicons name="briefcase-outline" size={64} color="#64748b" />
                        <Text className="text-slate-400 mt-4 text-center text-lg font-medium">Henüz bir portföy oluşturmadınız.</Text>
                        <Text className="text-slate-500 text-sm mt-1 text-center mb-6 px-10">Bireysel Emeklilik veya Yatırım hesabınızı ekleyerek varlıklarınızı takip edin.</Text>

                        <TouchableOpacity
                            onPress={() => setModalVisible(true)}
                            className="bg-[#F97316] px-6 py-3 rounded-lg flex-row items-center gap-2 shadow-lg shadow-orange-500/20"
                        >
                            <Plus size={18} color="white" />
                            <Text className="text-white font-bold text-sm">Portföy Ekle</Text>
                        </TouchableOpacity>
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

            {/* --- FAB (Only Show if Portfolios Exist) --- */}
            {portfolios.length > 0 && (
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
            )}

            <CreatePortfolioModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onSubmit={handleCreatePortfolio}
            />
        </SafeAreaView>
    );
}

// Remove old styles

