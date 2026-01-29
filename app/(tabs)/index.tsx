import { AnnouncementBanner } from '@/components/AnnouncementBanner';
import InflationChart from '@/components/InflationChart';
import { Skeleton } from '@/components/Skeleton';
import { AutoSummary, getAutoSummary } from '@/lib/autoService';
import { getHousingSummary, HousingSummary } from '@/lib/housingService';
import { getTuikSummary, TuikSummary } from '@/lib/inflationService';
import { supabase } from '@/lib/supabase';
import { useMarket } from '@/providers/MarketProvider';
import { ViewInflationCalculated, ViewLivingStandards } from '@/types/database';
import { ArrowUpRight, BarChart3, Building2, Car, Coins, DollarSign, Euro, TrendingDown, TrendingUp } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StatusBar, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DashboardScreen() {
  const { marketData, refreshData: refreshMarketData, isLoading: isMarketLoading } = useMarket();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inflationData, setInflationData] = useState<ViewInflationCalculated[]>([]);
  // Living standards data logic kept but not used in UI as per design request - kept for future use if needed
  const [livingStandardsData, setLivingStandardsData] = useState<ViewLivingStandards[]>([]);

  const [inflationSummary, setInflationSummary] = useState<TuikSummary | null>(null);
  const [housingSummary, setHousingSummary] = useState<HousingSummary | null>(null);
  const [autoSummary, setAutoSummary] = useState<AutoSummary | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [inflationRes, livingStandardsRes, tuikRes, housingRes, autoRes] = await Promise.all([
        supabase
          .from('view_inflation_calculated')
          .select('*')
          .order('reference_date', { ascending: false })
          .limit(100),
        supabase
          .from('view_living_standards')
          .select('*')
          .order('reference_date', { ascending: false })
          .limit(24),
        // fetchMarketData() removed - using Context
        getTuikSummary(),
        getHousingSummary(),
        getAutoSummary()
      ]);

      if (inflationRes.error) {
        console.error('Supabase Error (Inflation):', inflationRes.error);
      } else {
        const sortedData = (inflationRes.data || []).reverse();
        setInflationData(sortedData);
      }

      if (livingStandardsRes.error) {
        console.error('Supabase Error (Living Standards):', livingStandardsRes.error);
      } else {
        setLivingStandardsData(livingStandardsRes.data || []);
      }

      // Market Data handling removed

      if (tuikRes && tuikRes.data) {
        setInflationSummary(tuikRes.data);
      }

      if (housingRes && housingRes.data) {
        setHousingSummary(housingRes.data);
      }

      if (autoRes && autoRes.data) {
        setAutoSummary(autoRes.data);
      }
    } catch (err) {
      console.error('Exception fetching data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshMarketData(true); // Refresh context data silently (or not)
    fetchData(); // Refresh local data
  }, [refreshMarketData]);

  // Format Time for "Son Güncelleme"
  const now = new Date();
  const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  const getMonthName = (dateStr: string) => {
    try {
      if (!dateStr) return '';
      return new Date(dateStr).toLocaleString('tr-TR', { month: 'long' });
    } catch {
      return '';
    }
  };

  // Helper to find market item by ID or Symbol
  // Assuming IDs: 1=USD, 2=EUR, 3=Gold, 4=BIST based on markets.tsx
  const getItem = (id: number) => marketData.find(m => m.id === id);
  const usdItem = getItem(1);
  const eurItem = getItem(2);
  const goldItem = getItem(3);
  const bistItem = getItem(4);

  return (
    <SafeAreaView className="flex-1 bg-[#0B1121]" edges={['left', 'right', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#0B1121" />

      <ScrollView
        className="flex-1 px-5 pt-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
      >
        {/* --- Announcement Banner --- */}
        <AnnouncementBanner />

        {/* --- Summary Cards (Horizontal Scroll) --- */}

        {/* --- Summary Cards (Horizontal Scroll) --- */}
        <View className="mb-8">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 20 }}
          >
            <MarketCard
              title="Dolar/TL"
              value={usdItem ? `${usdItem.price.toFixed(2).replace('.', ',')}` : '...'}
              icon={DollarSign}
              trend={usdItem && usdItem.change_rate < 0 ? 'down' : 'up'}
              loading={loading}
              percentage={usdItem ? `${Math.abs(usdItem.change_rate).toFixed(2)}%` : ''}
              showPercentage={!!usdItem}
              iconColor="#22c55e"
            />
            <MarketCard
              title="Euro/TL"
              value={eurItem ? `${eurItem.price.toFixed(2).replace('.', ',')}` : '...'}
              icon={Euro}
              trend={eurItem && eurItem.change_rate < 0 ? 'down' : 'up'}
              loading={loading}
              percentage={eurItem ? `${Math.abs(eurItem.change_rate).toFixed(2)}%` : ''}
              showPercentage={!!eurItem}
              iconColor="#3b82f6"
            />
            <MarketCard
              title="Altın (Gr)"
              value={goldItem ? `${goldItem.price.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}` : '...'}
              icon={Coins}
              trend={goldItem && goldItem.change_rate < 0 ? 'down' : 'up'}
              loading={loading}
              percentage={goldItem ? `${Math.abs(goldItem.change_rate).toFixed(2)}%` : ''}
              showPercentage={!!goldItem}
              iconColor="#fbbf24"
            />
            <MarketCard
              title="BIST 100"
              value={bistItem ? `${bistItem.price.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}` : '...'}
              icon={BarChart3}
              trend={bistItem && bistItem.change_rate < 0 ? 'down' : 'up'}
              loading={loading}
              percentage={bistItem ? `${Math.abs(bistItem.change_rate).toFixed(2)}%` : ''}
              showPercentage={!!bistItem}
              iconColor={bistItem && bistItem.change_rate < 0 ? '#f87171' : '#4ade80'}
            />
          </ScrollView>
        </View>

        {/* --- Macro Indicators Section --- */}
        <Text className="text-white text-lg font-bold mb-3">Makro Göstergeler</Text>

        {/* Large Card: Inflation */}
        <View className="bg-[#151C2F] rounded-3xl p-5 mb-4 border border-slate-800/50">
          <View className="flex-row items-center gap-2 mb-2">
            <TrendingUp size={16} color="#94a3b8" />
            <Text className="text-slate-400 text-sm font-medium">Yıllık Enflasyon</Text>
          </View>

          <View className="flex-row justify-between items-center">
            <View>
              {!inflationSummary ? (
                // Skeleton Loading
                <View>
                  <Skeleton><View className="h-10 w-32 bg-slate-800 rounded-md mb-2" /></Skeleton>
                  <Skeleton><View className="h-4 w-24 bg-slate-800 rounded-md" /></Skeleton>
                </View>
              ) : (
                <View>
                  <Text className="text-white text-4xl font-bold mb-2">
                    %{inflationSummary.rate.toFixed(1)}
                  </Text>

                  {/* Inverted Logic: Inflation UP -> RED (Bad), DOWN -> GREEN (Good) */}
                  <View className={`flex-row items-center gap-1 self-start px-1.5 py-0.5 rounded ${inflationSummary.direction === 'up' ? 'bg-red-500/20' : inflationSummary.direction === 'down' ? 'bg-green-500/20' : 'bg-slate-700/20'}`}>
                    {inflationSummary.direction === 'up' ? (
                      <TrendingUp size={12} color="#ef4444" />
                    ) : inflationSummary.direction === 'down' ? (
                      <TrendingDown size={12} color="#22c55e" />
                    ) : null}
                    <Text className={`${inflationSummary.direction === 'up' ? 'text-red-400' : inflationSummary.direction === 'down' ? 'text-green-400' : 'text-slate-400'} text-xs font-bold`}>
                      {inflationSummary.direction === 'up' ? '+' : ''}{inflationSummary.change} puan
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Simple decorative chart line */}
            <View className="h-10 w-24">
              <ArrowUpRight size={32} color="#3b82f6" style={{ alignSelf: 'flex-end', opacity: 0.8 }} />
            </View>
          </View>
        </View>

        {/* Row of 2 Small Cards */}
        <View className="flex-row justify-between mb-8">
          {/* Housing Sales */}
          <View className="w-[48%] bg-[#151C2F] rounded-3xl p-3 border border-slate-800/50 justify-between">
            <View className="flex-row justify-between items-start mb-2">
              <View className="bg-purple-500/20 w-8 h-8 rounded-lg items-center justify-center">
                <Building2 size={18} color="#a855f7" />
              </View>
              {housingSummary && (
                <Text className="text-slate-500 text-[10px] font-medium mt-1">
                  {getMonthName(housingSummary.reference_date)}
                </Text>
              )}
            </View>
            <Text className="text-slate-400 text-xs mb-1 font-medium">Konut Satış</Text>

            {!housingSummary ? (
              // Skeleton
              <View>
                <Skeleton><View className="h-8 w-24 bg-slate-800 rounded-md mb-2" /></Skeleton>
                <Skeleton><View className="h-4 w-16 bg-slate-800 rounded-md" /></Skeleton>
              </View>
            ) : (
              <View className="flex-row items-center gap-1.5 flex-wrap">
                <Text className="text-white text-xl font-bold tracking-tighter">
                  {housingSummary.total_sales.toLocaleString('tr-TR')}
                </Text>
                <View className={`px-1.5 py-0.5 rounded-full ${housingSummary.direction === 'up' ? 'bg-green-500/20' : housingSummary.direction === 'down' ? 'bg-red-500/20' : 'bg-slate-700/20'}`}>
                  <View className="flex-row items-center gap-0.5">
                    {housingSummary.direction === 'up' ? (
                      <TrendingUp size={10} color="#22c55e" />
                    ) : housingSummary.direction === 'down' ? (
                      <TrendingDown size={10} color="#ef4444" />
                    ) : null}
                    <Text className={`${housingSummary.direction === 'up' ? 'text-green-500' : housingSummary.direction === 'down' ? 'text-red-500' : 'text-slate-400'} text-[10px] font-bold`}>
                      %{housingSummary.percent_change}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Auto Sales */}
          <View className="w-[48%] bg-[#151C2F] rounded-3xl p-3 border border-slate-800/50 justify-between">
            <View className="flex-row justify-between items-start mb-2">
              <View className="bg-sky-500/20 w-8 h-8 rounded-lg items-center justify-center">
                <Car size={18} color="#0ea5e9" />
              </View>
              {autoSummary && (
                <Text className="text-slate-500 text-[10px] font-medium mt-1">
                  {getMonthName(autoSummary.reference_date)}
                </Text>
              )}
            </View>
            <Text className="text-slate-400 text-xs mb-1 font-medium">Otomobil Satış</Text>

            {!autoSummary ? (
              // Skeleton
              <View>
                <Skeleton><View className="h-8 w-24 bg-slate-800 rounded-md mb-2" /></Skeleton>
                <Skeleton><View className="h-4 w-16 bg-slate-800 rounded-md" /></Skeleton>
              </View>
            ) : (
              <View className="flex-row items-center gap-1.5 flex-wrap">
                <Text className="text-white text-xl font-bold tracking-tighter">
                  {autoSummary.total_sales.toLocaleString('tr-TR')}
                </Text>
                <View className={`px-1.5 py-0.5 rounded-full ${autoSummary.direction === 'up' ? 'bg-green-500/20' : autoSummary.direction === 'down' ? 'bg-red-500/20' : 'bg-slate-700/20'}`}>
                  <View className="flex-row items-center gap-0.5">
                    {autoSummary.direction === 'up' ? (
                      <TrendingUp size={10} color="#22c55e" />
                    ) : autoSummary.direction === 'down' ? (
                      <TrendingDown size={10} color="#ef4444" />
                    ) : null}
                    <Text className={`${autoSummary.direction === 'up' ? 'text-green-500' : autoSummary.direction === 'down' ? 'text-red-500' : 'text-slate-400'} text-[10px] font-bold`}>
                      %{autoSummary.percent_change}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* --- Advanced Inflation Chart --- */}


        <View className="mb-24">
          <InflationChart data={inflationData} loading={loading} />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function MarketCard({
  icon: Icon,
  title,
  value,
  loading,
  trend,
  percentage,
  showPercentage,
  iconColor
}: {
  icon: React.ElementType,
  title: string,
  value: string,
  loading: boolean,
  trend: 'up' | 'down' | 'neutral',
  percentage?: string,
  showPercentage: boolean,
  iconColor: string
}) {

  return (
    <View className="bg-[#151C2F] p-4 rounded-3xl w-36 mr-4 border border-slate-800/50 justify-between h-36">
      <View>
        <View className="flex-row items-center gap-2 mb-3">
          <Icon size={18} color={iconColor} />
          <Text className="text-slate-400 text-xs font-medium" numberOfLines={1}>{title}</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="small" color="#94a3b8" />
        ) : (
          <Text className="text-white text-2xl font-bold tracking-tight">{value}</Text>
        )}
      </View>

      {showPercentage && percentage && (
        <View className={`self-start px-2 py-0.5 rounded-full ${trend === 'up' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
          <View className="flex-row items-center gap-1">
            {trend === 'up' ? (
              <TrendingUp size={10} color="#22c55e" />
            ) : trend === 'down' ? (
              <TrendingDown size={10} color="#ef4444" />
            ) : null}
            <Text className={`${trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-slate-400'} text-xs font-bold`}>{percentage}</Text>
          </View>
        </View>
      )}
    </View>
  );
}
