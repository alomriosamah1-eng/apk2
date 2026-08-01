import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing } from '@core/theme';
import { Typography } from '@ui/components/atoms/Typography';
import { Icon } from '@ui/components/atoms/Icon';

interface SelectionBarAction {
  icon: keyof typeof import('@expo/vector-icons').MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

interface SelectionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  actions: SelectionBarAction[];
}

export function SelectionBar({ selectedCount, onClearSelection, actions }: SelectionBarProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  if (selectedCount === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.primaryContainer }]}>
      <View style={styles.countContainer}>
        <Typography variant="bodyMedium" color={colors.onPrimaryContainer}>
          {selectedCount}
        </Typography>
      </View>
      <View style={styles.actions}>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.label}
            onPress={action.onPress}
            style={styles.actionBtn}
            accessibilityLabel={action.label}
          >
            <Icon
              name={action.icon}
              size={22}
              color={action.destructive ? colors.error : colors.onPrimaryContainer}
            />
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity onPress={onClearSelection} style={styles.closeBtn} accessibilityLabel={t('common.clearSelection')}>
        <Icon name="close" size={22} color={colors.onPrimaryContainer} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: 12,
  },
  countContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  actions: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
});
