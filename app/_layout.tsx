import { useEffect, useState, useCallback } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { Cairo_400Regular, Cairo_500Medium, Cairo_600SemiBold, Cairo_700Bold } from '@expo-google-fonts/cairo';
import { ThemeProvider, useTheme } from '@ui/providers/ThemeProvider';
import { SessionProvider } from '@ui/providers/SessionProvider';
import '@core/i18n';
import { registerDependencies } from '@core/di/register';
import { DatabaseService } from '@data/database/DatabaseService';
import { MigrationRunner } from '@data/database/MigrationRunner';
import { DIContainer } from '@core/di/container';
import { Loading } from '@ui/components/atoms/Loading';
import { logger } from '@core/utils';
import { preventScreenCaptureAsync } from 'expo-screen-capture';

SplashScreen.preventAutoHideAsync();

function RootLayoutInner() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.background },
        animationDuration: 200,
      }}
    >
      <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
      <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
    </Stack>
  );
}

function SplashLoading() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Loading fullScreen />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  const onLayoutRootView = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    async function init() {
      try {
        await Font.loadAsync({
          Cairo: Cairo_400Regular,
          Cairo_500Medium,
          Cairo_600SemiBold,
          Cairo_700Bold,
        });

        registerDependencies();
        const db = DIContainer.resolve<DatabaseService>('DatabaseService');
        await db.initialize();
        const runner = DIContainer.resolve<MigrationRunner>('MigrationRunner');
        await runner.run(db);
        const ok = await db.integrityCheck();
        if (!ok) logger.warn('Database integrity check failed');
        await preventScreenCaptureAsync();
        logger.info('App initialized successfully');
      } catch (error) {
        logger.error('App initialization failed', error as Error);
      } finally {
        setReady(true);
      }
    }
    init();
  }, []);

  if (!ready) {
    return <SplashLoading />;
  }

  return (
    <GestureHandlerRootView style={styles.root} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SessionProvider>
            <RootLayoutInner />
          </SessionProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
