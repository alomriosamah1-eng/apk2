import { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing } from '@core/theme';
import { Typography } from '@ui/components/atoms/Typography';
import { Button } from '@ui/components/atoms/Button';
import { Icon } from '@ui/components/atoms/Icon';
import { Input } from '@ui/components/atoms/Input';
import { useBiometrics } from '@ui/hooks/useBiometrics';
import { useVaults } from '@ui/hooks/useVaults';
import { useSecureStorage } from '@ui/hooks/useSecureStorage';

const REMEMBER_KEY = 'khaznati_remember_vault';

export default function LoginScreen() {
  const { colors } = useTheme();
  const { authenticate, isAvailable } = useBiometrics();
  const { unlockVault, vaults, loadVaults } = useVaults();
  const { getItem, setItem } = useSecureStorage();
  const { id: vaultId } = useLocalSearchParams<{ id: string }>();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const targetVault = (vaultId && vaults.find((v) => v.id === vaultId)) || (vaults.length > 0 ? vaults[0] : null);

  useEffect(() => {
    if (vaults.length === 0) loadVaults();
  }, [loadVaults, vaults.length]);

  useEffect(() => {
    (async () => {
      const remembered = await getItem(REMEMBER_KEY + '_' + (targetVault?.id || ''));
      if (remembered === 'true') setRememberMe(true);
    })();
  }, [getItem, targetVault?.id]);

  const handleLogin = useCallback(async () => {
    if (!password.trim()) { setError('الرجاء إدخال كلمة المرور'); return; }
    if (!targetVault) { setError('لم يتم العثور على الخزنة'); return; }
    setLoading(true);
    setError(null);
    Keyboard.dismiss();

    const result = await unlockVault(targetVault.id, password);
    if (result.success) {
      if (rememberMe) {
        await setItem(REMEMBER_KEY + '_' + targetVault.id, 'true');
      }
      router.replace('/(app)/(tabs)/vault');
    } else {
      setError('كلمة المرور غير صحيحة. الرجاء المحاولة مرة أخرى');
      setPassword('');
    }
    setLoading(false);
  }, [password, targetVault, rememberMe, unlockVault, setItem]);

  const handleBiometric = useCallback(async () => {
    if (!targetVault) return;
    const success = await authenticate('افتح الخزنة بالبصمة');
    if (success) {
      const result = await unlockVault(targetVault.id, '');
      if (result.success) {
        router.replace('/(app)/(tabs)/vault');
      } else {
        setError('فشل فتح الخزنة بالبصمة');
      }
    }
  }, [targetVault, authenticate, unlockVault]);

  const handlePasswordChange = useCallback((text: string) => {
    setPassword(text);
    setError(null);
  }, []);

  if (vaults.length === 0 && !targetVault) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContent}>
          <Icon name="shield-lock" size={64} color={colors.onSurfaceVariant} />
          <Typography variant="bodyLarge" color={colors.onSurfaceVariant} style={styles.noVaultText}>لا توجد خزنة مسجلة</Typography>
          <Button title="إنشاء خزنة جديدة" onPress={() => router.push('/(auth)/create-vault')} variant="primary" fullWidth style={styles.button} />
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
            {targetVault && (
              <>
                <Typography variant="headlineMedium">مرحباً بعودتك</Typography>
                <Typography variant="titleSmall" color={colors.onSurfaceVariant}>{targetVault.name}</Typography>
              </>
            )}
          </View>

          <View style={styles.form}>
            <Input
              label="كلمة المرور"
              value={password}
              onChangeText={handlePasswordChange}
              placeholder="أدخل كلمة المرور"
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
                  <Typography variant="bodySmall" color={colors.onSurfaceVariant} style={styles.rememberLabel}>تذكرني</Typography>
                </View>
              </TouchableWithoutFeedback>
            </View>

            <Button title={loading ? 'جاري فتح الخزنة...' : 'فتح الخزنة'} onPress={handleLogin} variant="primary" fullWidth size="lg" loading={loading} disabled={!password.trim()} style={styles.button} />

            {isAvailable && targetVault && (
              <Button
                title="استخدام البصمة"
                onPress={handleBiometric}
                variant="glass"
                fullWidth
                icon={<Icon name="fingerprint" size={20} color={colors.primary} />}
                style={styles.biometric}
              />
            )}

            <Button title="العودة إلى الترحيب" onPress={() => router.back()} variant="ghost" fullWidth style={styles.backButton} />
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
