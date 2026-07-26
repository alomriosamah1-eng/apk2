import { memo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@ui/providers/ThemeProvider';
import { Typography } from './Typography';
import { Icon } from './Icon';
import { Button } from './Button';

/** Props for the {@link EmptyState} component. */
interface EmptyStateProps {
  icon?: keyof typeof import('@expo/vector-icons').MaterialCommunityIcons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

function EmptyStateComponent({
  icon = 'folder-open-outline',
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const { colors } = useTheme();

  const handleAction = useCallback(() => {
    onAction?.();
  }, [onAction]);

  return (
    <View
      style={styles.container}
      accessibilityRole="text"
      accessibilityLabel={`${title}. ${description ?? ''}`}
    >
      <Icon name={icon} size={64} color={colors.onSurfaceVariant} />
      <Typography variant="titleMedium" style={styles.title}>
        {title}
      </Typography>
      {description && (
        <Typography variant="bodyMedium" color={colors.onSurfaceVariant} style={styles.description}>
          {description}
        </Typography>
      )}
      {actionLabel && onAction && (
        <Button title={actionLabel} onPress={handleAction} variant="glass" style={styles.action} />
      )}
    </View>
  );
}

/** An empty-state placeholder with icon, title, description, and optional action button. */
export const EmptyState = memo(EmptyStateComponent);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    marginTop: 16,
    textAlign: 'center',
  },
  description: {
    marginTop: 8,
    textAlign: 'center',
  },
  action: {
    marginTop: 24,
  },
});
