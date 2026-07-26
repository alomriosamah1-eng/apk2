import { memo, useCallback } from 'react';
import { View, StyleSheet, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing } from '@core/theme';
import { Typography } from '@ui/components/atoms/Typography';
import { Button } from '@ui/components/atoms/Button';
import { Icon } from '@ui/components/atoms/Icon';
import { useBiometrics } from '@ui/hooks/useBiometrics';
import { AuthenticationType } from 'expo-local-authentication';
import { SecureStorageSource } from '@data/datasources/SecureStorageSource';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

function BiometricSetupScreenContent() {
  const { colors } = useTheme();
  const { authenticate, isAvailable, biometryType } = useBiometrics();

  const handleEnable = useCallback(async () => {
    const success = await authenticate('تفعيل فتح الخزنة بالبصمة');
    if (success) {
      const storage = new SecureStorageSource();
      await storage.set(BIOMETRIC_ENABLED_KEY, 'true');
      router.replace('/(app)/(tabs)/vault');
    }
  }, [authenticate]);

  const handleSkip = useCallback(() => {
    router.replace('/(app)/(tabs)/vault');
  }, []);

  const biometricName = biometryType === AuthenticationType.FINGERPRINT ? 'البصمة' : 'الوجه';
  const biometricIcon = biometryType === AuthenticationType.FINGERPRINT ? 'fingerprint' : 'face-recognition';

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          <View style={[styles.iconContainer, { backgroundColor: colors.primaryContainer }]}>
            <Icon name={biometricIcon} size={64} color={colors.primary} />
          </View>
          <Typography variant="headlineMedium" style={styles.title}>تفعيل {biometricName}</Typography>
          <Typography variant="bodyLarge" color={colors.onSurfaceVariant} style={styles.description}>
            استخدم {biometricName === 'البصمة' ? 'بصمتك' : 'وجهك'} لفتح الخزنة بسرعة دون إدخال كلمة المرور
          </Typography>
        </View>

        <View style={styles.actions}>
          {isAvailable && (
            <Button title={`تفعيل ${biometricName}`} onPress={handleEnable} variant="primary" fullWidth size="lg" />
          )}
          <Button title="تخطي الآن" onPress={handleSkip} variant="ghost" fullWidth />
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
