import { useState, useCallback, memo, useMemo, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { Paths, Directory } from 'expo-file-system';
import { useTranslation } from 'react-i18next';
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
import { useVaults } from '@ui/hooks/useVaults';
import { useSession } from '@ui/providers/SessionProvider';
import { changeLanguage, getCurrentLanguage } from '@core/i18n';
import * as Updates from 'expo-updates';

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
  const { colors, mode, setThemeMode } = useTheme();
  const { isAvailable: bioAvailable, isEnrolled: bioEnrolled, authenticate, biometryType } = useBiometrics();
  const { setItem, getItem } = useSecureStorage();
  const { vaults, deleteVault, lockVault } = useVaults();
  const { t } = useTranslation();
  const { lock: lockSession } = useSession();
  const [bioEnabled, setBioEnabled] = useState(false);
  const [clipboardProtection, setClipboardProtection] = useState(true);
  const [autoLockValue, setAutoLockValue] = useState(300000);
  const [currentLang, setCurrentLang] = useState<'ar' | 'en'>(getCurrentLanguage());

  useEffect(() => {
    (async () => {
      try {
        const bio = await getItem('biometric_enabled');
        if (bio !== null) setBioEnabled(bio === 'true');

        const clipboard = await getItem('clipboard_protection');
        if (clipboard !== null) setClipboardProtection(clipboard === 'true');

        const autoLock = await getItem('auto_lock_timeout');
        if (autoLock !== null) {
          const parsed = Number(autoLock);
          if (!Number.isNaN(parsed)) setAutoLockValue(parsed);
        }
      } catch {
        // Keep defaults if storage is unavailable.
      }
    })();
  }, [getItem]);

  const AUTO_LOCK_OPTIONS = useMemo(() => [
    { label: t('settings.immediately'), value: 0 },
    { label: t('settings.after1min'), value: 60000 },
    { label: t('settings.after5min'), value: 300000 },
    { label: t('settings.after15min'), value: 900000 },
    { label: t('settings.after30min'), value: 1800000 },
  ], [t]);

  const toggleBiometrics = useCallback(async () => {
    if (!bioAvailable || !bioEnrolled) {
      Alert.alert(t('common.error'), t('errors.biometricNotAvailable'));
      return;
    }
    const auth = await authenticate(t('settings.biometricAuthPrompt'));
    if (!auth) return;
    const newVal = !bioEnabled;
    setBioEnabled(newVal);
    await setItem('biometric_enabled', String(newVal));
  }, [bioAvailable, bioEnrolled, authenticate, bioEnabled, setItem, t]);

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
    buttons.push({ text: t('common.cancel'), style: 'cancel', onPress: () => {} });
    Alert.alert(t('settings.autoLock'), t('settings.autoLockDialogMessage'), buttons);
  }, [AUTO_LOCK_OPTIONS, setItem, t]);

  const THEME_CYCLE: ThemeMode[] = [
    ThemeMode.SYSTEM,
    ThemeMode.LIGHT,
    ThemeMode.DARK,
    ThemeMode.AMOLED,
  ];

  const handleToggleTheme = useCallback(() => {
    const currentIndex = THEME_CYCLE.indexOf(mode);
    const safeIndex = currentIndex < 0 ? 0 : currentIndex;
    const next = THEME_CYCLE[(safeIndex + 1) % THEME_CYCLE.length]!;
    setThemeMode(next);
  }, [mode, setThemeMode]);

  const handleToggleLanguage = useCallback(() => {
    const next = currentLang === 'ar' ? 'en' : 'ar';
    changeLanguage(next);
    setCurrentLang(next);
    Alert.alert(t('settings.language'), t('settings.languageRestart'), [
      { text: t('common.ok'), onPress: () => Updates.reloadAsync() },
    ]);
  }, [currentLang, t]);

  const handleClearVaults = useCallback(() => {
    Alert.alert(
      t('settings.clearAllData'),
      t('settings.clearAllData'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.clearAllData'),
          style: 'destructive',
          onPress: async () => {
            for (const vault of vaults) {
              await deleteVault(vault.id);
            }
            const khaznatiDir = new Directory(Paths.document, 'khaznati');
            if (khaznatiDir.exists) {
              khaznatiDir.delete();
            }
            lockSession();
            router.replace('/(auth)/welcome');
          },
        },
      ],
    );
  }, [vaults, deleteVault, lockSession, t]);

  const handleActivityLog = useCallback(() => {
    router.push('/(app)/modals/activity-log');
  }, []);

  const handleAbout = useCallback(() => {
    router.push('/(app)/modals/about');
  }, []);

  const handleLicenses = useCallback(() => {
    Alert.alert(t('settings.licenses'), t('settings.licensesDialog'));
  }, [t]);

  const handleLockAll = useCallback(async () => {
    for (const vault of vaults) {
      if (!vault.isLocked) {
        await lockVault(vault.id);
      }
    }
    lockSession();
    router.replace('/(auth)/login');
  }, [vaults, lockVault, lockSession]);

  const handleChangePin = useCallback(() => {
    router.push('/(app)/modals/change-pin');
  }, []);

  const handleSecurityQuestions = useCallback(() => {
    router.push('/(app)/modals/security-questions');
  }, []);

  return (
    <ScreenLayout title={t('settings.title')} hasTabs showBack onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.group}>
          <Typography variant="labelLarge" color={colors.primary} style={styles.groupTitle}>{t('settings.security')}</Typography>
          <Card variant="filled" padding={0}>
            <View style={[styles.settingItem, { borderBottomColor: colors.outlineVariant }]}>
              <Icon name={biometryType === 'fingerprint' ? 'fingerprint' : 'face-recognition'} size={22} color={colors.onSurface} />
              <Typography variant="bodyLarge" style={styles.settingLabel}>{t('settings.biometrics')}</Typography>
              <ToggleSwitch value={bioEnabled} onValueChange={toggleBiometrics} disabled={!bioAvailable || !bioEnrolled} />
            </View>
            <Divider />
            <TouchableOpacity style={styles.settingItem} accessibilityRole="button" accessibilityLabel={t('settings.autoLock')} onPress={handleAutoLock}>
              <Icon name="lock-clock" size={22} color={colors.onSurface} />
              <Typography variant="bodyLarge" style={styles.settingLabel}>{t('settings.autoLock')}</Typography>
              <Typography variant="bodySmall" color={colors.onSurfaceVariant} style={styles.settingValue}>
                {AUTO_LOCK_OPTIONS.find((o) => o.value === autoLockValue)?.label ?? t('settings.after5min')}
              </Typography>
              <Icon name="chevron-right" size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            <Divider />
            <TouchableOpacity style={styles.settingItem} accessibilityRole="button" accessibilityLabel={t('settings.changePin')} onPress={handleChangePin}>
              <Icon name="shield-lock" size={22} color={colors.onSurface} />
              <Typography variant="bodyLarge" style={styles.settingLabel}>{t('settings.changePin')}</Typography>
              <Icon name="chevron-right" size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            <Divider />
            <TouchableOpacity style={styles.settingItem} accessibilityRole="button" accessibilityLabel={t('settings.securityQuestions')} onPress={handleSecurityQuestions}>
              <Icon name="help-circle" size={22} color={colors.onSurface} />
              <Typography variant="bodyLarge" style={styles.settingLabel}>{t('settings.securityQuestions')}</Typography>
              <Icon name="chevron-right" size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </Card>
        </View>

        <View style={styles.group}>
          <Typography variant="labelLarge" color={colors.primary} style={styles.groupTitle}>{t('settings.data')}</Typography>
          <Card variant="filled" padding={0}>
            <TouchableOpacity style={[styles.settingItem, { borderBottomColor: colors.outlineVariant }]} accessibilityRole="button" accessibilityLabel={t('settings.clearAllData')} onPress={handleClearVaults}>
              <Icon name="database" size={22} color={colors.onSurface} />
              <Typography variant="bodyLarge" style={styles.settingLabel}>{t('settings.clearAllData')}</Typography>
              <Icon name="chevron-right" size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            <Divider />
            <TouchableOpacity style={styles.settingItem} accessibilityRole="button" accessibilityLabel={t('settings.activityLog')} onPress={handleActivityLog}>
              <Icon name="history" size={22} color={colors.onSurface} />
              <Typography variant="bodyLarge" style={styles.settingLabel}>{t('settings.activityLog')}</Typography>
              <Icon name="chevron-right" size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </Card>
        </View>

        <View style={styles.group}>
          <Typography variant="labelLarge" color={colors.primary} style={styles.groupTitle}>{t('settings.appearance')}</Typography>
          <Card variant="filled" padding={0}>
            <TouchableOpacity style={[styles.settingItem, { borderBottomColor: colors.outlineVariant }]} accessibilityRole="button" accessibilityLabel={t('settings.theme')} onPress={handleToggleTheme}>
              <Icon name="theme-light-dark" size={22} color={colors.onSurface} />
              <Typography variant="bodyLarge" style={styles.settingLabel}>{t('settings.theme')}</Typography>
              <Typography variant="bodySmall" color={colors.onSurfaceVariant} style={styles.settingValue}>
                {mode === ThemeMode.LIGHT ? t('settings.themeLight') : mode === ThemeMode.DARK ? t('settings.themeDark') : mode === ThemeMode.AMOLED ? t('settings.themeAmoled') : t('settings.system')}
              </Typography>
              <Icon name="chevron-right" size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            <Divider />
            <TouchableOpacity style={styles.settingItem} accessibilityRole="button" accessibilityLabel={t('settings.language')} onPress={handleToggleLanguage}>
              <Icon name="translate" size={22} color={colors.onSurface} />
              <Typography variant="bodyLarge" style={styles.settingLabel}>{t('settings.language')}</Typography>
              <Typography variant="bodySmall" color={colors.onSurfaceVariant} style={styles.settingValue}>
                {currentLang === 'ar' ? 'العربية' : t('settings.english')}
              </Typography>
              <Icon name="chevron-right" size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            <Divider />
            <View style={styles.settingItem}>
              <Icon name="clipboard-text-outline" size={22} color={colors.onSurface} />
              <Typography variant="bodyLarge" style={styles.settingLabel}>{t('settings.clipboard')}</Typography>
              <ToggleSwitch value={clipboardProtection} onValueChange={toggleClipboard} />
            </View>
          </Card>
        </View>

        <View style={styles.group}>
          <Typography variant="labelLarge" color={colors.primary} style={styles.groupTitle}>{t('settings.about')}</Typography>
          <Card variant="filled" padding={0}>
            <TouchableOpacity style={[styles.settingItem, { borderBottomColor: colors.outlineVariant }]} accessibilityRole="button" accessibilityLabel={t('settings.about')} onPress={handleAbout}>
              <Icon name="information" size={22} color={colors.onSurface} />
              <Typography variant="bodyLarge" style={styles.settingLabel}>{t('settings.about')}</Typography>
              <Icon name="chevron-right" size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            <Divider />
            <TouchableOpacity style={styles.settingItem} accessibilityRole="button" accessibilityLabel={t('settings.licenses')} onPress={handleLicenses}>
              <Icon name="license" size={22} color={colors.onSurface} />
              <Typography variant="bodyLarge" style={styles.settingLabel}>{t('settings.licenses')}</Typography>
              <Icon name="chevron-right" size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </Card>
        </View>

        <TouchableOpacity onPress={handleLockAll} accessibilityRole="button" accessibilityLabel={t('settings.lockAllVaults')} style={[styles.logoutButton, { borderColor: colors.error }]}>
          <Icon name="logout" size={22} color={colors.error} />
          <Typography variant="bodyLarge" color={colors.error} style={styles.logoutLabel}>{t('settings.lockAllVaults')}</Typography>
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