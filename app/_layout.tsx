import '../global.css';

import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

// export const unstable_settings = {
//   anchor: '(tabs)',
// };


import { LogBox } from 'react-native';

LogBox.ignoreLogs(['Unable to activate keep awake']);

import LoginScreen from '@/app/login';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Separate component to use the Auth Hook
function InitialLayout() {
  const { session, isLoading, isGuest } = useAuth();
  const colorScheme = useColorScheme();

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-[#0B1121]">
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  // If not logged in AND not guest, show Login Screen
  if (!session && !isGuest) {
    return <LoginScreen />;
  }

  return (
    <ThemeProvider value={DarkTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <InitialLayout />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
