import { memo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@ui/providers/ThemeProvider';
import { Typography } from './Typography';
import { Button } from './Button';
import { Icon } from './Icon';

/** Props for the {@link ErrorView} component. */
interface ErrorViewProps {
  message?: string;
  onRetry?: () => void;
}

function ErrorViewComponent({ message = 'Something went wrong', onRetry }: ErrorViewProps) {
  const { colors } = useTheme();

  const handleRetry = useCallback(() => {
    onRetry?.();
  }, [onRetry]);

  return (
    <View
      style={styles.container}
      accessibilityRole="alert"
      accessibilityLabel={`Error: ${message}`}
    >
      <Icon name="alert-circle-outline" size={48} color={colors.error} />
      <Typography variant="bodyLarge" color={colors.error} style={styles.message}>
        {message}
      </Typography>
      {onRetry && (
        <Button title="Try Again" onPress={handleRetry} variant="ghost" />
      )}
    </View>
  );
}

/** An error display with a message and an optional retry button. */
export const ErrorView = memo(ErrorViewComponent);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  message: {
    marginTop: 12,
    textAlign: 'center',
  },
});
