import { Tabs } from 'expo-router';
import { BarChart3, Building, Car, House, PieChart } from 'lucide-react-native';
import React from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import TabBarBackground from '@/components/ui/tab-bar-background'; // Note: check file case in directory
import { useColorScheme } from '@/hooks/use-color-scheme';

const PortfolioTabButton = ({ children, onPress }: any) => (
  <TouchableOpacity
    style={{
      top: -20, // Raise the button
      justifyContent: 'center',
      alignItems: 'center',
      ...styles.shadow,
    }}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <View
      style={{
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#F97316', // Orange
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {children}
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#F97316',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10, // Softer shadow
    elevation: 5,
  },
});

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

      {/* Portfolio Tab (Center - Raised) */}
      <Tabs.Screen
        name="portfolio"
        options={{
          title: '', // No text label for this button ideally, or handle in component
          tabBarIcon: ({ focused }) => (
            <PieChart size={30} color="white" />
          ),
          tabBarButton: (props) => (
            <PortfolioTabButton {...props} />
          ),
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

