import { Stack } from 'expo-router';
import { useTheme } from '@ui/providers/ThemeProvider';

export default function ModalsLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'modal',
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_bottom',
        animationDuration: 250,
      }}
    >
      <Stack.Screen name="file-preview" />
      <Stack.Screen name="create-folder" />
      <Stack.Screen name="activity-log" />
    </Stack>
  );
}
