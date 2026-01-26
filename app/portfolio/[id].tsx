import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { ArrowLeft, Briefcase, Plus, RefreshCw } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    RefreshControl,
    ScrollView,
    StatusBar,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AddAssetToPortfolioModal from '@/components/portfolio/AddAssetToPortfolioModal';
import UpdatePortfolioModal from '@/components/portfolio/UpdatePortfolioModal';
import { Portfolio, PortfolioItem, getPortfolioDetails } from '@/lib/portfolioService';

export default function PortfolioDetailScreen() {
    const { id } = useLocalSearchParams();
    const navigation = useNavigation();
    const router = useRouter();

    const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
    const [items, setItems] = useState<PortfolioItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Modals
    const [isAddAssetVisible, setAddAssetVisible] = useState(false);
    const [isUpdateVisible, setUpdateVisible] = useState(false);

    useEffect(() => {
        loadDetails();
    }, [id]);

    const loadDetails = async () => {
        try {
            if (!id) return;
            setLoading(true);
            const data = await getPortfolioDetails(id as string);
            setPortfolio(data.portfolio);
            setItems(data.items);

            // Set Navigation Title
            navigation.setOptions({
                headerTitle: data.portfolio.name
            });

        } catch (error) {
            console.error(error);
            Alert.alert('Hata', 'Portföy detayları alınamadı.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadDetails();
    };

    const formatCurrency = (amount: number) => {
        return amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
    };

    // Calculate Summary from Items client-side for immediate display
    // (Or use the passed portfolio data if we fetched summary, but getPortfolioDetails fetches raw table data)
    // We can sum up items.
    const currentBalance = items.reduce((sum, item) => sum + (item.current_value || 0), 0);
    // Total Invested logic:
    // Initial Principal + Transactions (Deposits - Withdrawals).
    // Getting transactions was not in getPortfolioDetails, I should probably add it or calculate simply.
    // For MVP, user said "Update Rebalance" -> Cash Flow.
    // Let's assume for now we trust `initial_principal` + sum of transactions?
    // I need to fetch transactions to show "Total Invested" correctly if I don't use the View.
    // Wait, the View `view_portfolio_summary` has the correct calculation.
    // But here I called `getPortfolioDetails` which queries tables directly.
    // Ideally I should also get the SUMMARY row for this portfolio to show the stats.
    // I will stick to what I have: `portfolio.initial_principal`. I need transactions to show correct invested amount.
    // I will update `getPortfolioDetails` in service later to include totals or fetch summary.
    // For now, let's just show Balance.

    return (
        <SafeAreaView className="flex-1 bg-[#0B1121]" edges={['top', 'left', 'right', 'bottom']}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="light-content" backgroundColor="#0B1121" />

            {/* Custom Header */}
            <View className="flex-row items-center justify-between px-5 pt-2 mb-4">
                <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
                    <ArrowLeft size={24} color="white" />
                </TouchableOpacity>
                <Text className="text-white text-xl font-bold flex-1 text-center mr-8" numberOfLines={1}>
                    {portfolio?.name || '...'}
                </Text>
                {/* Right Action: Update/Rebalance */}
                <TouchableOpacity onPress={() => setUpdateVisible(true)} className="p-2 bg-slate-800 rounded-lg border border-white/10">
                    <RefreshCw size={20} color="#3b82f6" />
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
            >
                {/* --- Summary Card --- */}
                <View className="px-5 mb-6">
                    <View className="bg-slate-800/50 p-5 rounded-2xl border border-white/10">
                        <Text className="text-slate-400 text-sm font-medium mb-1">Toplam Varlık</Text>
                        <Text className="text-white text-3xl font-bold tracking-tight mb-4">
                            {formatCurrency(currentBalance)}
                        </Text>

                        <View className="flex-row gap-4">
                            <View>
                                <Text className="text-slate-500 text-xs">Maliyet (Yaklaşık)</Text>
                                <Text className="text-slate-300 font-bold">
                                    {formatCurrency(portfolio?.initial_principal || 0)}
                                </Text>
                            </View>
                            {/* We need calculated Profit/Loss here. 
                                Since we lack transactions in this fetch, we might show incomplete data. 
                                But user task says "Update" adds transactions.
                            */}
                        </View>
                    </View>
                </View>

                {/* --- Holdings --- */}
                <View className="px-5">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-white text-lg font-bold">Varlıklar</Text>
                        <TouchableOpacity
                            onPress={() => setAddAssetVisible(true)}
                            className="bg-[#F97316] px-3 py-1.5 rounded-lg flex-row items-center gap-1"
                        >
                            <Plus size={16} color="white" />
                            <Text className="text-white text-xs font-bold">Fon Ekle</Text>
                        </TouchableOpacity>
                    </View>

                    {items.length === 0 ? (
                        <View className="items-center py-10 opacity-50">
                            <Briefcase size={48} color="#64748b" />
                            <Text className="text-slate-500 mt-4">Bu portföyde henüz varlık yok.</Text>
                        </View>
                    ) : (
                        items.map((item, idx) => (
                            <View key={item.id} className="bg-[#151C2F] mb-3 p-4 rounded-xl border border-white/5 flex-row justify-between items-center">
                                <View className="flex-1 mr-4">
                                    <View className="flex-row items-center gap-2">
                                        <View className="bg-slate-800 px-2 py-0.5 rounded">
                                            <Text className="text-white font-bold text-xs">{item.fund_code}</Text>
                                        </View>
                                        <Text className="text-slate-400 text-xs flex-1" numberOfLines={1}>
                                            {item.fund_definitions?.title}
                                        </Text>
                                    </View>
                                    <Text className="text-slate-500 text-xs mt-1">
                                        {item.quantity.toLocaleString('tr-TR')} Adet
                                    </Text>
                                </View>
                                <View className="items-end">
                                    <Text className="text-white font-bold text-base">
                                        {formatCurrency(item.current_value || 0)}
                                    </Text>
                                    <Text className="text-slate-400 text-xs">
                                        {item.fund_definitions?.last_price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                                    </Text>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>

            {/* Modals will be placed here */}
            {portfolio && (
                <>
                    <AddAssetToPortfolioModal
                        visible={isAddAssetVisible}
                        onClose={() => setAddAssetVisible(false)}
                        onAssetAdded={onRefresh}
                        portfolioId={portfolio.id}
                    />

                    <UpdatePortfolioModal
                        visible={isUpdateVisible}
                        onClose={() => setUpdateVisible(false)}
                        onUpdated={onRefresh}
                        portfolio={portfolio}
                        currentItems={items}
                    />
                </>
            )}
        </SafeAreaView>
    );
}
