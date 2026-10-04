import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
import { AnimatedSplashScreen } from '@/components/AnimatedSplashScreen';
import { PdfExtractor } from '@/components/PdfExtractor';
import colors from '@/constants/colors';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { ready, error, colors: theme } = useApp();
  const [splashFinished, setSplashFinished] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {error && splashFinished ? (
        <View style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 }}>
          <Text style={{ color: theme.foreground, fontSize: 20, fontWeight: '700' }}>
            {Platform.OS === 'web' ? 'Open the mobile preview' : 'Library unavailable'}
          </Text>
          <Text style={{ color: theme.mutedForeground, textAlign: 'center', lineHeight: 21 }}>{error}</Text>
        </View>
      ) : (
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
      )}

      {/* Headless offline PDF text extraction engine */}
      <PdfExtractor />

      {/* Modern Animated Splash Screen: runs on app opening and smoothly fades out */}
      {!splashFinished && (
        <AnimatedSplashScreen
          isReady={ready}
          onAnimationComplete={() => setSplashFinished(true)}
        />
      )}
    </View>
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
          <GestureHandlerRootView style={{ flex: 1 }}>
            <AppProvider>
              <RootLayoutNav />
            </AppProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
