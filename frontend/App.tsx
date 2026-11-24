import { DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SplashView } from './src/components/SplashView';
import { RootNavigator } from './src/navigation/RootNavigator';
import { shouldRetry } from './src/services/api';
import { watchAuthUser } from './src/services/auth';
import { useAuthStore } from './src/store/useAuthStore';
import { usePickerStore } from './src/store/usePickerStore';
import { colors } from './src/theme';
import { fontAssets } from './src/theme/fonts';

// Keep the native splash up until SplashView is on screen to take over.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    // Default is 3 retries even on a 404, which made error screens take ~7s to show up.
    queries: { retry: shouldRetry },
  },
});

const navTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
    primary: colors.link,
  },
};

export default function App() {
  // Update signed in user and clear saved data when account changes
  useEffect(() => {
    let previousUid = useAuthStore.getState().user?.uid;
    return watchAuthUser((user) => {
      if (previousUid !== user?.uid) {
        queryClient.clear();
        usePickerStore.getState().clear();
      }
      previousUid = user?.uid;
      useAuthStore.getState().setUser(user);
    });
  }, []);

  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const [splashDone, setSplashDone] = useState(false);
  const handleSplashFinish = useCallback(() => setSplashDone(true), []);

  // If a font fails, still open the app (in the system font) instead of hanging.
  const appReady = fontsLoaded || fontError != null;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        {/* Wait for fonts so text doesn't flash in the system font first. */}
        {appReady && (
          <NavigationContainer theme={navTheme}>
            <RootNavigator />
          </NavigationContainer>
        )}
        {!splashDone && (
          <SplashView ready={appReady} onFinish={handleSplashFinish} />
        )}
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
