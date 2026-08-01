import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, StyleSheet, Alert, Share, Linking } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Paths, File, Directory } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useTranslation } from 'react-i18next';
import { ScreenLayout } from '@ui/components/organisms/ScreenLayout';
import { SearchBar } from '@ui/components/molecules/SearchBar';
import { SelectionBar } from '@ui/components/organisms/SelectionBar';
import { FilesList } from '@ui/components/organisms/FilesList';
import { RenameEditor } from '@ui/components/organisms/RenameEditor';
import { FloatingButton } from '@ui/components/molecules/FloatingButton';
import { Loading } from '@ui/components/atoms/Loading';
import { ErrorView } from '@ui/components/atoms/ErrorView';
import { FileItem } from '@ui/components/molecules/FileRow';
import { DIContainer } from '@core/di/container';
import { IItemRepository } from '@domain/repositories/IItemRepository';
import { ItemType, ActivityAction } from '@core/constants';
import { generateId } from '@core/utils';
import { encryptFile } from '@core/utils/crypto';
import { getVaultKey, exportDecryptedToLibrary, readAndDecryptFile } from '@data/media/MediaStorage';
import { ActivityLogRepositoryImpl } from '@data/repositories/ActivityLogRepositoryImpl';

function getVaultDir(vaultId: string): Directory {
  return new Directory(Paths.document, 'khaznati', vaultId || 'default');
}

function logItemActivity(action: ActivityAction, vaultId: string, itemName: string): void {
  const repo = DIContainer.resolve<ActivityLogRepositoryImpl>('ActivityLogRepository');
  void repo.log(action, 'item', undefined, { vaultId, name: itemName });
}

