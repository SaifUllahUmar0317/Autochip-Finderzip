import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AppProvider, useApp } from '@/context/AppContext';
import { ActivityIndicator, Image, Platform, Text, View } from 'react-native';
import colors from '@/constants/colors';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { ready, error, colors: theme } = useApp();
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.dark.background, alignItems: 'center', justifyContent: 'center', gap: 18 }}>
        <Image source={require('../assets/images/icon.png')} style={{ width: 88, height: 88, borderRadius: 24 }} />
        <Text style={{ color: colors.dark.foreground, fontSize: 23, fontWeight: '700' }}>AutoChip Finder</Text>
        <Text style={{ color: colors.dark.mutedForeground, fontSize: 13 }}>Preparing your offline library</Text>
        <ActivityIndicator color={colors.dark.cyan} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 }}>
        <Text style={{ color: theme.foreground, fontSize: 20, fontWeight: '700' }}>
          {Platform.OS === 'web' ? 'Open the mobile preview' : 'Library unavailable'}
        </Text>
        <Text style={{ color: theme.mutedForeground, textAlign: 'center', lineHeight: 21 }}>{error}</Text>
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="tool/[tool]" />
      <Stack.Screen name="module/[id]" />
      <Stack.Screen name="search" />
      <Stack.Screen name="import" />
      <Stack.Screen name="viewer" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="history" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView>
            <KeyboardProvider>
              <AppProvider>
                <RootLayoutNav />
              </AppProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
