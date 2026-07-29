import { useCallback } from 'react';
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

interface AddOptionsSheetProps {
  visible: boolean;
  onClose: () => void;
}

export default function AddOptionsSheet({ visible, onClose }: AddOptionsSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { vaults } = useVaults();

  const getDefaultVaultDir = useCallback(() => {
    const vault = vaults.find((v) => !v.isLocked);
    if (!vault) return new Directory(Paths.document, 'khaznati', 'default');
    return new Directory(Paths.document, 'khaznati', vault.id);
  }, [vaults]);

  const importToVault = useCallback(async (pickerOptions?: DocumentPicker.DocumentPickerOptions) => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, ...pickerOptions });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const vaultDir = getDefaultVaultDir();
      if (!vaultDir.exists) vaultDir.create({ intermediates: true, idempotent: true });
      const destFile = new File(vaultDir, asset.name);
      destFile.create({ overwrite: true });
      const srcFile = new File(asset.uri);
      srcFile.copy(destFile);
    }
  }, [getDefaultVaultDir]);

  const handleImportFile = useCallback(async () => {
    onClose();
    await importToVault();
    router.push('/(app)/(tabs)/files');
  }, [onClose, importToVault]);

  const handleImportPhoto = useCallback(async () => {
    onClose();
    await importToVault({ type: 'image/*' });
    router.push('/(app)/(tabs)/media');
  }, [onClose, importToVault]);

  const handleImportVideo = useCallback(async () => {
    onClose();
    await importToVault({ type: 'video/*' });
    router.push('/(app)/(tabs)/files');
  }, [onClose, importToVault]);

  const handleImportAudio = useCallback(async () => {
    onClose();
    await importToVault({ type: 'audio/*' });
    router.push('/(app)/(tabs)/files');
  }, [onClose, importToVault]);

  const handleWriteNote = useCallback(() => {
    onClose();
    router.push('/(app)/(tabs)/notes');
  }, [onClose]);

  const handleAddPassword = useCallback(() => {
    onClose();
    router.push('/(app)/(tabs)/passwords');
  }, [onClose]);

  const handleQuickExit = useCallback(() => {
    onClose();
    if (Platform.OS === 'android') {
      BackHandler.exitApp();
    } else {
      router.push('/(auth)/welcome');
    }
  }, [onClose]);

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
