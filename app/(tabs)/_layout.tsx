import { Tabs } from 'expo-router';
import { BarChart3, Building, Car, House } from 'lucide-react-native';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import TabBarBackground from '@/components/ui/tab-bar-background'; // Note: check file case in directory
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            backgroundColor: '#0F172A',
            borderTopColor: '#1E293B',
          },
          default: {
            backgroundColor: '#0F172A',
            borderTopColor: '#1E293B',
          },
        }),
        tabBarActiveTintColor: '#38bdf8', // sky-400
        tabBarInactiveTintColor: '#94a3b8', // slate-400
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ana Sayfa',
          tabBarIcon: ({ color }) => <House size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="markets"
        options={{
          title: 'Piyasalar',
          tabBarIcon: ({ color }) => <BarChart3 size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="real-estate"
        options={{
          title: 'Emlak',
          tabBarIcon: ({ color }) => <Building size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="auto"
        options={{
          title: 'Otomobil',
          tabBarIcon: ({ color }) => <Car size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="purchasing-power"
        options={{
          href: null, // Hide from tab bar
        }}
      />
    </Tabs>
  );
}
