import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback, TouchableOpacity, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing } from '@core/theme';
import { Typography } from '@ui/components/atoms/Typography';
import { Button } from '@ui/components/atoms/Button';
import { Input } from '@ui/components/atoms/Input';
import { Icon } from '@ui/components/atoms/Icon';
import { VaultType } from '@core/constants';
import { useVaults } from '@ui/hooks/useVaults';
import { BiometricUnlockUseCase } from '@domain/usecases/auth/BiometricUnlockUseCase';
import { DIContainer } from '@core/di/container';

const COLORS = ['#6C63FF', '#FF6584', '#03DAC5', '#FFB74D', '#66BB6A', '#42A5F5', '#AB47BC', '#EF5350'];
const ICONS = ['shield-lock', 'safe', 'lock', 'security', 'shield-key', 'key-variant', 'safe-square', 'lock-pattern'] as const;

function getPinStrength(pin: string, t: (key: string) => string): { label: string; color: string; percentage: number } {
  if (pin.length <= 4) return { label: t('auth.pinStrength.weak'), color: '#EF5350', percentage: 25 };
  if (pin.length <= 6) return { label: t('auth.pinStrength.fair'), color: '#FFB74D', percentage: 60 };
  return { label: t('auth.pinStrength.strong'), color: '#66BB6A', percentage: 100 };
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const ICON_SIZE = (SCREEN_WIDTH - spacing.xl * 2 - spacing.sm * 3) / 4;

export default function CreateVaultScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { createVault } = useVaults();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('shield-lock');
  const [selectedColor, setSelectedColor] = useState('#6C63FF');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const strengthInfo = useMemo(() => getPinStrength(pin, t), [pin, t]);

  const canSubmit = name.trim().length > 0 && pin.length >= 4 && pin === confirmPin;

  const handlePinChange = useCallback((text: string) => {
    const digits = text.replace(/[^0-9]/g, '').slice(0, 8);
    setPin(digits);
    setError(null);
  }, []);

  const handleConfirmPinChange = useCallback((text: string) => {
    const digits = text.replace(/[^0-9]/g, '').slice(0, 8);
    setConfirmPin(digits);
  }, []);

  const handleCreate = useCallback(async () => {
    setError(null);
    Keyboard.dismiss();

    if (!name.trim()) { setError(t('auth.nameRequired')); return; }
    if (pin.length < 4) { setError(t('auth.pinLengthError')); return; }
    if (pin !== confirmPin) { setError(t('auth.pinMismatch')); return; }

    setLoading(true);
    try {
      const result = await createVault({ name: name.trim(), type: VaultType.PERSONAL, pin, icon: selectedIcon, color: selectedColor });
      if (result.success) {
        const biometricUseCase = DIContainer.resolve<BiometricUnlockUseCase>('BiometricUnlockUseCase');
        await biometricUseCase.storeBiometricPin(result.data.id, pin);
        router.replace('/(app)/(tabs)/vault');
      } else {
        setError(result.error.message);
      }
    } catch (err) {
      setError((err as Error).message || t('errors.general'));
    } finally {
      setLoading(false);
    }
  }, [name, pin, confirmPin, createVault]);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'android' ? undefined : 'padding'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
            <View style={styles.header}>
              <Typography variant="headlineMedium">{t('auth.createVault')}</Typography>
              <Typography variant="bodyLarge" color={colors.onSurfaceVariant}>{t('auth.createVaultDesc')}</Typography>
            </View>

            <Input label={t('auth.vaultName')} value={name} onChangeText={setName} placeholder={t('auth.vaultNamePlaceholder')} autoCapitalize="words" returnKeyType="next" />

            <Typography variant="titleSmall" color={colors.onSurfaceVariant} style={styles.sectionLabel}>{t('auth.selectIcon')}</Typography>
            <View style={styles.iconGrid}>
              {ICONS.map((icon) => (
                <TouchableOpacity
                  key={icon}
                  onPress={() => setSelectedIcon(icon)}
                  style={[styles.iconItem, { backgroundColor: selectedIcon === icon ? selectedColor + '20' : colors.surfaceVariant, borderColor: selectedIcon === icon ? selectedColor : 'transparent' }]}
                  accessibilityLabel={t('auth.iconA11y', { name: icon })}
                >
                  <Icon name={icon} size={24} color={selectedIcon === icon ? selectedColor : colors.onSurfaceVariant} />
                </TouchableOpacity>
              ))}
            </View>

            <Typography variant="titleSmall" color={colors.onSurfaceVariant} style={styles.sectionLabel}>{t('auth.selectColor')}</Typography>
            <View style={styles.colorGrid}>
              {COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setSelectedColor(c)}
                  style={[styles.colorItem, { backgroundColor: c }, selectedColor === c && styles.colorSelected]}
                  accessibilityLabel={t('auth.colorA11y', { hex: c })}
                />
              ))}
            </View>

            <Input
              label={t('auth.pinCode')}
              value={pin}
              onChangeText={handlePinChange}
              placeholder={t('auth.pinPlaceholder')}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
              returnKeyType="next"
            />

            {pin.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={[styles.strengthBar, { backgroundColor: colors.outlineVariant }]}>
                  <View style={[styles.strengthFill, { width: `${strengthInfo.percentage}%`, backgroundColor: strengthInfo.color }]} />
                </View>
                <Typography variant="labelSmall" color={strengthInfo.color}>{strengthInfo.label}</Typography>
              </View>
            )}

            <Input
              label={t('auth.confirmPin')}
              value={confirmPin}
              onChangeText={handleConfirmPinChange}
              placeholder={t('auth.confirmPinPlaceholder')}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
              error={confirmPin.length > 0 && pin !== confirmPin ? t('auth.pinMismatch') : undefined}
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />

            {error && <Typography variant="bodySmall" color={colors.error} style={styles.errorText}>{error}</Typography>}

            <Button
              title={loading ? t('common.loading') : t('auth.createVault')}
              onPress={handleCreate}
              variant="primary"
              fullWidth
              size="lg"
              loading={loading}
              disabled={!canSubmit}
              style={styles.button}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: spacing.xl },
  header: { marginBottom: spacing.xxl },
  sectionLabel: { marginTop: spacing.lg, marginBottom: spacing.sm },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  iconItem: { width: ICON_SIZE, height: ICON_SIZE, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  colorItem: { width: 36, height: 36, borderRadius: 18 },
  colorSelected: { borderWidth: 3, borderColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  strengthContainer: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs, marginBottom: spacing.sm, gap: spacing.sm },
  strengthBar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  strengthFill: { height: '100%', borderRadius: 3 },
  errorText: { marginTop: spacing.sm, textAlign: 'right' },
  button: { marginTop: spacing.xl },
});
