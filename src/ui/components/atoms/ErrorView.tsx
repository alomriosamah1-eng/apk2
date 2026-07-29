import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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

function ErrorViewComponent({ message: _message, onRetry }: ErrorViewProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const message = _message ?? t('errors.general');

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
        <Button title={t('common.retry')} onPress={handleRetry} variant="ghost" />
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
