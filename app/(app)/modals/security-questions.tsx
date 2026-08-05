import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@ui/providers/ThemeProvider';
import { useSession } from '@ui/providers/SessionProvider';
import { spacing } from '@core/theme';
import { ScreenLayout } from '@ui/components/organisms/ScreenLayout';
import { Typography } from '@ui/components/atoms/Typography';
import { Button } from '@ui/components/atoms/Button';
import { Input } from '@ui/components/atoms/Input';
import { SecurityQuestionsForm, SecurityQuestionEntry } from '@ui/components/organisms/SecurityQuestionsForm';
import { useSecurityQuestions } from '@ui/hooks/useSecurityQuestions';
import { MIN_SECURITY_QUESTIONS } from '@core/constants/securityQuestions';
import { DIContainer } from '@core/di/container';
import { ActivityLogRepositoryImpl } from '@data/repositories/ActivityLogRepositoryImpl';
import { ActivityAction } from '@core/constants';

export default function SecurityQuestionsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { activeVaultId } = useSession();
  const { getQuestions, setup } = useSecurityQuestions();
  const vid = activeVaultId || 'default';

  const [currentPin, setCurrentPin] = useState('');
  const [entries, setEntries] = useState<SecurityQuestionEntry[]>(
    Array.from({ length: MIN_SECURITY_QUESTIONS }, () => ({ question: '', answer: '' })),
  );
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const list = await getQuestions(vid);
      if (list.length > 0) {
        setEntries(list.map((q) => ({ question: q.question, answer: '' })));
      }
    })();
  }, [vid, getQuestions]);

  const validCount = entries.filter((e) => e.question.trim() && e.answer.trim().length >= 2).length;
  const canSubmit = currentPin.length >= 4 && validCount >= MIN_SECURITY_QUESTIONS;

  const handleSave = useCallback(async () => {
    setError(null);
    setShowErrors(true);
    Keyboard.dismiss();
    if (!canSubmit) return;

    setLoading(true);
    try {
      const inputs = entries
        .filter((e) => e.question.trim() && e.answer.trim().length >= 2)
        .map((e) => ({ question: e.question.trim(), answer: e.answer.trim() }));
      const result = await setup(vid, currentPin, inputs);
      if (result.success) {
        const repo = DIContainer.resolve<ActivityLogRepositoryImpl>('ActivityLogRepository');
        void repo.log(ActivityAction.SECURITY_QUESTIONS_CHANGED, 'vault', vid);
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
  }, [currentPin, entries, canSubmit, vid, setup, t]);

  const sanitizePin = useCallback((text: string) => text.replace(/[^0-9]/g, '').slice(0, 8), []);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenLayout title={t('settings.securityQuestions')} showBack onBack={() => router.back()}>
          <KeyboardAvoidingView behavior={Platform.OS === 'android' ? undefined : 'padding'} style={styles.flex}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Typography variant="bodyLarge" color={colors.onSurfaceVariant} style={styles.desc}>{t('settings.securityQuestionsDesc')}</Typography>

              <Input
                label={t('recovery.currentPinLabel')}
                value={currentPin}
                onChangeText={(text) => { setCurrentPin(sanitizePin(text)); setError(null); }}
                placeholder={t('auth.pinPlaceholder')}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={8}
              />

              <SecurityQuestionsForm entries={entries} onChange={setEntries} showErrors={showErrors} />

              {error && (
                <Typography variant="bodySmall" color={colors.error} style={styles.error}>{error}</Typography>
              )}

              <Button
                title={loading ? t('common.loading') : t('recovery.save')}
                onPress={handleSave}
                variant="primary"
                fullWidth
                size="lg"
                loading={loading}
                disabled={!canSubmit}
                style={styles.button}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </ScreenLayout>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  desc: { marginBottom: spacing.xl },
  error: { marginTop: spacing.sm, textAlign: 'right' },
  button: { marginTop: spacing.xl },
});