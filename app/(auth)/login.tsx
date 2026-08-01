import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing } from '@core/theme';
import { Typography } from '@ui/components/atoms/Typography';
import { Button } from '@ui/components/atoms/Button';
import { Icon } from '@ui/components/atoms/Icon';
import { Input } from '@ui/components/atoms/Input';
import { Loading } from '@ui/components/atoms/Loading';
import { useBiometrics } from '@ui/hooks/useBiometrics';
import { useVaults } from '@ui/hooks/useVaults';
import { useSecureStorage } from '@ui/hooks/useSecureStorage';
import { BiometricUnlockUseCase } from '@domain/usecases/auth/BiometricUnlockUseCase';
import { DIContainer } from '@core/di/container';
import { ActivityLogRepositoryImpl } from '@data/repositories/ActivityLogRepositoryImpl';
import { ActivityAction } from '@core/constants';
import { useSession } from '@ui/providers/SessionProvider';

const REMEMBER_KEY = 'khaznati_remember_vault';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { authenticate, isAvailable, biometryType } = useBiometrics();
  const { unlockVault, vaults, loading: vaultsLoading, loadVaults } = useVaults();
  const { getItem, setItem } = useSecureStorage();
  const session = useSession();
  const { id: vaultId } = useLocalSearchParams<{ id: string }>();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  useEffect(() => {
    getItem('biometric_enabled').then((value) => {
      setBiometricEnabled(value === 'true');
    }).catch(() => {});
  }, [getItem]);

  useEffect(() => {
    loadVaults();
  }, [loadVaults]);

  const targetVault = useMemo(() => {
    if (vaultId) return vaults.find((v) => v.id === vaultId) ?? null;
    return vaults.length > 0 ? vaults[0] : null;
  }, [vaults, vaultId]);

  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    if (!targetVault) return;
    (async () => {
      const remembered = await getItem(REMEMBER_KEY + '_' + targetVault.id);
      if (remembered === 'true') setRememberMe(true);
    })();
  }, [getItem, targetVault?.id]);

  const handleLogin = useCallback(async () => {
    if (!targetVault) { setError(t('errors.vaultNotFound')); return; }
    if (!password.trim()) { setError(t('auth.pinError')); return; }
    setLoginLoading(true);
    setError(null);
    Keyboard.dismiss();

    const result = await unlockVault(targetVault.id, password);
    if (result.success) {
      session.unlock(targetVault.id);
      if (rememberMe) {
        await setItem(REMEMBER_KEY + '_' + targetVault.id, 'true');
      }
      router.replace({ pathname: '/(app)/(tabs)/vault', params: { vaultId: targetVault.id } });
    } else {
      setError(result.error.message);
      setPassword('');
      const repo = DIContainer.resolve<ActivityLogRepositoryImpl>('ActivityLogRepository');
      void repo.log(ActivityAction.LOGIN_FAILED, 'vault', targetVault.id);
    }
    setLoginLoading(false);
  }, [password, targetVault, rememberMe, unlockVault, setItem, t]);

  const handleBiometric = useCallback(async () => {
    if (!targetVault) return;
    const authSuccess = await authenticate(t('settings.biometricAuthPrompt'));
    if (!authSuccess) return;

    const biometricUseCase = DIContainer.resolve<BiometricUnlockUseCase>('BiometricUnlockUseCase');
    const result = await biometricUseCase.execute(targetVault.id);
    if (result.success) {
      session.unlock(targetVault.id);
      router.replace({ pathname: '/(app)/(tabs)/vault', params: { vaultId: targetVault.id } });
    } else {
      setError(t('errors.biometricFailed'));
    }
  }, [targetVault, authenticate, t]);

  const handlePasswordChange = useCallback((text: string) => {
    setPassword(text);
    setError(null);
  }, []);

  if (vaultsLoading || vaults.length === 0) {
    if (vaultId && vaults.length > 0 && !targetVault) {
      return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={styles.centerContent}>
            <Icon name="shield-off" size={64} color={colors.onSurfaceVariant} />
            <Typography variant="bodyLarge" color={colors.onSurfaceVariant} style={styles.noVaultText}>{t('errors.vaultNotFound')}</Typography>
            <Button title={t('vault.title')} onPress={() => router.replace('/(auth)/welcome')} variant="primary" fullWidth style={styles.button} />
          </View>
        </View>
      );
    }
    if (vaults.length === 0 && !vaultsLoading) {
      return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={styles.centerContent}>
            <Icon name="shield-lock" size={64} color={colors.onSurfaceVariant} />
            <Typography variant="bodyLarge" color={colors.onSurfaceVariant} style={styles.noVaultText}>{t('vault.empty')}</Typography>
            <Button title={t('common.back')} onPress={() => router.push('/(auth)/welcome')} variant="ghost" fullWidth style={styles.button} />
          </View>
        </View>
      );
    }
    return <Loading fullScreen />;
  }

  if (!targetVault) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContent}>
          <Icon name="shield-off" size={64} color={colors.onSurfaceVariant} />
          <Typography variant="bodyLarge" color={colors.onSurfaceVariant} style={styles.noVaultText}>{t('errors.vaultNotFound')}</Typography>
          <Button title={t('vault.title')} onPress={() => router.replace('/(auth)/welcome')} variant="primary" fullWidth style={styles.button} />
        </View>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'android' ? undefined : 'padding'} style={styles.keyboardView}>
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: colors.primaryContainer }]}>
              <Icon name="lock" size={40} color={colors.primary} />
            </View>
            <Typography variant="headlineMedium">{t('auth.welcomeBack')}</Typography>
            <Typography variant="titleSmall" color={colors.onSurfaceVariant}>{targetVault.name}</Typography>
          </View>

          <View style={styles.form}>
            <Input
              label={t('auth.pinCode')}
              value={password}
              onChangeText={handlePasswordChange}
              placeholder={t('auth.pinPlaceholder')}
              secureTextEntry
              showSecureToggle
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              error={error || undefined}
            />

            <View style={styles.rememberRow}>
              <TouchableWithoutFeedback onPress={() => setRememberMe(!rememberMe)}>
                <View style={styles.rememberTouchable}>
                  <Icon name={rememberMe ? 'checkbox-marked' : 'checkbox-blank-outline'} size={20} color={rememberMe ? colors.primary : colors.onSurfaceVariant} />
                  <Typography variant="bodySmall" color={colors.onSurfaceVariant} style={styles.rememberLabel}>{t('auth.rememberMe')}</Typography>
                </View>
              </TouchableWithoutFeedback>
            </View>

            <Button title={loginLoading ? t('common.loading') : t('auth.unlock')} onPress={handleLogin} variant="primary" fullWidth size="lg" loading={loginLoading} disabled={!password.trim()} style={styles.button} />

            {isAvailable && biometricEnabled && (
              <Button
                title={t('auth.biometric')}
                onPress={handleBiometric}
                variant="glass"
                fullWidth
                icon={<Icon name={biometryType === 'fingerprint' ? 'fingerprint' : 'face-recognition'} size={20} color={colors.primary} />}
                style={styles.biometric}
              />
            )}

            <Button title={t('common.back')} onPress={() => router.back()} variant="ghost" fullWidth style={styles.backButton} />
          </View>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  header: { alignItems: 'center', marginBottom: spacing.xxl },
  iconContainer: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },
  form: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  rememberRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  rememberTouchable: { flexDirection: 'row', alignItems: 'center' },
  rememberLabel: { marginLeft: spacing.sm },
  button: { marginTop: spacing.md },
  biometric: { marginTop: spacing.sm },
  backButton: { marginTop: spacing.xs },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  noVaultText: { marginVertical: spacing.lg, textAlign: 'center' },
});
