import { useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, Linking } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing, borderRadius } from '@core/theme';
import { ScreenLayout } from '@ui/components/organisms/ScreenLayout';
import { Typography } from '@ui/components/atoms/Typography';
import { Icon } from '@ui/components/atoms/Icon';
import { Card } from '@ui/components/atoms/Card';

const stats = [
  { icon: 'shield-check', value: 'أمان عسكري', label: 'تشفير AES-256-GCM', desc: 'بياناتك مشفرة بأقوى معايير التشفير العالمية' },
  { icon: 'layers', value: 'متعدد', label: 'أنواع الخزن', desc: 'ملفات، صور، ملاحظات، كلمات مرور — في مكان واحد' },
  { icon: 'lock', value: '100%', label: 'خصوصية تامة', desc: 'بياناتك لا تغادر جهازك أبداً — كل شيء مشفر محلياً' },
  { icon: 'fingerprint', value: 'بصمة', label: 'حماية بيومترية', desc: 'بصمة الإصبع أو التعرف على الوجه لفتح سريع وآمن' },
];

const values = [
  {
    icon: 'eye',
    titleKey: 'about.vision',
    descKey: 'about.visionDesc',
  },
  {
    icon: 'flag',
    titleKey: 'about.mission',
    descKey: 'about.missionDesc',
  },
  {
    icon: 'heart',
    titleKey: 'about.values',
    descKey: 'about.valuesDesc',
  },
];

const features = [
  { icon: 'encryption', titleKey: 'about.feature1Title', descKey: 'about.feature1Desc' },
  { icon: 'database', titleKey: 'about.feature2Title', descKey: 'about.feature2Desc' },
  { icon: 'shield-lock', titleKey: 'about.feature3Title', descKey: 'about.feature3Desc' },
];

const milestones = [
  { year: '2025', eventKey: 'about.m1Event', detailKey: 'about.m1Detail' },
  { year: '2025', eventKey: 'about.m2Event', detailKey: 'about.m2Detail' },
  { year: '2026', eventKey: 'about.m3Event', detailKey: 'about.m3Detail' },
  { year: '2026', eventKey: 'about.m4Event', detailKey: 'about.m4Detail' },
];

