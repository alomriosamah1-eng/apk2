import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { ScreenLayout } from '@ui/components/organisms/ScreenLayout';
import { Typography } from '@ui/components/atoms/Typography';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Icon } from '@ui/components/atoms/Icon';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing } from '@core/theme';
import { DIContainer } from '@core/di/container';
import { ActivityLogRepositoryImpl } from '@data/repositories/ActivityLogRepositoryImpl';
import { ActivityLogEntry } from '@domain/entities/ActivityLog';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const ACTION_ICONS: Record<string, IconName> = {
  create_vault: 'shield-plus',
  delete_vault: 'shield-off',
  lock_vault: 'lock',
  unlock_vault: 'lock-open-variant',
  add_item: 'file-plus',
  delete_item: 'file-remove',
  login: 'login',
  login_failed: 'alert-circle',
  create_note: 'note-plus',
  edit_note: 'note-edit',
  delete_note: 'note-remove',
  add_password: 'key-plus',
  edit_password: 'key',
  delete_password: 'key-remove',
};

export default function ActivityLogModal() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);

  const loadLogs = useCallback(async () => {
    const repo = DIContainer.resolve<ActivityLogRepositoryImpl>('ActivityLogRepository');
    const result = await repo.getRecent(100);
    if (result.success) {
      setLogs(result.data);
    }
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const handleClear = useCallback(() => {
    Alert.alert(t('activityLog.clear'), t('activityLog.clearConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const repo = DIContainer.resolve<ActivityLogRepositoryImpl>('ActivityLogRepository');
          const result = await repo.clear();
          if (result.success) setLogs([]);
        },
      },
    ]);
  }, []);

  return (
    <ScreenLayout title={t('activityLog.title')} showBack>
      <ScrollView contentContainerStyle={[styles.list, { flexGrow: 1 }]}>
        {logs.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="history" size={48} color={colors.onSurfaceVariant} />
            <Typography color={colors.onSurfaceVariant}>{t('activityLog.empty')}</Typography>
          </View>
        ) : (
          logs.map((log) => (
            <View key={log.id} style={[styles.item, { borderBottomColor: colors.outlineVariant }]}>
              <Icon name={ACTION_ICONS[log.action] || 'information-outline'} size={20} color={colors.primary} />
              <Typography style={styles.itemText}>{log.action}</Typography>
              <Typography variant="labelSmall" color={colors.onSurfaceVariant}>
                {new Date(log.createdAt).toLocaleString('ar')}
              </Typography>
            </View>
          ))
        )}
      </ScrollView>
      {logs.length > 0 && (
        <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
          <Typography color={colors.error}>{t('activityLog.clear')}</Typography>
        </TouchableOpacity>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  itemText: { flex: 1 },
  clearBtn: { alignItems: 'center', padding: spacing.lg },
});
