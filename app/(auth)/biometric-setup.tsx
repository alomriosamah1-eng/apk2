import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing } from '@core/theme';
import { Typography } from '@ui/components/atoms/Typography';
import { Button } from '@ui/components/atoms/Button';
import { Icon } from '@ui/components/atoms/Icon';
import { useBiometrics } from '@ui/hooks/useBiometrics';
import { SecureStorageSource } from '@data/datasources/SecureStorageSource';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

function BiometricSetupScreenContent() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { authenticate, isAvailable, biometryType } = useBiometrics();

  const handleEnable = useCallback(async () => {
    const success = await authenticate(t('settings.biometricAuthPrompt'));
    if (success) {
      const storage = new SecureStorageSource();
      await storage.set(BIOMETRIC_ENABLED_KEY, 'true');
      router.replace('/(app)/(tabs)/vault');
    }
  }, [authenticate]);

  const handleSkip = useCallback(() => {
    router.replace('/(app)/(tabs)/vault');
  }, []);

  const biometricName = biometryType === 'fingerprint' ? t('auth.biometric') : t('auth.faceId');
  const biometricIcon = biometryType === 'fingerprint' ? 'fingerprint' : 'face-recognition';

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          <View style={[styles.iconContainer, { backgroundColor: colors.primaryContainer }]}>
            <Icon name={biometricIcon} size={64} color={colors.primary} />
          </View>
          <Typography variant="headlineMedium" style={styles.title}>{t('auth.enableBiometric', { biometricType: biometricName })}</Typography>
          <Typography variant="bodyLarge" color={colors.onSurfaceVariant} style={styles.description}>
            {t('auth.biometricSetupDesc')}
          </Typography>
        </View>

        <View style={styles.actions}>
          {isAvailable && (
            <Button title={t('auth.enableBiometric', { biometricType: biometricName })} onPress={handleEnable} variant="primary" fullWidth size="lg" />
          )}
          <Button title={t('auth.skipBiometric')} onPress={handleSkip} variant="ghost" fullWidth />
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

export default memo(BiometricSetupScreenContent);

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconContainer: { width: 120, height: 120, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xxl },
  title: { marginBottom: spacing.md, textAlign: 'center' },
  description: { textAlign: 'center', paddingHorizontal: spacing.xl },
  actions: { gap: spacing.sm, marginBottom: spacing.xxxl },
});