export default function AboutScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const handleTelegram = useCallback(() => {
    Linking.openURL('https://t.me/hqjjq6');
  }, []);

  const handleWhatsApp = useCallback(() => {
    Linking.openURL('https://wa.me/message/PXHGS5BKPSB2H1');
  }, []);

  return (
    <ScreenLayout title={t('about.title')} showBack onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <Card variant="filled" style={styles.heroCard}>
          <View style={styles.heroRow}>
            <Image
              source={require('../../../assets/images/osamah-portrait.jpg')}
              style={styles.heroImage}
              resizeMode="cover"
            />
            <View style={styles.heroTextContainer}>
              <View style={[styles.heroBadge, { backgroundColor: colors.primary + '15' }]}>
                <Icon name="shield-check" size={14} color={colors.primary} />
                <Typography variant="caption" color={colors.primary} style={styles.heroBadgeText}>
                  {t('about.heroBadge')}
                </Typography>
              </View>
              <Typography variant="titleLarge" style={styles.heroTitle}>{t('app.name')}</Typography>
              <Typography variant="bodyMedium" color={colors.onSurfaceVariant}>{t('about.heroSub')}</Typography>
              <Typography variant="bodySmall" color={colors.onSurfaceVariant} style={styles.heroDesc}>
                {t('about.heroDesc')}
              </Typography>
            </View>
          </View>
        </Card>

        {/* Vision / Mission / Values */}
        <View style={styles.section}>
          {values.map((v) => (
            <Card key={v.titleKey} variant="filled" style={styles.valueCard}>
              <View style={[styles.valueIcon, { backgroundColor: colors.primary + '15' }]}>
                <Icon name={v.icon as keyof typeof import('@expo/vector-icons').MaterialCommunityIcons.glyphMap} size={22} color={colors.primary} />
              </View>
              <Typography variant="titleSmall" style={styles.valueTitle}>{t(v.titleKey)}</Typography>
              <Typography variant="bodySmall" color={colors.onSurfaceVariant} style={styles.valueDesc}>{t(v.descKey)}</Typography>
            </Card>
          ))}
        </View>

        {/* Stats */}
        <View style={styles.section}>
          <Typography variant="titleMedium" style={styles.sectionTitle}>{t('about.whyTitle')}</Typography>
          <Typography variant="bodySmall" color={colors.onSurfaceVariant} style={styles.sectionSubtitle}>{t('about.whyDesc')}</Typography>
          <View style={styles.statsGrid}>
            {stats.map((s) => (
              <Card key={s.label} variant="filled" style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: colors.primary + '15' }]}>
                  <Icon name={s.icon as keyof typeof import('@expo/vector-icons').MaterialCommunityIcons.glyphMap} size={20} color={colors.primary} />
                </View>
                <Typography variant="titleLarge" color={colors.primary} style={styles.statValue}>{s.value}</Typography>
                <Typography variant="labelMedium" style={styles.statLabel}>{s.label}</Typography>
                <Typography variant="caption" color={colors.onSurfaceVariant} style={styles.statDesc}>{s.desc}</Typography>
              </Card>
            ))}
          </View>
        </View>

        {/* Features */}
        <View style={styles.section}>
          {features.map((f) => (
            <Card key={f.titleKey} variant="filled" style={styles.featureCard}>
              <View style={[styles.featureIcon, { backgroundColor: colors.primary + '15' }]}>
                <Icon name={f.icon as keyof typeof import('@expo/vector-icons').MaterialCommunityIcons.glyphMap} size={20} color={colors.primary} />
              </View>
              <View style={styles.featureText}>
                <Typography variant="bodyMedium" style={styles.featureTitle}>{t(f.titleKey)}</Typography>
                <Typography variant="caption" color={colors.onSurfaceVariant}>{t(f.descKey)}</Typography>
              </View>
            </Card>
          ))}
        </View>

        {/* Timeline */}
        <View style={styles.section}>
          <Typography variant="titleMedium" style={styles.sectionTitle}>{t('about.timeline')}</Typography>
          <Typography variant="bodySmall" color={colors.onSurfaceVariant} style={styles.sectionSubtitle}>{t('about.timelineDesc')}</Typography>
          {milestones.map((m, i) => {
            const isLast = i === milestones.length - 1;
            return (
              <View key={m.eventKey} style={styles.timelineItem}>
                <View style={styles.timelineDot}>
                  <View style={[styles.timelineDotInner, {
                    backgroundColor: isLast ? colors.primary : colors.surface,
                    borderColor: colors.primary,
                  }]} />
                  {!isLast && <View style={[styles.timelineLine, { backgroundColor: colors.outlineVariant }]} />}
                </View>
                <Card variant="filled" style={styles.timelineCard}>
                  <Typography variant="caption" color={colors.primary} style={styles.timelineYear}>{m.year}</Typography>
                  <Typography variant="bodyMedium" style={styles.timelineEvent}>{t(m.eventKey)}</Typography>
                  <Typography variant="caption" color={colors.onSurfaceVariant}>{t(m.detailKey)}</Typography>
                </Card>
              </View>
            );
          })}
        </View>

        {/* Founder */}
        <View style={styles.section}>
          <Typography variant="titleMedium" style={styles.sectionTitle}>{t('about.founderTitle')}</Typography>
          <Typography variant="bodySmall" color={colors.onSurfaceVariant} style={styles.sectionSubtitle}>{t('about.founderDesc')}</Typography>
          <Card variant="filled" style={styles.founderCard}>
            <Image
              source={require('../../../assets/images/osamah-avatar.jpg')}
              style={styles.founderAvatar}
              resizeMode="cover"
            />
            <Typography variant="titleSmall" style={styles.founderName}>{t('about.founderName')}</Typography>
            <Typography variant="caption" color={colors.onSurfaceVariant} style={styles.founderRole}>{t('about.founderRole')}</Typography>
            <Typography variant="bodySmall" color={colors.onSurfaceVariant} style={styles.founderBio}>{t('about.founderBio')}</Typography>
          </Card>
        </View>

        {/* Contact */}
        <Card variant="filled" style={styles.socialCard}>
          <Typography variant="titleSmall" style={styles.socialTitle}>{t('about.contactTitle')}</Typography>
          <Typography variant="bodySmall" color={colors.onSurfaceVariant} style={styles.socialDesc}>{t('about.contactDesc')}</Typography>
          <View style={styles.socialLinks}>
            <TouchableOpacity
              style={[styles.socialButton, { backgroundColor: '#229ED9' }]}
              onPress={handleTelegram}
              accessibilityRole="button"
              accessibilityLabel={t('about.telegram')}
            >
              <Icon name="send" size={16} color="#FFFFFF" />
              <Typography variant="labelMedium" color="#FFFFFF">{t('about.telegram')}</Typography>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.socialButton, { backgroundColor: '#25D366' }]}
              onPress={handleWhatsApp}
              accessibilityRole="button"
              accessibilityLabel={t('about.whatsapp')}
            >
              <Icon name="whatsapp" size={16} color="#FFFFFF" />
              <Typography variant="labelMedium" color="#FFFFFF">{t('about.whatsapp')}</Typography>
            </TouchableOpacity>
          </View>
        </Card>

        <Typography variant="caption" color={colors.onSurfaceVariant} style={styles.version}>Khaznati v1.0.0</Typography>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  heroCard: { padding: spacing.lg, marginBottom: spacing.lg },
  heroRow: { flexDirection: 'row', gap: spacing.md },
  heroImage: { width: 100, height: 140, borderRadius: borderRadius.md },
  heroTextContainer: { flex: 1 },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 20, alignSelf: 'flex-start', marginBottom: spacing.sm },
  heroBadgeText: { fontWeight: '600' },
  heroTitle: { marginBottom: spacing.xs },
  heroSub: { marginBottom: spacing.sm },
  heroDesc: { lineHeight: 20 },
  section: { marginBottom: spacing.xl },
  sectionTitle: { textAlign: 'center', marginBottom: spacing.xs },
  sectionSubtitle: { textAlign: 'center', marginBottom: spacing.md, paddingHorizontal: spacing.md },
  valueCard: { alignItems: 'center', padding: spacing.lg, marginBottom: spacing.sm },
  valueIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  valueTitle: { marginBottom: spacing.xs },
  valueDesc: { textAlign: 'center', lineHeight: 20 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: { width: '48%', alignItems: 'center', padding: spacing.md, flexGrow: 1 },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  statValue: { fontWeight: '800', marginBottom: 2 },
  statLabel: { fontWeight: '600', marginBottom: 2 },
  statDesc: { textAlign: 'center' },
  featureCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, marginBottom: spacing.sm, gap: spacing.md },
  featureIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1 },
  featureTitle: { marginBottom: 2 },
  timelineItem: { flexDirection: 'row', marginBottom: 0 },
  timelineDot: { width: 28, alignItems: 'center', paddingTop: 6 },
  timelineDotInner: { width: 16, height: 16, borderRadius: 8, borderWidth: 2.5, zIndex: 2 },
  timelineLine: { width: 2, flex: 1, marginTop: -2 },
  timelineCard: { flex: 1, marginBottom: spacing.sm, marginLeft: spacing.xs, padding: spacing.md },
  timelineYear: { fontWeight: '700', marginBottom: 2 },
  timelineEvent: { fontWeight: '600', marginTop: 2, marginBottom: 4 },
  founderCard: { alignItems: 'center', padding: spacing.xl, marginBottom: spacing.sm },
  founderAvatar: { width: 72, height: 72, borderRadius: 20, marginBottom: spacing.md },
  founderName: { marginBottom: spacing.xs },
  founderRole: { textAlign: 'center', marginBottom: spacing.md },
  founderBio: { textAlign: 'center', lineHeight: 22 },
  socialCard: { alignItems: 'center', padding: spacing.xl, marginBottom: spacing.sm },
  socialTitle: { marginBottom: spacing.sm },
  socialDesc: { textAlign: 'center', marginBottom: spacing.lg, lineHeight: 20 },
  socialLinks: { flexDirection: 'row', gap: spacing.md },
  socialButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 10 },
  version: { textAlign: 'center', marginTop: spacing.xl },
});
