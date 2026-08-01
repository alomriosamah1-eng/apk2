import { useEffect, useState } from 'react';
import { Stack, Redirect } from 'expo-router';
import { useTheme } from '@ui/providers/ThemeProvider';
import { useSession } from '@ui/providers/SessionProvider';
import { DIContainer } from '@core/di/container';
import { GetVaultsUseCase } from '@domain/usecases/vault/GetVaultsUseCase';

export default function AppLayout() {
  const { colors } = useTheme();
  const { isUnlocked, activeVaultId } = useSession();
  const [activeVaultLocked, setActiveVaultLocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!isUnlocked || !activeVaultId) return;
    const getVaults = DIContainer.resolve<GetVaultsUseCase>('GetVaultsUseCase');
    (async () => {
      const result = await getVaults.execute();
      if (cancelled) return;
      const vault = result.success ? result.data.find((v) => v.id === activeVaultId) : undefined;
      setActiveVaultLocked(vault ? vault.isLocked : true);
    })();
    return () => {
      cancelled = true;
    };
  }, [isUnlocked, activeVaultId]);

  if (!isUnlocked || activeVaultLocked) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
        animationDuration: 200,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      <Stack.Screen name="modals" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
