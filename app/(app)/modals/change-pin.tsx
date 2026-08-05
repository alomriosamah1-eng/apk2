import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@ui/providers/ThemeProvider';
import { useSession } from '@ui/providers/SessionProvider';
import { spacing } from '@core/theme';
import { ScreenLayout } from '@ui/components/organisms/ScreenLayout';
import { Typography } from '@ui/components/atoms/Typography';
import { Button } from '@ui/components/atoms/Button';
import { Input } from '@ui/components/atoms/Input';
import { DIContainer } from '@core/di/container';
import { ChangePinUseCase } from '@domain/usecases/vault/ChangePinUseCase';

export default function ChangePinScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { activeVaultId } = useSession();
  const vid = activeVaultId || 'default';
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = current.length >= 4 && next.length >= 4 && next === confirm;

  const sanitize = useCallback((text: string) => text.replace(/[^0-9]/g, '').slice(0, 8), []);

  const handleChange = useCallback(async () => {
    setError(null);
    Keyboard.dismiss();
    if (next !== confirm) { setError(t('auth.pinMismatch')); return; }

    setLoading(true);
    try {
      const useCase = DIContainer.resolve<ChangePinUseCase>('ChangePinUseCase');
      const result = await useCase.execute(vid, current, next);
      if (result.success) {
        router.back();
      } else {
        const cause = result.error.metadata?.['cause'];
        setError(cause ? `${result.error.message} (${String(cause)})` : result.error.message);
      }
    } catch (err) {
      setError((err as Error).message || t('errors.general'));
    } finally {
      setLoading(false);
    }
  }, [current, next, confirm, vid, t]);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenLayout title={t('settings.changePin')} showBack onBack={() => router.back()}>
          <KeyboardAvoidingView behavior={Platform.OS === 'android' ? undefined : 'padding'} style={styles.flex}>
            <View style={styles.content}>
              <Typography variant="bodyLarge" color={colors.onSurfaceVariant} style={styles.desc}>{t('settings.changePinDesc')}</Typography>

              <Input
                label={t('auth.currentPin')}
                value={current}
                onChangeText={(text) => { setCurrent(sanitize(text)); setError(null); }}
                placeholder={t('auth.pinPlaceholder')}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={8}
              />

              <Input
                label={t('auth.newPin')}
                value={next}
                onChangeText={(text) => { setNext(sanitize(text)); setError(null); }}
                placeholder={t('auth.pinPlaceholder')}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={8}
              />

              <Input
                label={t('auth.confirmPin')}
                value={confirm}
                onChangeText={(text) => { setConfirm(sanitize(text)); setError(null); }}
                placeholder={t('auth.confirmPinPlaceholder')}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={8}
                error={confirm.length > 0 && next !== confirm ? t('auth.pinMismatch') : undefined}
              />

              {error && (
                <Typography variant="bodySmall" color={colors.error} style={styles.error}>{error}</Typography>
              )}

              <Button
                title={loading ? t('common.loading') : t('settings.changePin')}
                onPress={handleChange}
                variant="primary"
                fullWidth
                size="lg"
                loading={loading}
                disabled={!canSubmit}
                style={styles.button}
              />
            </View>
          </KeyboardAvoidingView>
        </ScreenLayout>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1, padding: spacing.xl },
  desc: { marginBottom: spacing.xl },
  error: { marginTop: spacing.sm, textAlign: 'right' },
  button: { marginTop: spacing.xl },
});