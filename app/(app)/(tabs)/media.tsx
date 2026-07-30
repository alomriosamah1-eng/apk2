import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, StyleSheet, RefreshControl, Dimensions, ScrollView, TouchableOpacity, Alert, Share } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { Paths, Directory, File } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing, borderRadius } from '@core/theme';
import { ScreenLayout } from '@ui/components/organisms/ScreenLayout';
import { EmptyState } from '@ui/components/atoms/EmptyState';
import { Loading } from '@ui/components/atoms/Loading';
import { ErrorView } from '@ui/components/atoms/ErrorView';
import { Typography } from '@ui/components/atoms/Typography';
import { Icon } from '@ui/components/atoms/Icon';
import { SearchBar } from '@ui/components/molecules/SearchBar';
import { SelectionBar } from '@ui/components/organisms/SelectionBar';
import { useTranslation } from 'react-i18next';
import { encryptFile, decryptFile, generateEncryptionKey } from '@core/utils/crypto';
import { DIContainer } from '@core/di/container';
import { SecureStorageSource } from '@data/datasources/SecureStorageSource';
import { IItemRepository } from '@domain/repositories/IItemRepository';
import { ItemType } from '@core/constants';
import { generateId } from '@core/utils';

const NUM_COLUMNS = 3;
const SCREEN_WIDTH = Dimensions.get('window').width;
const ITEM_SIZE = (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

interface MediaItem {
  id: string;
  name: string;
  encryptedPath: string;
  decryptedUri: string | null;
}

async function getVaultKey(vaultId: string): Promise<string> {
  const storage = DIContainer.resolve<SecureStorageSource>('SecureStorageSource');
  const keyKey = `media_vault_key_${vaultId}`;
  let key = await storage.get(keyKey);
  if (!key) {
    key = await generateEncryptionKey();
    await storage.set(keyKey, key);
  }
  return key;
}

function getEncryptedDir(vaultId: string): Directory {
  return new Directory(Paths.document, 'khaznati', vaultId || 'default', '.encrypted_media');
}

export default function MediaScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { vaultId } = useLocalSearchParams<{ vaultId: string }>();
  const vid = vaultId || 'default';
  const [media, setMedia] = useState<MediaItem[]>([]);

  const itemRepo = useMemo(
    () => DIContainer.resolve<IItemRepository>('ItemRepository'),
    [],
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadMedia = useCallback(async () => {
    try {
      setError(null);
      const encDir = getEncryptedDir(vid);
      if (!encDir.exists) {
        setMedia([]);
        return;
      }
      const list = encDir.list();
      const items: MediaItem[] = list
        .filter((entry) => entry.name.endsWith('.enc'))
        .map((entry) => ({
          id: entry.uri,
          name: entry.name.replace(/\.enc$/, ''),
          encryptedPath: entry.uri,
          decryptedUri: null,
        }));
      setMedia(items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vid]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadMedia();
  }, [loadMedia]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleBatchDelete = useCallback(() => {
    Alert.alert(t('common.delete'), t('media.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          selectedIds.forEach((id) => {
            const item = media.find((m) => m.id === id);
            if (item) new File(item.encryptedPath).delete();
          });
          clearSelection();
          loadMedia();
        },
      },
    ]);
  }, [selectedIds, media, clearSelection, loadMedia, t]);

  const handleBatchShare = useCallback(async () => {
    const selected = media.filter((m) => selectedIds.has(m.id));
    const names = selected.map((m) => m.name).join(', ');
    await Share.share({ message: names });
  }, [selectedIds, media]);

  const handleImport = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert(t('common.error'), t('errors.general'));
        return;
      }

      const encDir = getEncryptedDir(vid);
      if (!encDir.exists) encDir.create({ intermediates: true, idempotent: true });

      const key = await getVaultKey(vid);
      const encryptedBase64 = await encryptFile(key, asset.base64);

      const ext = (asset.fileName || 'photo.jpg').split('.').pop() || 'jpg';
      const encFileName = `${Date.now()}.${ext}.enc`;
      const encFile = new File(encDir, encFileName);
      await encFile.write(encryptedBase64);

      await itemRepo.create({
        id: generateId(),
        vaultId: vid,
        parentId: null,
        name: asset.fileName || 'photo.jpg',
        type: ItemType.IMAGE,
        mimeType: asset.mimeType || 'image/jpeg',
        size: asset.fileSize || 0,
        encryptedPath: encFile.uri,
        encryptedData: null,
        thumbnailPath: null,
        metadata: null,
        isFavorite: false,
        isDeleted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deletedAt: null,
      });

      loadMedia();
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    }
  }, [vid, loadMedia, t]);

  const handleView = useCallback(async (item: MediaItem) => {
    try {
      const key = await getVaultKey(vid);
      const encFile = new File(item.encryptedPath);
      const encryptedBase64 = await encFile.text();
      const decryptedBase64 = await decryptFile(key, encryptedBase64);
      setMedia((prev) => prev.map((m) => (m.id === item.id ? { ...m, decryptedUri: `data:image/jpeg;base64,${decryptedBase64}` } : m)));
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    }
  }, [vid, t]);

  const handleExport = useCallback(async (item: MediaItem) => {
    try {
      const key = await getVaultKey(vid);
      const encFile = new File(item.encryptedPath);
      const encryptedBase64 = await encFile.text();
      const decryptedBase64 = await decryptFile(key, encryptedBase64);

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.error'), t('errors.general'));
        return;
      }

      const tempDir = new Directory(Paths.cache, 'khaznati_export');
      if (!tempDir.exists) tempDir.create({ intermediates: true, idempotent: true });
      const tempFile = new File(tempDir, item.name);
      await tempFile.write(decryptedBase64);

      await MediaLibrary.saveToLibraryAsync(tempFile.uri);
      tempFile.delete();

      Alert.alert(t('common.success'), t('media.exportSuccess'));
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    }
  }, [vid, t]);

  const filteredMedia = search
    ? media.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
    : media;

  const selectedItem = filteredMedia.find((m) => m.decryptedUri);

  if (loading && media.length === 0) {
    return <Loading fullScreen message={t('common.loading')} />;
  }

  if (error && media.length === 0) {
    return <ErrorView message={error} onRetry={loadMedia} />;
  }

  return (
    <ScreenLayout title={t('media.title')} subtitle={t('vault.itemsCount', { count: media.length })} showBack onBack={() => router.push({ pathname: '/(app)/(tabs)/vault', params: { vaultId: vid } })}>
      {selectedItem ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: selectedItem.decryptedUri! }} style={styles.previewImage} contentFit="contain" accessibilityLabel={selectedItem.name} />
          <View style={styles.previewActions}>
            <TouchableOpacity onPress={() => setMedia((prev) => prev.map((m) => ({ ...m, decryptedUri: null })))} style={[styles.previewBtn, { borderColor: colors.outline }]}>
              <Typography>{t('common.back')}</Typography>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleExport(selectedItem)} style={[styles.previewBtn, { backgroundColor: colors.primary }]}>
              <Typography color="#FFFFFF">{t('media.export')}</Typography>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.flexOne}>
          <SearchBar value={search} onChangeText={setSearch} placeholder={t('media.search') || 'Search'} onClear={() => setSearch('')} />
          <SelectionBar
            selectedCount={selectedIds.size}
            onClearSelection={clearSelection}
            actions={[
              { icon: 'share-variant', label: t('common.share'), onPress: handleBatchShare },
              { icon: 'delete', label: t('common.delete'), onPress: handleBatchDelete, destructive: true },
            ]}
          />
          <ScrollView
            contentContainerStyle={styles.grid}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
            showsVerticalScrollIndicator={false}
          >
            {filteredMedia.length === 0 ? (
              <EmptyState
                icon="image-multiple-outline"
                title={search ? t('common.noResults') : t('media.empty')}
                description={search ? t('common.noResults') : t('media.emptyDesc')}
                actionLabel={search ? undefined : t('files.addFile')}
                onAction={search ? undefined : handleImport}
              />
            ) : (
              <View style={styles.gridRow}>
                {filteredMedia.map((item, index) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => handleView(item)}
                    onLongPress={() => toggleSelection(item.id)}
                    style={styles.mediaItem}
                  >
                    <View style={[styles.thumbnail, { backgroundColor: colors.surfaceVariant }]}>
                      {selectedIds.has(item.id) && (
                        <View style={[styles.checkOverlay, { backgroundColor: colors.primary + '33' }]}>
                          <Icon name="check-circle" size={24} color={colors.primary} />
                        </View>
                      )}
                      <Icon name="image" size={28} color={colors.onSurfaceVariant} />
                      {index < 3 && (
                        <Typography variant="caption" color={colors.onSurfaceVariant} style={styles.fileName} numberOfLines={1}>
                          {item.name}
                        </Typography>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      )}
      {!selectedItem && (
        <TouchableOpacity
          onPress={handleImport}
          style={[styles.fab, { backgroundColor: colors.primary }]}
          activeOpacity={0.8}
          accessibilityLabel={t('files.addFile')}
          accessibilityRole="button"
        >
          <Icon name="plus" size={28} color={colors.onPrimary} />
        </TouchableOpacity>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  flexOne: { flex: 1 },
  grid: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  mediaItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  fileName: {
    marginTop: spacing.xs,
    paddingHorizontal: 4,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  previewImage: {
    flex: 1,
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: spacing.lg,
    gap: spacing.md,
  },
  previewBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
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
  },
});
