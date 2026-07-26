import { useState, useCallback, memo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { Paths, Directory, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useTheme } from '@ui/providers/ThemeProvider';
import { ThemeMode } from '@core/constants/enums';
import { spacing } from '@core/theme';
import { ScreenLayout } from '@ui/components/organisms/ScreenLayout';
import { Typography } from '@ui/components/atoms/Typography';
import { Card } from '@ui/components/atoms/Card';
import { Icon } from '@ui/components/atoms/Icon';
import { Divider } from '@ui/components/atoms/Divider';
import { useBiometrics } from '@ui/hooks/useBiometrics';
import { useSecureStorage } from '@ui/hooks/useSecureStorage';
import { changeLanguage, getCurrentLanguage } from '@core/i18n';

const AUTO_LOCK_OPTIONS = [
  { label: 'Immediately', value: 0 },
  { label: 'After 1 minute', value: 60000 },
  { label: 'After 5 minutes', value: 300000 },
  { label: 'After 15 minutes', value: 900000 },
  { label: 'After 30 minutes', value: 1800000 },
];

function ToggleSwitch({ value, onValueChange, disabled }: { value: boolean; onValueChange: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onValueChange}
      disabled={disabled}
      style={[
        styles.switchTrack,
        {
          backgroundColor: value ? colors.primary : colors.surfaceVariant,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <View
        style={[
          styles.switchThumb,
          {
            backgroundColor: value ? '#FFFFFF' : colors.onSurfaceVariant,
            alignSelf: value ? 'flex-end' : 'flex-start',
          },
        ]}
      />
    </TouchableOpacity>
  );
}

function SettingsScreenContent() {
  const { colors, mode, setThemeMode, isDark } = useTheme();
  const { isAvailable: bioAvailable, isEnrolled: bioEnrolled, authenticate } = useBiometrics();
  const { setItem } = useSecureStorage();
  const [bioEnabled, setBioEnabled] = useState(false);
  const [clipboardProtection, setClipboardProtection] = useState(true);
  const [autoLockValue, setAutoLockValue] = useState(300000);
  const [currentLang, setCurrentLang] = useState<'ar' | 'en'>(getCurrentLanguage());

  const toggleBiometrics = useCallback(async () => {
    if (!bioAvailable || !bioEnrolled) {
      Alert.alert('Not Available', 'Biometrics are not set up on this device.');
      return;
    }
    const auth = await authenticate('Authenticate to toggle biometrics');
    if (!auth) return;
    const newVal = !bioEnabled;
    setBioEnabled(newVal);
    await setItem('biometric_enabled', String(newVal));
  }, [bioAvailable, bioEnrolled, authenticate, bioEnabled, setItem]);

  const toggleClipboard = useCallback(async () => {
    const newVal = !clipboardProtection;
    setClipboardProtection(newVal);
    await setItem('clipboard_protection', String(newVal));
  }, [clipboardProtection, setItem]);

  const handleAutoLock = useCallback(() => {
    const buttons: { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[] = AUTO_LOCK_OPTIONS.map((opt) => ({
      text: opt.label,
      onPress: () => {
        setAutoLockValue(opt.value);
        setItem('auto_lock_timeout', String(opt.value));
      },
    }));
    buttons.push({ text: 'Cancel', style: 'cancel', onPress: () => {} });
    Alert.alert('Auto Lock', 'Choose when to auto-lock your vaults', buttons);
  }, [setItem]);

  const handleToggleTheme = useCallback(() => {
    const next = isDark ? ThemeMode.LIGHT : ThemeMode.DARK;
    setThemeMode(next);
  }, [isDark, setThemeMode]);

  const handleToggleLanguage = useCallback(() => {
    const next = currentLang === 'ar' ? 'en' : 'ar';
    changeLanguage(next);
    setCurrentLang(next);
  }, [currentLang]);

  const handleBackup = useCallback(async () => {
    try {
      const backupDir = new Directory(Paths.document, 'backups');
      if (!backupDir.exists) {
        backupDir.create({ intermediates: true });
      }

      const timestamp = Date.now();
      const backupPath = `${backupDir.uri}/khaznati-backup-${timestamp}.kzb`;

      const dbPath = new Directory(Paths.document, 'SQLite');
      if (dbPath.exists) {
        const dbFile = new File(dbPath, 'khaznati.db');
        if (dbFile.exists) {
          const destFile = new File(backupDir, `khaznati-backup-${timestamp}.kzb`);
          destFile.create({ overwrite: true });
          dbFile.copy(destFile);

          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(destFile.uri, {
              mimeType: 'application/octet-stream',
              dialogTitle: 'Save Khaznati Backup',
            });
          } else {
            Alert.alert('Backup Created', `Backup saved to:\n${backupPath}`);
          }
          return;
        }
      }
      Alert.alert('Error', 'No database found to backup.');
    } catch (err) {
      Alert.alert('Backup Failed', (err as Error).message);
    }
  }, []);

  const handleRestore = useCallback(() => {
    Alert.alert(
      'Restore Backup',
      'This will replace all current data with the backup. Continue?',
      [
        { text: 'Cancel', style: 'cancel' as const, onPress: () => {} },
        {
          text: 'Restore',
          style: 'destructive' as const,
          onPress: () => Alert.alert('Coming Soon', 'File picker for restore will be available in a future update.'),
        },
      ],
    );
  }, []);

  const handleClearVaults = useCallback(() => {
    Alert.alert(
      'Clear All Vaults',
      'This will permanently delete all vaults and data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' as const, onPress: () => {} },
        { text: 'Delete All', style: 'destructive' as const, onPress: () => {} },
      ],
    );
  }, []);

  const handleActivityLog = useCallback(() => {
    router.push('/(app)/modals/activity-log');
  }, []);

  const handleAbout = useCallback(() => {
    Alert.alert('Khaznati', 'Version 1.0.0\n\nA secure, encrypted vault for your digital life.\n\nBuilt with Expo and React Native.');
  }, []);

  const handleLicenses = useCallback(() => {
    Alert.alert('Licenses', 'This app uses open-source software:\n\n• Expo\n• React Native\n• SQLite\n• Various MIT-licensed packages');
  }, []);

  const handleLockAll = useCallback(() => {
    router.push('/(auth)/welcome');
  }, []);

  return (
    <ScreenLayout title="Settings" hasTabs>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.group}>
          <Typography variant="labelLarge" color={colors.primary} style={styles.groupTitle}>Security</Typography>
          <Card variant="filled" padding={0}>
            <TouchableOpacity style={[styles.settingItem, { borderBottomColor: colors.outlineVariant }]} accessibilityRole="button" accessibilityLabel="Security Settings">
              <Icon name="shield-check" size={22} color={colors.onSurface} />
              <Typography variant="bodyLarge" style={styles.settingLabel}>Security Settings</Typography>
              <Icon name="chevron-right" size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            <Divider />
            <View style={[styles.settingItem, { borderBottomColor: colors.outlineVariant }]}>
              <Icon name="fingerprint" size={22} color={colors.onSurface} />
              <Typography variant="bodyLarge" style={styles.settingLabel}>Biometrics</Typography>
              <ToggleSwitch value={bioEnabled} onValueChange={toggleBiometrics} disabled={!bioAvailable || !bioEnrolled} />
            </View>
            <Divider />
            <TouchableOpacity style={styles.settingItem} accessibilityRole="button" accessibilityLabel="Auto Lock" onPress={handleAutoLock}>
              <Icon name="lock-clock" size={22} color={colors.onSurface} />
              <Typography variant="bodyLarge" style={styles.settingLabel}>Auto Lock</Typography>
              <Typography variant="bodySmall" color={colors.onSurfaceVariant} style={styles.settingValue}>
                {AUTO_LOCK_OPTIONS.find((o) => o.value === autoLockValue)?.label ?? '5 min'}
              </Typography>
              <Icon name="chevron-right" size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </Card>
        </View>

        <View style={styles.group}>
          <Typography variant="labelLarge" color={colors.primary} style={styles.groupTitle}>Data</Typography>
          <Card variant="filled" padding={0}>
            <TouchableOpacity style={[styles.settingItem, { borderBottomColor: colors.outlineVariant }]} accessibilityRole="button" accessibilityLabel="Backup" onPress={handleBackup}>
              <Icon name="backup-restore" size={22} color={colors.onSurface} />
              <Typography variant="bodyLarge" style={styles.settingLabel}>Create Backup</Typography>
              <Icon name="chevron-right" size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            <Divider />
            <TouchableOpacity style={[styles.settingItem, { borderBottomColor: colors.outlineVariant }]} accessibilityRole="button" accessibilityLabel="Restore" onPress={handleRestore}>
              <Icon name="restore" size={22} color={colors.onSurface} />
              <Typography variant="bodyLarge" style={styles.settingLabel}>Restore Backup</Typography>
              <Icon name="chevron-right" size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            <Divider />
            <TouchableOpacity style={[styles.settingItem, { borderBottomColor: colors.outlineVariant }]} accessibilityRole="button" accessibilityLabel="Storage" onPress={handleClearVaults}>
              <Icon name="database" size={22} color={colors.onSurface} />
              <Typography variant="bodyLarge" style={styles.settingLabel}>Clear All Data</Typography>
              <Icon name="chevron-right" size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            <Divider />
            <TouchableOpacity style={styles.settingItem} accessibilityRole="button" accessibilityLabel="Activity Log" onPress={handleActivityLog}>
              <Icon name="history" size={22} color={colors.onSurface} />
              <Typography variant="bodyLarge" style={styles.settingLabel}>Activity Log</Typography>
              <Icon name="chevron-right" size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </Card>
        </View>

        <View style={styles.group}>
          <Typography variant="labelLarge" color={colors.primary} style={styles.groupTitle}>Appearance</Typography>
          <Card variant="filled" padding={0}>
            <TouchableOpacity style={[styles.settingItem, { borderBottomColor: colors.outlineVariant }]} accessibilityRole="button" accessibilityLabel="Theme" onPress={handleToggleTheme}>
              <Icon name="theme-light-dark" size={22} color={colors.onSurface} />
              <Typography variant="bodyLarge" style={styles.settingLabel}>Theme</Typography>
              <Typography variant="bodySmall" color={colors.onSurfaceVariant} style={styles.settingValue}>
                {mode === ThemeMode.LIGHT ? 'Light' : mode === ThemeMode.DARK ? 'Dark' : mode === ThemeMode.AMOLED ? 'AMOLED' : 'System'}
              </Typography>
              <Icon name="chevron-right" size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            <Divider />
            <TouchableOpacity style={styles.settingItem} accessibilityRole="button" accessibilityLabel="Language" onPress={handleToggleLanguage}>
              <Icon name="translate" size={22} color={colors.onSurface} />
              <Typography variant="bodyLarge" style={styles.settingLabel}>Language</Typography>
              <Typography variant="bodySmall" color={colors.onSurfaceVariant} style={styles.settingValue}>
                {currentLang === 'ar' ? 'العربية' : 'English'}
              </Typography>
              <Icon name="chevron-right" size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            <Divider />
            <View style={styles.settingItem}>
              <Icon name="clipboard-text-outline" size={22} color={colors.onSurface} />
              <Typography variant="bodyLarge" style={styles.settingLabel}>Clipboard Protection</Typography>
              <ToggleSwitch value={clipboardProtection} onValueChange={toggleClipboard} />
            </View>
          </Card>
        </View>

        <View style={styles.group}>
          <Typography variant="labelLarge" color={colors.primary} style={styles.groupTitle}>About</Typography>
          <Card variant="filled" padding={0}>
            <TouchableOpacity style={[styles.settingItem, { borderBottomColor: colors.outlineVariant }]} accessibilityRole="button" accessibilityLabel="About" onPress={handleAbout}>
              <Icon name="information" size={22} color={colors.onSurface} />
              <Typography variant="bodyLarge" style={styles.settingLabel}>About Khaznati</Typography>
              <Icon name="chevron-right" size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            <Divider />
            <TouchableOpacity style={styles.settingItem} accessibilityRole="button" accessibilityLabel="Licenses" onPress={handleLicenses}>
              <Icon name="license" size={22} color={colors.onSurface} />
              <Typography variant="bodyLarge" style={styles.settingLabel}>Licenses</Typography>
              <Icon name="chevron-right" size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </Card>
        </View>

        <TouchableOpacity onPress={handleLockAll} accessibilityRole="button" accessibilityLabel="Lock all vaults" style={[styles.logoutButton, { borderColor: colors.error }]}>
          <Icon name="logout" size={22} color={colors.error} />
          <Typography variant="bodyLarge" color={colors.error} style={styles.logoutLabel}>Lock All Vaults</Typography>
        </TouchableOpacity>

        <Typography variant="bodySmall" color={colors.onSurfaceVariant} style={styles.version}>Khaznati v1.0.0</Typography>
      </ScrollView>
    </ScreenLayout>
  );
}

export default memo(SettingsScreenContent);

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  group: {
    marginBottom: spacing.xxl,
  },
  groupTitle: {
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  settingLabel: {
    flex: 1,
    marginLeft: spacing.md,
  },
  settingValue: {
    marginRight: spacing.sm,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: 12,
    marginTop: spacing.lg,
  },
  logoutLabel: {
    marginLeft: spacing.sm,
  },
  version: {
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  switchTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
});
