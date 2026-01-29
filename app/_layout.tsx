import '../global.css';

import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

// export const unstable_settings = {
//   anchor: '(tabs)',
// };


import { usePushNotifications } from '@/hooks/usePushNotifications';
import { AuthProvider } from '@/providers/AuthProvider';
import { MarketProvider } from '@/providers/MarketProvider';
import { LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';

LogBox.ignoreLogs(['Unable to activate keep awake']);

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Call immediately at top level
  usePushNotifications();

  useEffect(() => {
    // Lock to portrait by default
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <MarketProvider>
          <ThemeProvider value={DarkTheme}>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              <Stack.Screen name="login-modal" options={{ presentation: 'modal', headerShown: false }} />
              <Stack.Screen name="profile-modal" options={{ presentation: 'modal', headerShown: false }} />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </MarketProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
