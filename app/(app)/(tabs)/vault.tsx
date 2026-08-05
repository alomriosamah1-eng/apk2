import { useState, useCallback, memo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions, BackHandler, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing, borderRadius, elevations } from '@core/theme';
import { ScreenLayout } from '@ui/components/organisms/ScreenLayout';
import { Icon } from '@ui/components/atoms/Icon';
import { Typography } from '@ui/components/atoms/Typography';
import VaultListSheet from '@ui/components/organisms/VaultListSheet';
import { useVaults } from '@ui/hooks/useVaults';
import { useSession } from '@ui/providers/SessionProvider';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_GAP = spacing.sm;
const HORIZONTAL_PADDING = spacing.lg;
const COLUMNS = 3;
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - CARD_GAP * (COLUMNS - 1)) / COLUMNS);
const CARD_HEIGHT = 120;

interface QuickCard {
  id: string;
  icon: keyof typeof import('@expo/vector-icons').MaterialCommunityIcons.glyphMap;
  labelKey: string;
  color: string;
  iconBg: string;
}

function VaultScreenContent() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { vaults } = useVaults();
  const { lock: lockSession } = useSession();
  const { vaultId: activeVaultId } = useLocalSearchParams<{ vaultId: string }>();
  const currentVault = activeVaultId ? vaults.find((v) => v.id === activeVaultId) : vaults[0];
  const [showVaultList, setShowVaultList] = useState(false);

  const quickCards: QuickCard[] = [
    { id: 'files', icon: 'folder', labelKey: 'files.title', color: '#6C63FF', iconBg: colors.primaryContainer },
    { id: 'photos', icon: 'image', labelKey: 'media.photos', color: '#FF6584', iconBg: colors.tertiaryContainer },
    { id: 'video', icon: 'video', labelKey: 'media.videos', color: '#03DAC5', iconBg: colors.secondaryContainer },
    { id: 'audio', icon: 'music', labelKey: 'media.audio', color: '#FFB74D', iconBg: '#FFF3E0' },
    { id: 'notes', icon: 'note-text', labelKey: 'notes.title', color: '#66BB6A', iconBg: '#E8F5E9' },
    { id: 'passwords', icon: 'key', labelKey: 'passwords.title', color: '#AB47BC', iconBg: '#F3E5F5' },
  ];

  const handleCardPress = useCallback((card: QuickCard) => {
    const vid = activeVaultId || currentVault?.id;
    switch (card.id) {
      case 'files':
        router.push({ pathname: '/(app)/(tabs)/files', params: { vaultId: vid } });
        break;
      case 'photos':
        router.push({ pathname: '/(app)/(tabs)/media', params: { vaultId: vid, type: 'image' } });
        break;
      case 'video':
        router.push({ pathname: '/(app)/(tabs)/media', params: { vaultId: vid, type: 'video' } });
        break;
      case 'audio':
        router.push({ pathname: '/(app)/(tabs)/media', params: { vaultId: vid, type: 'audio' } });
        break;
      case 'notes':
        router.push({ pathname: '/(app)/(tabs)/notes', params: { vaultId: vid } });
        break;
      case 'passwords':
        router.push({ pathname: '/(app)/(tabs)/passwords', params: { vaultId: vid } });
        break;
    }
  }, [activeVaultId, currentVault?.id]);

  const handleSettings = useCallback(() => {
    router.push('/(app)/(tabs)/settings');
  }, []);

  const handleVaultList = useCallback(() => {
    setShowVaultList(true);
  }, []);

  const handleExit = useCallback(() => {
    if (Platform.OS === 'android') {
      BackHandler.exitApp();
    } else {
      lockSession();
      router.replace('/(auth)/login');
    }
  }, [lockSession]);

  return (
    <ScreenLayout
      title={t('app.name')}
      subtitle={currentVault ? currentVault.name : t('vault.titleWithCount', { count: vaults.length })}
      rightAction={
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleVaultList} accessibilityLabel={t('vault.title')}>
            <Icon name="format-list-bulleted" size={24} color={colors.onSurface} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSettings} accessibilityLabel={t('settings.title')}>
            <Icon name="cog" size={24} color={colors.onSurface} />
          </TouchableOpacity>
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {quickCards.map((card) => (
            <TouchableOpacity
              key={card.id}
              onPress={() => handleCardPress(card)}
              style={[styles.card, { backgroundColor: colors.surface, ...elevations[2] }]}
              activeOpacity={0.7}
            >
              <View style={[styles.cardIcon, { backgroundColor: card.iconBg }]}>
                <Icon name={card.icon} size={24} color={card.color} />
              </View>
              <Typography variant="bodySmall" style={styles.cardLabel}>
                {t(card.labelKey)}
              </Typography>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity
        onPress={handleExit}
        style={[styles.fab, { backgroundColor: colors.error }]}
        activeOpacity={0.8}
        accessibilityLabel={t('settings.quickExit')}
        accessibilityRole="button"
      >
        <Icon name="exit-run" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <VaultListSheet visible={showVaultList} onClose={() => setShowVaultList(false)} />
    </ScreenLayout>
  );
}

export default memo(VaultScreenContent);

const styles = StyleSheet.create({
  container: {
    padding: HORIZONTAL_PADDING,
    paddingTop: spacing.lg,
    paddingBottom: 100,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    ...elevations[4],
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
});
