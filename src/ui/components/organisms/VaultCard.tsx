import { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Vault } from '@domain/entities/Vault';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing, borderRadius } from '@core/theme';
import { formatFileSize } from '@core/utils/file';
import { Card } from '@ui/components/atoms/Card';
import { Typography } from '@ui/components/atoms/Typography';
import { Icon } from '@ui/components/atoms/Icon';

interface VaultCardProps {
  vault: Vault;
  onPress?: () => void;
}

function VaultCardComponent({ vault, onPress }: VaultCardProps) {
  const { colors } = useTheme();

  return (
    <Card variant="glass" onPress={onPress} padding={spacing.lg}>
      <View style={styles.row}>
        <View style={[styles.iconContainer, { backgroundColor: vault.color + '20' }]}>
          <Icon
            name={vault.isLocked ? 'shield-lock' : 'shield-lock-open'}
            size={28}
            color={vault.color}
          />
        </View>
        <View style={styles.info}>
          <Typography variant="titleMedium">{vault.name}</Typography>
          <Typography variant="bodySmall" color={colors.onSurfaceVariant}>
            {vault.itemCount} items {formatFileSize(vault.totalSize)}
          </Typography>
        </View>
        <View
          style={[styles.statusDot, { backgroundColor: vault.isLocked ? colors.error : colors.success }]}
          accessibilityLabel={vault.isLocked ? 'Locked' : 'Unlocked'}
        />
      </View>
    </Card>
  );
}

export const VaultCard = memo(VaultCardComponent);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  info: {
    flex: 1,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: spacing.sm,
  },
});
