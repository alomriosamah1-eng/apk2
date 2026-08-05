import { useCallback, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Pressable, BackHandler, Platform } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing, borderRadius, elevations } from '@core/theme';
import { Typography } from '@ui/components/atoms/Typography';
import { Icon } from '@ui/components/atoms/Icon';
import { useVaults } from '@ui/hooks/useVaults';
import { useSession } from '@ui/providers/SessionProvider';
import { useSnackbar } from '@ui/providers/SnackbarProvider';
import { importUnits, deleteImportedSource, type ImportUnitSource } from '@data/media/MediaStorage';

interface AddOptionsSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Active vault id; must be a real id (P0-3 fix, Recovery/02 §0.7). */
  vaultId?: string;
}

export default function AddOptionsSheet({ visible, onClose, vaultId }: AddOptionsSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { vaults } = useVaults();
  const { lock: lockSession } = useSession();
  const { show: showSnackbar } = useSnackbar();
  const [importing, setImporting] = useState(false);

  const getTargetVaultId = useCallback(() => {
    if (vaultId) return vaultId;
    const vault = vaults.find((v) => !v.isLocked);
    return vault?.id ?? 'default';
  }, [vaultId, vaults]);

  const importToVault = useCallback(async (pickerOptions?: DocumentPicker.DocumentPickerOptions): Promise<boolean> => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: true, ...pickerOptions });
      if (result.canceled || result.assets.length === 0) return false;
      const targetId = getTargetVaultId();
      // Unify on the shared bytes import engine (same path as the Media / Files
      // tabs): it normalizes audio mime, computes content hashes, and only
      // cleans up a source AFTER it was verified and persisted (never before).
      const sources: ImportUnitSource[] = result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name || 'file',
        mimeType: asset.mimeType || null,
        size: asset.size || 0,
      }));
      const report = await importUnits({
        vaultId: targetId,
        sources,
        dedupe: true,
        onSourceImported: async (src) => {
          await deleteImportedSource(src.uri).catch(() => {});
        },
      });
      if (report.imported === 0 && report.failed > 0) return false;
      return true;
    } catch (error) {
      showSnackbar(error instanceof Error ? error.message : t('common.error'));
      return false;
    }
  }, [getTargetVaultId, showSnackbar, t]);

  const pushWithVault = useCallback((path: string, extra?: Record<string, string>) => {
    const targetId = getTargetVaultId();
    router.push({ pathname: path, params: { vaultId: targetId, ...extra } });
  }, [getTargetVaultId]);

  const handleImportFile = useCallback(async () => {
    if (importing) return;
    onClose();
    setImporting(true);
    try {
      const ok = await importToVault();
      if (ok) pushWithVault('/(app)/(tabs)/files');
    } finally {
      setImporting(false);
    }
  }, [onClose, importToVault, pushWithVault, importing]);

  const handleImportPhoto = useCallback(async () => {
    if (importing) return;
    onClose();
    setImporting(true);
    try {
      const ok = await importToVault({ type: 'image/*' });
      if (ok) pushWithVault('/(app)/(tabs)/media');
    } finally {
      setImporting(false);
    }
  }, [onClose, importToVault, pushWithVault, importing]);

  const handleImportVideo = useCallback(async () => {
    if (importing) return;
    onClose();
    setImporting(true);
    try {
      const ok = await importToVault({ type: 'video/*' });
      if (ok) pushWithVault('/(app)/(tabs)/media');
    } finally {
      setImporting(false);
    }
  }, [onClose, importToVault, pushWithVault, importing]);

  const handleImportAudio = useCallback(async () => {
    if (importing) return;
    onClose();
    setImporting(true);
    try {
      // No mime filter: Android providers often label audio as octet-stream and
      // an `audio/*` filter would hide them. importUnits normalizes real audio
      // by extension, so all audio formats are reachable here.
      const ok = await importToVault();
      if (ok) pushWithVault('/(app)/(tabs)/media', { type: 'audio' });
    } finally {
      setImporting(false);
    }
  }, [onClose, importToVault, pushWithVault, importing]);

  const handleWriteNote = useCallback(() => {
    onClose();
    pushWithVault('/(app)/(tabs)/notes', { create: '1' });
  }, [onClose, pushWithVault]);

  const handleAddPassword = useCallback(() => {
    onClose();
    pushWithVault('/(app)/(tabs)/passwords');
  }, [onClose, pushWithVault]);

  const handleQuickExit = useCallback(() => {
    onClose();
    lockSession();
    if (Platform.OS === 'android') {
      BackHandler.exitApp();
    } else {
      router.replace('/(auth)/welcome');
    }
  }, [onClose, lockSession]);

  const options = [
    { icon: 'file-import' as const, labelKey: 'files.addFile', onPress: handleImportFile },
    { icon: 'image' as const, labelKey: 'media.photos', onPress: handleImportPhoto },
    { icon: 'video' as const, labelKey: 'media.videos', onPress: handleImportVideo },
    { icon: 'music' as const, labelKey: 'media.audio', onPress: handleImportAudio },
    { icon: 'note-text' as const, labelKey: 'notes.create', onPress: handleWriteNote },
    { icon: 'key' as const, labelKey: 'passwords.add', onPress: handleAddPassword },
    { icon: 'exit-run' as const, labelKey: 'settings.quickExit', onPress: handleQuickExit },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.handle} />
          <Typography variant="titleMedium" style={styles.title}>{t('common.add')}</Typography>
          <View style={styles.grid}>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt.labelKey}
                onPress={opt.onPress}
                style={[styles.optionItem, { backgroundColor: colors.surfaceVariant }]}
              >
                <View style={[styles.optionIcon, { backgroundColor: colors.primaryContainer }]}>
                  <Icon name={opt.icon} size={24} color={colors.primary} />
                </View>
                <Typography variant="bodySmall" style={styles.optionLabel}>{t(opt.labelKey)}</Typography>
              </TouchableOpacity>
            ))}
          </View>
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
    marginBottom: spacing.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  optionItem: {
    width: '30%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    textAlign: 'center',
  },
});
