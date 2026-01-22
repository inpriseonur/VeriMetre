import InflationChart from '@/components/InflationChart';
import { AutoSummary, getAutoSummary } from '@/lib/autoService';
import { getHousingSummary, HousingSummary } from '@/lib/housingService';
import { getTuikSummary, TuikSummary } from '@/lib/inflationService';
import { supabase } from '@/lib/supabase';
import { ExchangeRates, fetchExchangeRates } from '@/lib/tcmb';
import { ViewInflationCalculated, ViewLivingStandards } from '@/types/database';
import { ArrowUpRight, BarChart3, Building2, Car, Coins, DollarSign, Euro, TrendingDown, TrendingUp } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StatusBar, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inflationData, setInflationData] = useState<ViewInflationCalculated[]>([]);
  // Living standards data logic kept but not used in UI as per design request - kept for future use if needed
  const [livingStandardsData, setLivingStandardsData] = useState<ViewLivingStandards[]>([]);
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [inflationSummary, setInflationSummary] = useState<TuikSummary | null>(null);
  const [housingSummary, setHousingSummary] = useState<HousingSummary | null>(null);
  const [autoSummary, setAutoSummary] = useState<AutoSummary | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [inflationRes, livingStandardsRes, tcmbRes, tuikRes, housingRes, autoRes] = await Promise.all([
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
        fetchExchangeRates(),
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

      if (tcmbRes) {
        setRates(tcmbRes);
      }

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
    fetchData();
  }, []);

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

  return (
    <SafeAreaView className="flex-1 bg-[#0B1121]">
      <StatusBar barStyle="light-content" backgroundColor="#0B1121" />

      <ScrollView
        className="flex-1 px-5 pt-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
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

        {/* --- Market Summary Only Header --- */}
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-white text-lg font-bold">Piyasa Özeti</Text>
          <Text className="text-blue-500 text-sm font-medium">Tümü</Text>
        </View>

        {/* --- Summary Cards (Horizontal Scroll) --- */}
        <View className="mb-8">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 20 }}
          >
            <MarketCard
              title="Dolar/TL"
              value={rates?.USD ? `${rates.USD.price.toFixed(2).replace('.', ',')}` : '...'}
              icon={DollarSign}
              trend={rates?.USD && rates.USD.rate < 0 ? 'down' : 'up'}
              loading={loading}
              percentage={rates?.USD ? `${Math.abs(rates.USD.rate).toFixed(2)}%` : ''}
              showPercentage={!!rates?.USD}
              iconColor="#22c55e"
            />
            <MarketCard
              title="Euro/TL"
              value={rates?.EUR ? `${rates.EUR.price.toFixed(2).replace('.', ',')}` : '...'}
              icon={Euro}
              trend={rates?.EUR && rates.EUR.rate < 0 ? 'down' : 'up'}
              loading={loading}
              percentage={rates?.EUR ? `${Math.abs(rates.EUR.rate).toFixed(2)}%` : ''}
              showPercentage={!!rates?.EUR}
              iconColor="#3b82f6"
            />
            <MarketCard
              title="Altın (Gr)"
              value={rates?.Gold ? `${rates.Gold.price.toLocaleString('tr-TR')}` : '...'}
              icon={Coins}
              trend={rates?.Gold && rates.Gold.rate < 0 ? 'down' : 'up'}
              loading={loading}
              percentage={rates?.Gold ? `${Math.abs(rates.Gold.rate).toFixed(2)}%` : ''}
              showPercentage={!!rates?.Gold}
              iconColor="#fbbf24"
            />
            <MarketCard
              title="BIST 100"
              value={rates?.BIST100 ? `${rates.BIST100.price}` : '...'}
              icon={BarChart3}
              trend={rates?.BIST100 && rates.BIST100.rate < 0 ? 'down' : 'up'}
              loading={loading}
              percentage={rates?.BIST100 ? `${Math.abs(rates.BIST100.rate).toFixed(2)}%` : ''}
              showPercentage={true}
              iconColor={rates?.BIST100 && rates.BIST100.rate < 0 ? '#f87171' : '#4ade80'}
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
                  <View className="h-10 w-32 bg-slate-800 rounded-md mb-2 animate-pulse" />
                  <View className="h-4 w-24 bg-slate-800 rounded-md animate-pulse" />
                </View>
              ) : (
                <View>
                  <Text className="text-white text-4xl font-bold mb-1">
                    %{inflationSummary.rate.toFixed(1)}
                  </Text>
                  <Text className={`text-sm font-medium ${inflationSummary.direction === 'up' ? 'text-green-500' : inflationSummary.direction === 'down' ? 'text-red-500' : 'text-slate-400'}`}>
                    {inflationSummary.direction === 'up' ? '+' : ''}{inflationSummary.change}% <Text className="text-slate-500">geçen aya göre</Text>
                  </Text>
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
        <View className="flex-row gap-4 mb-8">
          {/* Housing Sales */}
          <View className="flex-1 bg-[#151C2F] rounded-3xl p-4 border border-slate-800/50">
            <View className="flex-row justify-between items-start mb-3">
              <View className="bg-purple-500/20 w-10 h-10 rounded-xl items-center justify-center">
                <Building2 size={20} color="#a855f7" />
              </View>
              {housingSummary && (
                <Text className="text-slate-500 text-[10px] font-medium mt-1">
                  {getMonthName(housingSummary.reference_date)}
                </Text>
              )}
            </View>
            <Text className="text-slate-400 text-sm mb-1">Konut Satış</Text>

            {!housingSummary ? (
              // Skeleton
              <View>
                <View className="h-8 w-24 bg-slate-800 rounded-md mb-2 animate-pulse" />
                <View className="h-4 w-16 bg-slate-800 rounded-md animate-pulse" />
              </View>
            ) : (
              <View className="flex-row items-baseline gap-2">
                <Text className="text-white text-2xl font-bold">
                  {housingSummary.total_sales.toLocaleString('tr-TR')}
                </Text>
                <Text className={`${housingSummary.direction === 'up' ? 'text-green-500' : housingSummary.direction === 'down' ? 'text-red-500' : 'text-slate-400'} text-xs font-bold`}>
                  {housingSummary.direction === 'up' ? '+' : ''}%{housingSummary.percent_change}
                </Text>
              </View>
            )}
          </View>

          {/* Auto Sales */}
          <View className="flex-1 bg-[#151C2F] rounded-3xl p-4 border border-slate-800/50">
            <View className="flex-row justify-between items-start mb-3">
              <View className="bg-sky-500/20 w-10 h-10 rounded-xl items-center justify-center">
                <Car size={20} color="#0ea5e9" />
              </View>
              {autoSummary && (
                <Text className="text-slate-500 text-[10px] font-medium mt-1">
                  {getMonthName(autoSummary.reference_date)}
                </Text>
              )}
            </View>
            <Text className="text-slate-400 text-sm mb-1">Otomobil Satış</Text>

            {!autoSummary ? (
              // Skeleton
              <View>
                <View className="h-8 w-24 bg-slate-800 rounded-md mb-2 animate-pulse" />
                <View className="h-4 w-16 bg-slate-800 rounded-md animate-pulse" />
              </View>
            ) : (
              <View className="flex-row items-baseline gap-2">
                <Text className="text-white text-2xl font-bold">
                  {autoSummary.total_sales.toLocaleString('tr-TR')}
                </Text>
                <Text className={`${autoSummary.direction === 'up' ? 'text-green-500' : autoSummary.direction === 'down' ? 'text-red-500' : 'text-slate-400'} text-xs font-bold`}>
                  {autoSummary.direction === 'up' ? '+' : ''}%{autoSummary.percent_change}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* --- Advanced Inflation Chart --- */}
        <View className="mb-6 flex-row justify-between items-center">
          <Text className="text-white text-lg font-bold">Enflasyon Trendi</Text>
        </View>

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
            {trend === 'up' ? <TrendingUp size={10} color={trend === 'up' ? '#22c55e' : '#ef4444'} /> : <TrendingDown size={10} color={trend === 'up' ? '#22c55e' : '#ef4444'} />}
            <Text className={`${trend === 'up' ? 'text-green-500' : 'text-red-500'} text-xs font-bold`}>{percentage}</Text>
          </View>
        </View>
      )}
    </View>
  );
}
