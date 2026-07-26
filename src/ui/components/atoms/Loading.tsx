import { memo } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '@ui/providers/ThemeProvider';
import { Typography } from './Typography';

/** Props for the {@link Loading} component. */
interface LoadingProps {
  message?: string;
  size?: 'small' | 'large';
  fullScreen?: boolean;
}

function LoadingComponent({ message, size = 'large', fullScreen = false }: LoadingProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[styles.container, fullScreen && styles.fullScreen]}
      accessibilityRole="progressbar"
      accessibilityLabel={message ?? 'Loading'}
    >
      <ActivityIndicator size={size} color={colors.primary} />
      {message && (
        <Typography variant="bodyMedium" color={colors.onSurfaceVariant} style={styles.message}>
          {message}
        </Typography>
      )}
    </View>
  );
}

/** A centered loading spinner with optional message and full-screen mode. */
export const Loading = memo(LoadingComponent);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fullScreen: {
    flex: 1,
  },
  message: {
    marginTop: 12,
  },
});
