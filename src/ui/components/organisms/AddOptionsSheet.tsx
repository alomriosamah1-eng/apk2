import { useCallback, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Pressable, BackHandler, Platform } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Paths, File, Directory } from 'expo-file-system';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing, borderRadius, elevations } from '@core/theme';
import { Typography } from '@ui/components/atoms/Typography';
import { Icon } from '@ui/components/atoms/Icon';
import { useVaults } from '@ui/hooks/useVaults';
import { useSession } from '@ui/providers/SessionProvider';
import { useSnackbar } from '@ui/providers/SnackbarProvider';
import { DIContainer } from '@core/di/container';
import { IItemRepository } from '@domain/repositories/IItemRepository';
import { ItemType } from '@core/constants';
import { generateId } from '@core/utils';
import { encryptFile } from '@core/utils/crypto';
import { getVaultKey } from '@data/media/MediaStorage';

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

  const getDefaultVaultDir = useCallback(() => {
    const targetId = getTargetVaultId();
    if (targetId === 'default') return new Directory(Paths.document, 'khaznati', 'default');
    return new Directory(Paths.document, 'khaznati', targetId);
  }, [getTargetVaultId]);

  const importToVault = useCallback(async (pickerOptions?: DocumentPicker.DocumentPickerOptions): Promise<boolean> => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, ...pickerOptions });
      if (result.canceled || !result.assets?.[0]) return false;
      const asset = result.assets[0];
      const targetId = getTargetVaultId();
      const key = await getVaultKey(targetId);
      const srcFile = new File(asset.uri);
      const base64Data = await srcFile.base64();
      const encryptedBase64 = await encryptFile(key, base64Data);

      const vaultDir = getDefaultVaultDir();
      if (!vaultDir.exists) vaultDir.create({ intermediates: true, idempotent: true });
      const encFileName = `${Date.now()}.${asset.name}.enc`;
      const encFile = new File(vaultDir, encFileName);
      await encFile.write(encryptedBase64);

      const itemRepo = DIContainer.resolve<IItemRepository>('ItemRepository');
      await itemRepo.create({
        id: generateId(),
        vaultId: targetId,
        parentId: null,
        name: asset.name,
        type: ItemType.FILE,
        mimeType: asset.mimeType || null,
        size: asset.size || 0,
        encryptedPath: encFile.uri,
        encryptedData: null,
        thumbnailPath: null,
        metadata: null,
        isFavorite: false,
        isDeleted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deletedAt: null,
      });
      return true;
    } catch (error) {
      showSnackbar(error instanceof Error ? error.message : t('common.error'));
      return false;
    }
  }, [getTargetVaultId, getDefaultVaultDir, showSnackbar, t]);

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
      if (ok) pushWithVault('/(app)/(tabs)/files');
    } finally {
      setImporting(false);
    }
  }, [onClose, importToVault, pushWithVault, importing]);

  const handleImportAudio = useCallback(async () => {
    if (importing) return;
    onClose();
    setImporting(true);
    try {
      const ok = await importToVault({ type: 'audio/*' });
      if (ok) pushWithVault('/(app)/(tabs)/files');
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
