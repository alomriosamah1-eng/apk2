import { Stack } from 'expo-router';
import { useTheme } from '@ui/providers/ThemeProvider';

export default function AppLayout() {
  const { colors } = useTheme();

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
