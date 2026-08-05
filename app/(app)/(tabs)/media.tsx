import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Share, Linking, PermissionsAndroid, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
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
import { getVaultKey, readAndDecryptFileBytes, deleteImportedSource, pickSafDirectory, itemTypeForMime, resolveAudioMime, exportUnits, importUnits, type ExportUnitInput, type ExportMode, type ExportBatchReport, type ImportUnitSource, type ImportBatchReport } from '@data/media/MediaStorage';
import { confirmBody, successBody, deleteSuccessBody, batchReportBody } from '@ui/utils/itemMessages';
import { OperationProgress } from '@ui/components/organisms/OperationProgress';
import { useOperationProgress } from '@ui/hooks/useOperationProgress';
import { DIContainer } from '@core/di/container';
import { IItemRepository } from '@domain/repositories/IItemRepository';
import { ItemType, ActivityAction } from '@core/constants';
import { ActivityLogRepositoryImpl } from '@data/repositories/ActivityLogRepositoryImpl';

export default function MediaScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { vaultId, type } = useLocalSearchParams<{ vaultId: string; type?: string }>();
  const vid = vaultId || 'default';
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);

  const activeTypes = useMemo(() => {
    const allowed = new Set<ItemType>([ItemType.IMAGE, ItemType.VIDEO, ItemType.AUDIO]);
    if (type === 'video') return new Set<ItemType>([ItemType.VIDEO]);
    if (type === 'audio') return new Set<ItemType>([ItemType.AUDIO]);
    if (type === 'image') return new Set<ItemType>([ItemType.IMAGE]);
    return allowed;
  }, [type]);

  const itemRepo = useMemo(
    () => DIContainer.resolve<IItemRepository>('ItemRepository'),
    [],
  );

  const op = useOperationProgress();

  const logActivity = useCallback((action: ActivityAction, targetType: string, id?: string, metadata?: Record<string, unknown>) => {
    const repo = DIContainer.resolve<ActivityLogRepositoryImpl>('ActivityLogRepository');
    void repo.log(action, targetType, id, metadata);
  }, []);

  const loadMedia = useCallback(async () => {
    try {
      setError(null);
      const result = await itemRepo.findByVaultId(vid);
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      const items: MediaItem[] = result.data
        .filter((it) => activeTypes.has(it.type))
        .map((it) => ({
          id: it.encryptedPath ?? it.id,
          dbId: it.id,
          name: it.name,
          type: it.type,
          mimeType: it.mimeType,
          encryptedPath: it.encryptedPath ?? it.id,
          decryptedUri: null,
          size: it.size,
          durationMs: Number((it.metadata as Record<string, unknown> | null)?.['duration_ms']) || undefined,
        }));
      setMedia(items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [itemRepo, vid, activeTypes]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadMedia();
  }, [loadMedia]);

  const toggleSelection = useCallback((id: string) => {
    if (!isSelecting) setIsSelecting(true);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, [isSelecting]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelecting(false);
  }, []);

  const removeItemFiles = useCallback((item: MediaItem) => {
    if (item.dbId) void itemRepo.delete(item.dbId);
    try { new File(item.encryptedPath).delete(); } catch { /* best-effort */ }
  }, [itemRepo]);

  const handleBatchDelete = useCallback(() => {
    const selected = media.filter((m) => selectedIds.has(m.id));
    if (selected.length === 0) return;
    Alert.alert(t('common.delete'), confirmBody(t, selected, 'deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: (): void => {
          selected.forEach(removeItemFiles);
          clearSelection();
          loadMedia();
          Alert.alert(t('common.success'), deleteSuccessBody(t, selected));
        },
      },
    ]);
  }, [selectedIds, media, removeItemFiles, clearSelection, loadMedia, t]);

  const handleBatchShare = useCallback(async () => {
    const selected = media.filter((m) => selectedIds.has(m.id));
    const names = selected.map((m) => m.name).join(', ');
    await Share.share({ message: names });
  }, [selectedIds, media]);

  const handleImport = useCallback(async () => {
    try {
      const isAudioOnly = activeTypes.has(ItemType.AUDIO) && !activeTypes.has(ItemType.IMAGE) && !activeTypes.has(ItemType.VIDEO);
      const sources: ImportUnitSource[] = [];
      const assetIds = new Map<string, string | undefined>();

      if (isAudioOnly) {
        // Audio cannot be picked by ImagePicker; use the document picker with no
        // mime filter (some providers label audio as application/octet-stream and
        // an `audio/*` filter would hide them). Real audio is detected by
        // resolveAudioMime using mime + extension, so ALL formats are supported.
        const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: true });
        if (result.canceled || result.assets.length === 0) return;
        for (const asset of result.assets) {
          const mime = resolveAudioMime(asset.mimeType, asset.name);
          if (!mime) continue;
          sources.push({
            uri: asset.uri,
            name: asset.name || `audio_${Date.now()}.${audioMimeToExt(mime)}`,
            mimeType: mime,
          });
        }
        if (sources.length === 0) {
          Alert.alert(t('common.error'), t('media.noAudioFiles'));
          return;
        }
      } else {
        if (Platform.OS === 'android' && (Platform.Version as number) <= 32) {
          const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE, {
            title: t('errors.permissionTitle'),
            message: t('errors.permissionRationale'),
            buttonPositive: t('settings.openSettings'),
            buttonNegative: t('common.cancel'),
          });
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert(t('common.error'), t('errors.permissionRationale'), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('settings.openSettings'), onPress: () => void Linking.openSettings() },
            ]);
            return;
          }
        }
        const pickerTypes: ImagePicker.MediaType[] =
          activeTypes.has(ItemType.VIDEO)
            ? ['images', 'videos']
            : ['images'];
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: pickerTypes,
          allowsMultipleSelection: true,
        });
        if (result.canceled || result.assets.length === 0) return;

        for (const asset of result.assets) {
          const resolvedMime = resolveAudioMime(asset.mimeType, asset.fileName) || asset.mimeType || undefined;
          const it = itemTypeForMime(resolvedMime);
          if (!activeTypes.has(it)) continue;
          const ext = it === ItemType.VIDEO
            ? 'mp4'
            : it === ItemType.AUDIO
              ? asset.fileName?.split('.').pop() || 'm4a'
              : asset.fileName?.split('.').pop() || 'jpg';
          const name = asset.fileName || `${Date.now()}.${ext}`;
          assetIds.set(asset.uri, asset.assetId ?? undefined);
          sources.push({ uri: asset.uri, name, mimeType: resolvedMime ?? null });
        }
        if (sources.length === 0) return;
      }

      op.begin(sources.length);
      try {
        const report: ImportBatchReport = await importUnits({
          vaultId: vid,
          sources,
          dedupe: true,
          onProgress: op.update,
          shouldCancel: op.isCancelled,
          onSourceImported: async (src) => {
            try {
              await deleteImportedSource(src.uri, assetIds.get(src.uri));
            } catch { /* best-effort cleanup of the picked copy */ }
          },
        });

        if (report.imported > 0) {
          logActivity(ActivityAction.ADD_ITEM, 'item', undefined, { vaultId: vid, name: `${report.imported} media item(s)` });
        }
        loadMedia();

        if (report.failed > 0 || report.cancelled) {
          const parts = [
            t('progress.files', { done: report.imported, total: sources.length }),
          ];
          if (report.skippedDuplicates > 0) parts.push(t('media.importSkippedCount', { count: report.skippedDuplicates }));
          if (report.failed > 0) parts.push(t('media.importFailedCount', { count: report.failed }));
          if (report.cancelled) parts.push(t('progress.cancelled'));
          for (const err of report.errors.slice(0, 3)) parts.push(`- ${err.name}: ${err.message}`);
          Alert.alert(t('common.error'), parts.join('\n'));
        } else {
          Alert.alert(t('common.success'), t('media.importSummary', {
            imported: report.imported,
            skipped: report.skippedDuplicates,
            failed: report.failed,
          }));
        }
      } finally {
        op.finish();
      }
    } catch (err) {
      op.finish();
      Alert.alert(t('common.error'), (err as Error).message);
    }
  }, [vid, loadMedia, t, activeTypes, op]);

  const handleView = useCallback(async (item: MediaItem) => {
    if (item.type === ItemType.IMAGE) {
      try {
        const key = await getVaultKey(vid);
        const plain = await readAndDecryptFileBytes(key, item.encryptedPath);
        const base64 = bytesToBase64Url(plain);
        setMedia((prev) => prev.map((m) => (m.id === item.id ? { ...m, decryptedUri: `data:image/jpeg;base64,${base64}` } : m)));
      } catch (err) {
        Alert.alert(t('common.error'), (err as Error).message);
      }
    } else {
      router.push({
        pathname: '/(app)/modals/file-preview',
        params: {
          fileName: item.name,
          uri: item.encryptedPath,
          vaultId: vid,
          type: item.type,
          dbId: item.dbId || '',
          size: String(item.size ?? ''),
        },
      });
    }
  }, [vid, t]);

  const runExport = useCallback(async (selected: MediaItem[], mode: ExportMode) => {
    try {
      const units: ExportUnitInput[] = selected.map((m) => ({
        encryptedPath: m.encryptedPath,
        dbId: m.dbId,
        name: m.name,
        mimeType: m.mimeType,
      }));
      const mediaOnly = units.every((u) => {
        const mime = (u.mimeType || '').toLowerCase();
        return mime.startsWith('image/') || mime.startsWith('video/') || mime.startsWith('audio/');
      });
      let directoryUri: string | null = null;
      if (!mediaOnly) {
        directoryUri = await pickSafDirectory();
        if (!directoryUri) return; // user cancelled the folder picker
      }
      op.begin(units.length);
      try {
        const report: ExportBatchReport = await exportUnits({
          vaultId: vid,
          items: units,
          mode,
          directoryUri,
          onProgress: (u) =>
            op.update({
              phase: 'writing',
              done: u.done,
              total: u.total,
              currentName: u.currentName,
              bytesProcessed: 0,
              elapsedMs: u.elapsedMs,
              speedBytesPerSec: 0,
            }),
          shouldCancel: op.isCancelled,
        });
        if (mode === 'extract') {
          loadMedia();
          clearSelection();
        }
        if (report.failed > 0 || report.cancelled > 0) {
          Alert.alert(t('common.error'), batchReportBody(t, report));
        } else if (mode === 'extract') {
          Alert.alert(t('common.success'), successBody(t, selected, 'extractSuccess'));
        } else {
          Alert.alert(t('common.success'), successBody(t, selected, 'copySuccess'));
        }
        return;
      } finally {
        op.finish();
      }
    } catch (err) {
      op.finish();
      Alert.alert(t('common.error'), (err as Error).message);
    }
  }, [vid, loadMedia, clearSelection, t, op]);

  const chooseExport = useCallback((selected: MediaItem[]) => {
    if (selected.length === 0) return;
    Alert.alert(t('action.extractTitle'), `${confirmBody(t, selected, 'extractConfirm')}\n\n${t('action.extractHint')}`, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('action.copy'), onPress: (): void => void runExport(selected, 'copy') },
      { text: t('action.extract'), onPress: (): void => void runExport(selected, 'extract') },
    ]);
  }, [t, runExport]);

  const handleExport = useCallback((item: MediaItem) => {
    chooseExport([item]);
  }, [chooseExport]);

  const handleBatchExport = useCallback(() => {
    chooseExport(media.filter((m) => selectedIds.has(m.id)));
  }, [chooseExport, selectedIds, media]);

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
    <ScreenLayout
      title={activeTypes.has(ItemType.VIDEO) ? t('media.videos') : activeTypes.has(ItemType.AUDIO) ? t('media.audio') : t('media.photos')}
      subtitle={t('vault.itemsCount', { count: media.length })}
      showBack
      onBack={() => router.push({ pathname: '/(app)/(tabs)/vault', params: { vaultId: vid } })}
    >
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
              { icon: 'export', label: t('files.export'), onPress: handleBatchExport },
              { icon: 'delete', label: t('common.delete'), onPress: handleBatchDelete, destructive: true },
            ]}
          />
          <MediaGallery
            items={filteredMedia}
            search={search}
            refreshing={refreshing}
            isSelecting={isSelecting}
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
      <OperationProgress progress={op.progress} onCancel={op.cancel} />
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

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Maps an audio mime to a preferred file extension for files without a name. */
function audioMimeToExt(mime: string): string {
  const known: Record<string, string> = {
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/aac': 'aac',
    'audio/mp4': 'm4a',
    'audio/flac': 'flac',
    'audio/amr': 'amr',
    'audio/amr-wb': 'awb',
    'audio/midi': 'mid',
    'audio/x-ms-wma': 'wma',
    'audio/x-aiff': 'aiff',
    'audio/x-ape': 'ape',
    'audio/x-caf': 'caf',
    'audio/webm': 'weba',
    'audio/x-matroska': 'mka',
    'audio/ac3': 'ac3',
    'audio/eac3': 'eac3',
    'audio/vnd.dts': 'dts',
    'audio/x-wavpack': 'wv',
    'audio/basic': 'au',
  };
  const ext = mime.split('/')[1];
  if (!ext) return 'audio';
  return known[mime] ?? ext.replace(/^x-/, '');
}
