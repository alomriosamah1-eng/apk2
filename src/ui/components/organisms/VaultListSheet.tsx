import { useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing, borderRadius, elevations } from '@core/theme';
import { Typography } from '@ui/components/atoms/Typography';
import { Icon } from '@ui/components/atoms/Icon';
import { useVaults } from '@ui/hooks/useVaults';
import { Vault } from '@domain/entities/Vault';

interface VaultListSheetProps {
  visible: boolean;
  onClose: () => void;
}

const VAULT_ICONS: Record<string, keyof typeof import('@expo/vector-icons').MaterialCommunityIcons.glyphMap> = {
  'shield-lock': 'shield-lock',
  safe: 'safe',
  lock: 'lock',
  security: 'security',
  'shield-key': 'shield-key',
  'key-variant': 'key-variant',
  'safe-square': 'safe-square',
  'lock-pattern': 'lock-pattern',
};

export default function VaultListSheet({ visible, onClose }: VaultListSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { vaults } = useVaults();

  const handleVaultPress = useCallback((vault: Vault) => {
    onClose();
    router.push({ pathname: '/(auth)/login', params: { id: vault.id } });
  }, [onClose]);

  const handleCreateVault = useCallback(() => {
    onClose();
    router.push('/(auth)/create-vault');
  }, [onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.handle} />
          <Typography variant="titleMedium" style={styles.title}>{t('vault.title')}</Typography>

          {vaults.length === 0 ? (
            <View style={styles.empty}>
              <Icon name="shield-off" size={40} color={colors.onSurfaceVariant} />
              <Typography color={colors.onSurfaceVariant}>{t('vault.empty')}</Typography>
            </View>
          ) : (
            <View style={styles.list}>
              {vaults.map((vault) => {
                const iconName = VAULT_ICONS[vault.icon] || 'shield-lock';
                return (
                  <TouchableOpacity
                    key={vault.id}
                    onPress={() => handleVaultPress(vault)}
                    style={[styles.vaultItem, { borderBottomColor: colors.outlineVariant }]}
                  >
                    <View style={[styles.vaultIcon, { backgroundColor: vault.color + '20' }]}>
                      <Icon name={iconName} size={22} color={vault.color} />
                    </View>
                    <View style={styles.vaultInfo}>
                      <Typography variant="bodyMedium">{vault.name}</Typography>
                      <Typography variant="bodySmall" color={colors.onSurfaceVariant}>
                        {vault.isLocked ? t('vault.locked') : t('vault.unlocked')} · {t('vault.itemsCount', { count: vault.itemCount })}
                      </Typography>
                    </View>
                    <Icon name="chevron-left" size={20} color={colors.onSurfaceVariant} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <TouchableOpacity
            onPress={handleCreateVault}
            style={[styles.createBtn, { backgroundColor: colors.primary }]}
          >
            <Icon name="plus" size={20} color={colors.onPrimary} />
            <Typography variant="bodyMedium" color={colors.onPrimary}>{t('vault.create')}</Typography>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    maxHeight: '70%',
    ...elevations[8],
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CAC4D0',
    alignSelf: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  list: {
    gap: spacing.xs,
  },
  vaultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  vaultIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vaultInfo: {
    flex: 1,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
  },
});
