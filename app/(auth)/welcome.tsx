import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, ScrollView, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing } from '@core/theme';
import { useResponsive } from '@ui/hooks/useResponsive';
import { Typography } from '@ui/components/atoms/Typography';
import { Button } from '@ui/components/atoms/Button';
import { Icon } from '@ui/components/atoms/Icon';

function WelcomeScreenContent() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { scaleSize } = useResponsive();

  const handleGetStarted = useCallback(() => router.push('/(auth)/create-vault'), []);
  const handleExistingVault = useCallback(() => router.push('/(auth)/login'), []);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { backgroundColor: colors.background }]}
        bounces={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient
          colors={[colors.primary, colors.gradient.mid, colors.gradient.end]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradient, { paddingTop: scaleSize(80), paddingBottom: scaleSize(60) }]}
        >
          <View style={styles.hero}>
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
              <Icon name="shield-check" size={scaleSize(72)} color={colors.onPrimary} />
            </View>
            <Typography variant="displaySmall" color={colors.onPrimary} style={styles.title}>{t('app.name')}</Typography>
            <Typography variant="titleMedium" color={colors.onPrimary} style={styles.subtitle}>{t('app.tagline')}</Typography>
          </View>
        </LinearGradient>

        <View style={[styles.features, { paddingHorizontal: spacing.xl }]}>
          <FeatureItem icon="shield-lock" title={t('welcome.features.secureStorage')} description={t('welcome.features.secureStorageDesc')} />
          <FeatureItem icon="fingerprint" title={t('welcome.features.biometricLock')} description={t('welcome.features.biometricLockDesc')} />
          <FeatureItem icon="sync" title={t('welcome.features.backup')} description={t('welcome.features.backupDesc')} />
        </View>

        <View style={[styles.actions, { paddingHorizontal: spacing.xl }]}>
          <Button title={t('auth.getStarted')} onPress={handleGetStarted} variant="primary" fullWidth size="lg" />
          <Button title={t('auth.existingVault')} onPress={handleExistingVault} variant="ghost" fullWidth style={styles.secondaryButton} />
        </View>
      </ScrollView>
    </TouchableWithoutFeedback>
  );
}

function FeatureItem({ icon, title, description }: { icon: keyof typeof import('@expo/vector-icons').MaterialCommunityIcons.glyphMap; title: string; description: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.featureItem}>
      <View style={[styles.featureIcon, { backgroundColor: colors.primaryContainer }]}>
        <Icon name={icon} size={28} color={colors.primary} />
      </View>
      <View style={styles.featureText}>
        <Typography variant="titleSmall">{title}</Typography>
        <Typography variant="bodySmall" color={colors.onSurfaceVariant}>{description}</Typography>
      </View>
    </View>
  );
}

export default memo(WelcomeScreenContent);

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1 },
  gradient: { alignItems: 'center' },
  hero: { alignItems: 'center' },
  iconContainer: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },
  title: { marginBottom: spacing.sm },
  subtitle: { opacity: 0.9 },
  features: { paddingVertical: spacing.xxl, gap: spacing.lg },
  featureItem: { flexDirection: 'row', alignItems: 'center' },
  featureIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginLeft: spacing.lg },
  featureText: { flex: 1 },
  actions: { paddingBottom: spacing.xxxl, gap: spacing.sm, marginTop: 'auto' },
  secondaryButton: { marginTop: spacing.xs },
});
