import InflationChart from '@/components/InflationChart';
import { supabase } from '@/lib/supabase';
import { ExchangeRates, fetchExchangeRates } from '@/lib/tcmb';
import { ViewInflationCalculated, ViewLivingStandards } from '@/types/database';
import { Banknote, Coins, Euro, LineChart, TrendingUp } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StatusBar, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inflationData, setInflationData] = useState<ViewInflationCalculated[]>([]);
  const [livingStandardsData, setLivingStandardsData] = useState<ViewLivingStandards[]>([]);
  const [rates, setRates] = useState<ExchangeRates | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [inflationRes, livingStandardsRes, tcmbRes] = await Promise.all([
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
        fetchExchangeRates()
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

  return (
    <SafeAreaView className="flex-1 bg-slate-900">
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      <ScrollView
        className="flex-1 px-4 pt-6"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
      >
        <Text className="text-white text-3xl font-bold mb-2">VeriMetre</Text>
        <Text className="text-slate-400 text-base mb-6">Türkiye Ekonomik Göstergeleri</Text>

        {/* --- Summary Cards (Horizontal Scroll) --- */}
        <View className="mb-8 pl-0">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 20 }}
          >
            <SummaryCard
              title="Dolar"
              value={rates?.USD ? `₺${rates.USD.toFixed(2)}` : '...'}
              icon={Banknote}
              trend="up"
              loading={loading}
              subValue={rates?.Date}
            />
            <SummaryCard
              title="Euro"
              value={rates?.EUR ? `₺${rates.EUR.toFixed(2)}` : '...'}
              icon={Euro}
              trend="down"
              loading={loading}
              subValue={rates?.Date}
            />
            <SummaryCard
              title="Gram Altın"
              value={rates?.Gold ? `₺${rates.Gold.toLocaleString('tr-TR')}` : '...'}
              icon={Coins}
              trend="up"
              loading={loading}
              subValue={rates?.Date}
            />
            <SummaryCard
              title="BIST 100"
              value={rates?.BIST100 ? `${rates.BIST100.price}` : '...'}
              icon={LineChart}
              trend={rates?.BIST100 && rates.BIST100.rate < 0 ? 'down' : 'up'}
              loading={loading}
              subValue={rates?.Date}
              // Pass custom color prop if needed, or rely on trend
              customColor={rates?.BIST100 && rates.BIST100.rate < 0 ? '#f87171' : '#4ade80'}
            />
          </ScrollView>
        </View>

        {/* --- Advanced Inflation Chart --- */}
        <View className="mb-24">
          <InflationChart data={inflationData} loading={loading} />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCard({ icon: Icon, title, value, subValue, loading, trend, customColor }: { icon: React.ElementType, title: string, value: string, subValue?: string, loading: boolean, trend: 'up' | 'down' | 'neutral', customColor?: string }) {
  // You might want to use trend logic later, for now we just show icons
  const trendIcon = trend === 'up' ? <TrendingUp size={16} color="#4ade80" /> : trend === 'down' ? <TrendingUp size={16} color="#f87171" className="rotate-180" /> : null;

  // Dynamic color for BIST: If customColor is provided, use it for Icon and Text
  const activeColor = customColor || (title === 'Dolar' ? '#4ade80' : title === 'Euro' ? '#60a5fa' : '#fbbf24');

  return (
    <View className="bg-slate-800 p-3 rounded-xl w-32 mr-3 space-y-2 border border-slate-700">
      <View className="flex-row justify-between items-start">
        <View className="bg-slate-700/50 p-1.5 rounded-lg">
          <Icon size={20} color={activeColor} />
        </View>
      </View>
      <View>
        {/* Title removed as per user request */}
        {loading ? (
          <ActivityIndicator size="small" color="#94a3b8" className="mt-1 self-start" />
        ) : (
          <View className="flex-row items-baseline gap-1">
            <Text
              className="font-bold text-lg"
              style={{ color: customColor ? activeColor : 'white' }}
              numberOfLines={1}
            >
              {value}
            </Text>
          </View>
        )}
        {/* Date removed as per user request */}
      </View>
    </View>
  );
}
