import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Share, Linking, PermissionsAndroid, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { File } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@ui/providers/ThemeProvider';
import { ScreenLayout } from '@ui/components/organisms/ScreenLayout';
import { Loading } from '@ui/components/atoms/Loading';
import { ErrorView } from '@ui/components/atoms/ErrorView';
import { Icon } from '@ui/components/atoms/Icon';
import { SearchBar } from '@ui/components/molecules/SearchBar';
import { SelectionBar } from '@ui/components/organisms/SelectionBar';
import { MediaItem } from '@ui/components/molecules/MediaThumb';
import { MediaPreview } from '@ui/components/molecules/MediaPreview';
import { MediaGallery } from '@ui/components/molecules/MediaGallery';
import { useTranslation } from 'react-i18next';
import { encryptFile } from '@core/utils/crypto';
import { getVaultKey, getEncryptedDir, persistEncryptedImage, exportDecryptedToLibrary, readAndDecryptFile } from '@data/media/MediaStorage';

export default function MediaScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { vaultId } = useLocalSearchParams<{ vaultId: string }>();
  const vid = vaultId || 'default';
  const [media, setMedia] = useState<MediaItem[]>([]);
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
        onPress: (): void => {
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

  const requestMediaPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'android' && (Platform.Version as number) <= 32) {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE, {
        title: t('errors.permissionTitle'),
        message: t('errors.permissionRationale'),
        buttonPositive: t('settings.openSettings'),
        buttonNegative: t('common.cancel'),
      });
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    const { status } = await MediaLibrary.getPermissionsAsync();
    if (status === 'granted') return true;
    const req = await MediaLibrary.requestPermissionsAsync();
    return req.status === 'granted';
  }, [t]);

  const handleImport = useCallback(async () => {
    try {
      const allowed = await requestMediaPermission();
      if (!allowed) {
        Alert.alert(t('common.error'), t('errors.permissionRationale'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('settings.openSettings'), onPress: () => void Linking.openSettings() },
        ]);
        return;
      }
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
      const key = await getVaultKey(vid);
      const encryptedBase64 = await encryptFile(key, asset.base64);
      await persistEncryptedImage({
        vaultId: vid,
        name: asset.fileName || 'photo.jpg',
        mimeType: asset.mimeType || 'image/jpeg',
        size: asset.fileSize || 0,
        encryptedBase64,
      });
      loadMedia();
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    }
  }, [vid, loadMedia, t, requestMediaPermission]);

  const handleView = useCallback(async (item: MediaItem) => {
    try {
      const key = await getVaultKey(vid);
      const decryptedBase64 = await readAndDecryptFile(key, item.encryptedPath);
      setMedia((prev) => prev.map((m) => (m.id === item.id ? { ...m, decryptedUri: `data:image/jpeg;base64,${decryptedBase64}` } : m)));
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    }
  }, [vid, t]);

  const handleExport = useCallback(async (item: MediaItem) => {
    try {
      const key = await getVaultKey(vid);
      const decryptedBase64 = await readAndDecryptFile(key, item.encryptedPath);

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.error'), t('errors.permissionRationale'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('settings.openSettings'), onPress: () => void Linking.openSettings() },
        ]);
        return;
      }

      await exportDecryptedToLibrary(item.name, decryptedBase64);

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
        <MediaPreview
          item={selectedItem}
          onBack={() => setMedia((prev) => prev.map((m) => ({ ...m, decryptedUri: null })))}
          onExport={() => handleExport(selectedItem)}
        />
      ) : (
        <View style={styles.flexOne}>
          <SearchBar value={search} onChangeText={setSearch} placeholder={t('media.search')} onClear={() => setSearch('')} />
          <SelectionBar
            selectedCount={selectedIds.size}
            onClearSelection={clearSelection}
            actions={[
              { icon: 'share-variant', label: t('common.share'), onPress: handleBatchShare },
              { icon: 'delete', label: t('common.delete'), onPress: handleBatchDelete, destructive: true },
            ]}
          />
          <MediaGallery
            items={filteredMedia}
            search={search}
            refreshing={refreshing}
            selectedIds={selectedIds}
            onRefresh={handleRefresh}
            onToggle={toggleSelection}
            onView={handleView}
            onImport={handleImport}
          />
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