export default function FilesScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const { vaultId } = useLocalSearchParams<{ vaultId: string }>();
  const vid = vaultId || 'default';
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [renameTarget, setRenameTarget] = useState<FileItem | null>(null);
  const [renameText, setRenameText] = useState('');

  const itemRepo = useMemo(
    () => DIContainer.resolve<IItemRepository>('ItemRepository'),
    [],
  );

  const loadFiles = useCallback(async () => {
    try {
      setError(null);
      const result = await itemRepo.findByVaultId(vid);
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      const items: FileItem[] = result.data.map((it) => ({
        id: it.encryptedPath ?? it.id,
        dbId: it.id,
        name: it.name,
        type: it.type === ItemType.FOLDER ? 'folder' : 'file',
        size: it.size,
        createdAt: it.createdAt,
      }));
      setFiles(items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [itemRepo, vid]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadFiles();
  }, [loadFiles]);

  const handleImport = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const key = await getVaultKey(vid);
      const srcFile = new File(asset.uri);
      const base64Data = await srcFile.base64();
      const encryptedBase64 = await encryptFile(key, base64Data);

      const vaultDir = getVaultDir(vid);
      if (!vaultDir.exists) vaultDir.create({ intermediates: true, idempotent: true });
      const encFileName = `${Date.now()}.${asset.name}.enc`;
      const encFile = new File(vaultDir, encFileName);
      await encFile.write(encryptedBase64);

      await itemRepo.create({
        id: generateId(),
        vaultId: vid,
        parentId: null,
        name: asset.name,
        type: ItemType.FILE,
        mimeType: asset.mimeType || null,
        size: asset.size || 0,
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

      logItemActivity(ActivityAction.ADD_ITEM, vid, asset.name);
      loadFiles();
    } catch (err) {
      setError((err as Error).message);
    }
  }, [loadFiles, itemRepo, vid]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const clearRename = useCallback(() => {
    setRenameTarget(null);
    setRenameText('');
  }, []);

  const handleBatchDelete = useCallback(() => {
    Alert.alert(t('common.delete'), t('files.deleteConfirm', { name: `${selectedIds.size} item(s)` }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: (): void => {
          selectedIds.forEach((id) => {
            const item = files.find((f) => f.id === id);
            if (item?.dbId) void itemRepo.delete(item.dbId);
            new File(id).delete();
            if (item) logItemActivity(ActivityAction.DELETE_ITEM, vid, item.name);
          });
          clearSelection();
          loadFiles();
        },
      },
    ]);
  }, [selectedIds, files, clearSelection, loadFiles, itemRepo, t, vid]);

  const handleBatchShare = useCallback(async () => {
    const names = files.filter((f) => selectedIds.has(f.id)).map((f) => f.name).join(', ');
    await Share.share({ message: names });
  }, [selectedIds, files]);

  const handleBatchExport = useCallback(async () => {
    const selected = files.filter((f) => selectedIds.has(f.id) && f.type === 'file');
    if (selected.length === 0) return;
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('common.error'), t('errors.permissionRationale'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('settings.openSettings'), onPress: () => void Linking.openSettings() },
      ]);
      return;
    }
    try {
      const key = await getVaultKey(vid);
      for (const item of selected) {
        const decryptedBase64 = await readAndDecryptFile(key, item.id);
        await exportDecryptedToLibrary(item.name, decryptedBase64);
      }
      clearSelection();
      Alert.alert(t('common.success'), t('files.exportSuccess'));
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    }
  }, [selectedIds, files, clearSelection, t, vid]);

  const handleFilePress = useCallback((item: FileItem) => {
    router.push({ pathname: '/(app)/modals/file-preview', params: { fileName: item.name, uri: item.id, vaultId: vid } });
  }, [vid]);

  const handleDeleteFile = useCallback((item: FileItem) => {
    Alert.alert(t('common.delete'), t('files.deleteConfirm', { name: item.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: (): void => {
          if (item.dbId) void itemRepo.delete(item.dbId);
          new File(item.id).delete();
          logItemActivity(ActivityAction.DELETE_ITEM, vid, item.name);
          loadFiles();
        },
      },
    ]);
  }, [loadFiles, itemRepo, t, vid]);

  const handleRenameFile = useCallback((item: FileItem) => {
    setRenameTarget(item);
    const extIndex = item.name.lastIndexOf('.');
    setRenameText(extIndex > 0 ? item.name.substring(0, extIndex) : item.name);
  }, []);

  const handleItemPress = useCallback((item: FileItem) => {
    if (selectedIds.size > 0) {
      toggleSelection(item.id);
      return;
    }
    handleFilePress(item);
  }, [selectedIds, toggleSelection, handleFilePress]);

  const handleItemLongPress = useCallback((item: FileItem) => {
    if (selectedIds.size > 0) {
      toggleSelection(item.id);
      return;
    }
    Alert.alert(item.name, undefined, [
      { text: t('common.rename'), onPress: (): void => handleRenameFile(item) },
      { text: t('common.delete'), style: 'destructive', onPress: (): void => handleDeleteFile(item) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }, [selectedIds, toggleSelection, handleRenameFile, handleDeleteFile, t]);

  const submitRename = useCallback(async () => {
    if (!renameTarget || !renameText.trim()) return;
    const oldFile = new File(renameTarget.id);
    const extIndex = renameTarget.name.lastIndexOf('.');
    const ext = extIndex > 0 ? renameTarget.name.substring(extIndex) : '';
    const newName = renameText.trim() + ext;
    const newEncName = `${newName}.enc`;
    const vaultDir = getVaultDir(vid);
    const newFile = new File(vaultDir, newEncName);
    if (newFile.exists && newFile.uri !== oldFile.uri) {
      Alert.alert(t('common.error'), t('files.nameExists'));
      return;
    }
    oldFile.rename(newEncName);
    if (renameTarget.dbId) {
      const existing = await itemRepo.findById(renameTarget.dbId);
      if (existing.success && existing.data) {
        await itemRepo.update({
          ...existing.data,
          name: newName,
          encryptedPath: newFile.uri,
          updatedAt: Date.now(),
        });
      }
    }
    setRenameTarget(null);
    setRenameText('');
    loadFiles();
  }, [renameTarget, renameText, vid, loadFiles, itemRepo, t]);

  if (renameTarget) {
    return (
      <ScreenLayout title={t('common.rename')} showBack onBack={clearRename}>
        <RenameEditor
          value={renameText}
          onChangeText={setRenameText}
          onSubmit={submitRename}
          onCancel={clearRename}
        />
      </ScreenLayout>
    );
  }

  if (loading && files.length === 0) {
    return <Loading fullScreen message={t('common.loading')} />;
  }

  if (error && files.length === 0) {
    return <ErrorView message={error} onRetry={loadFiles} />;
  }

  return (
    <ScreenLayout title={t('files.title')} subtitle={t('vault.itemsCount', { count: files.length })} showBack onBack={() => router.back()}>
      <View style={styles.flexOne}>
        <SearchBar value={search} onChangeText={setSearch} placeholder={t('files.search')} onClear={() => setSearch('')} />
        <SelectionBar
          selectedCount={selectedIds.size}
          onClearSelection={clearSelection}
          actions={[
            { icon: 'share-variant', label: t('common.share'), onPress: handleBatchShare },
            { icon: 'export', label: t('files.export'), onPress: handleBatchExport },
            { icon: 'delete', label: t('common.delete'), onPress: handleBatchDelete, destructive: true },
          ]}
        />
        <FilesList
          files={files}
          search={search}
          refreshing={refreshing}
          selectedIds={selectedIds}
          onRefresh={handleRefresh}
          onToggle={toggleSelection}
          onPress={handleItemPress}
          onLongPress={handleItemLongPress}
          onImport={handleImport}
        />
        <FloatingButton icon="plus" onPress={handleImport} accessibilityLabel={t('files.addFile')} />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  flexOne: { flex: 1 },
});
