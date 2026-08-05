import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing } from '@core/theme';
import { Typography } from '@ui/components/atoms/Typography';
import { Button } from '@ui/components/atoms/Button';
import { Icon } from '@ui/components/atoms/Icon';
import { Input } from '@ui/components/atoms/Input';
import { Loading } from '@ui/components/atoms/Loading';
import { useSecurityQuestions } from '@ui/hooks/useSecurityQuestions';
import { useSession } from '@ui/providers/SessionProvider';
import { securityQuestionLabel } from '@ui/utils/securityQuestions';
import { DIContainer } from '@core/di/container';
import { VerifySecurityAnswersUseCase } from '@domain/usecases/security/VerifySecurityAnswersUseCase';
import { ResetPinWithSecurityQuestionsUseCase } from '@domain/usecases/security/ResetPinWithSecurityQuestionsUseCase';
import { MAX_RECOVERY_ATTEMPTS } from '@core/constants/securityQuestions';

type Step = 'loading' | 'questions' | 'reset' | 'success';

export default function RecoverVaultScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { getQuestions } = useSecurityQuestions();
  const { unlock } = useSession();
  const { vaultId } = useLocalSearchParams<{ vaultId: string }>();

  const [step, setStep] = useState<Step>('loading');
  const [questions, setQuestions] = useState<{ id: string; question: string }[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_RECOVERY_ATTEMPTS);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  useEffect(() => {
    if (!vaultId) return;
    (async () => {
      const list = await getQuestions(vaultId);
      if (list.length === 0) {
        setStep('questions');
        setError(t('recovery.noQuestions'));
        return;
      }
      setQuestions(list.map((q) => ({ id: q.id, question: q.question })));
      setAnswers(list.map(() => ''));
      setStep('questions');
    })();
  }, [vaultId, getQuestions, t]);

  const canVerify = useMemo(() => answers.every((a) => a.trim().length > 0), [answers]);

  const handleVerify = useCallback(async () => {
    if (!vaultId || !canVerify) return;
    setError(null);
    Keyboard.dismiss();
    setLoading(true);
    try {
      const useCase = DIContainer.resolve<VerifySecurityAnswersUseCase>('VerifySecurityAnswersUseCase');
      const result = await useCase.execute(vaultId, answers);
      if (result.success && result.data.verified) {
        setError(null);
        setStep('reset');
      } else {
        const remaining = attemptsLeft - 1;
        setAttemptsLeft(remaining);
        if (remaining <= 0) {
          setError(t('recovery.tooManyAttempts'));
        } else {
          setError(t('recovery.answersIncorrect') + ' ' + t('recovery.attemptsLeft', { count: remaining }));
        }
      }
    } catch (err) {
      setError((err as Error).message || t('errors.general'));
    } finally {
      setLoading(false);
    }
  }, [vaultId, answers, canVerify, attemptsLeft, t]);

  const handleReset = useCallback(async () => {
    if (!vaultId) return;
    setError(null);
    Keyboard.dismiss();
    if (newPin !== confirmPin) { setError(t('auth.pinMismatch')); return; }
    setLoading(true);
    try {
      const useCase = DIContainer.resolve<ResetPinWithSecurityQuestionsUseCase>('ResetPinWithSecurityQuestionsUseCase');
      const result = await useCase.execute(vaultId, answers, newPin);
      if (result.success) {
        unlock(vaultId);
        setStep('success');
      } else {
        const cause = result.error.metadata?.['cause'];
        setError(cause ? `${result.error.message} (${String(cause)})` : result.error.message);
      }
    } catch (err) {
      setError((err as Error).message || t('errors.general'));
    } finally {
      setLoading(false);
    }
  }, [vaultId, answers, newPin, confirmPin, unlock, t]);

  const handleDone = useCallback(() => {
    router.replace({ pathname: '/(app)/(tabs)/vault', params: { vaultId } });
  }, [vaultId]);

  const sanitizePin = useCallback((text: string) => text.replace(/[^0-9]/g, '').slice(0, 8), []);

  if (step === 'loading') {
    return <Loading fullScreen />;
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'android' ? undefined : 'padding'} style={styles.keyboardView}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.header}>
              <View style={[styles.iconContainer, { backgroundColor: colors.primaryContainer }]}>
                <Icon name={step === 'success' ? 'shield-check' : 'shield-key'} size={40} color={colors.primary} />
              </View>
              <Typography variant="headlineMedium">{t('recovery.title')}</Typography>
              <Typography variant="bodyLarge" color={colors.onSurfaceVariant} style={styles.desc}>
                {step === 'reset' ? t('recovery.resetStepDesc') : step === 'success' ? null : t('recovery.questionsStepDesc')}
              </Typography>
            </View>

            {step === 'questions' && (
              <View>
                <Typography variant="titleSmall" style={styles.stepLabel}>{t('recovery.questionsStep')}</Typography>
                {questions.map((q, index) => (
                  <View key={q.id} style={styles.questionBlock}>
                    <Typography variant="labelLarge" color={colors.onSurface}>{securityQuestionLabel(q.question, t)}</Typography>
                    <Input
                      value={answers[index]}
                      onChangeText={(text) => {
                        setAnswers((prev) => prev.map((a, i) => (i === index ? text : a)));
                        setError(null);
                      }}
                      placeholder={t('recovery.answerPlaceholder')}
                      autoCapitalize="none"
                    />
                  </View>
                ))}

                {error && (
                  <Typography variant="bodySmall" color={colors.error} style={styles.error}>{error}</Typography>
                )}

                <Button
                  title={loading ? t('common.loading') : t('recovery.verify')}
                  onPress={handleVerify}
                  variant="primary"
                  fullWidth
                  size="lg"
                  loading={loading}
                  disabled={!canVerify || attemptsLeft <= 0}
                  style={styles.button}
                />
              </View>
            )}

            {step === 'reset' && (
              <View>
                <Typography variant="titleSmall" style={styles.stepLabel}>{t('recovery.resetStep')}</Typography>

                <Input
                  label={t('auth.newPin')}
                  value={newPin}
                  onChangeText={(text) => { setNewPin(sanitizePin(text)); setError(null); }}
                  placeholder={t('auth.pinPlaceholder')}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={8}
                />
                <Input
                  label={t('auth.confirmPin')}
                  value={confirmPin}
                  onChangeText={(text) => { setConfirmPin(sanitizePin(text)); setError(null); }}
                  placeholder={t('auth.confirmPinPlaceholder')}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={8}
                  error={confirmPin.length > 0 && newPin !== confirmPin ? t('auth.pinMismatch') : undefined}
                />

                {error && (
                  <Typography variant="bodySmall" color={colors.error} style={styles.error}>{error}</Typography>
                )}

                <Button
                  title={loading ? t('common.loading') : t('recovery.reset')}
                  onPress={handleReset}
                  variant="primary"
                  fullWidth
                  size="lg"
                  loading={loading}
                  disabled={newPin.length < 4 || newPin !== confirmPin}
                  style={styles.button}
                />
              </View>
            )}

            {step === 'success' && (
              <View style={styles.successBlock}>
                <Icon name="check-decagram" size={56} color={colors.primary} />
                <Typography variant="bodyLarge" color={colors.onSurfaceVariant} style={styles.successText}>{t('recovery.success')}</Typography>
                <Button title={t('common.done')} onPress={handleDone} variant="primary" fullWidth size="lg" style={styles.button} />
              </View>
            )}

            {step !== 'success' && (
              <Button title={t('common.back')} onPress={() => router.back()} variant="ghost" fullWidth style={styles.backButton} />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: spacing.xl },
  header: { alignItems: 'center', marginBottom: spacing.xxl },
  iconContainer: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  desc: { marginTop: spacing.sm, textAlign: 'center' },
  stepLabel: { marginBottom: spacing.md },
  questionBlock: { marginBottom: spacing.md },
  error: { marginTop: spacing.sm, textAlign: 'right' },
  button: { marginTop: spacing.xl },
  backButton: { marginTop: spacing.xs },
  successBlock: { alignItems: 'center', gap: spacing.md },
  successText: { textAlign: 'center' },
});