import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, StyleSheet, Alert, Share } from 'react-native';
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
import { ItemType } from '@core/constants';
import { generateId } from '@core/utils';

function copyImportedFile(vaultId: string, fileName: string, sourceUri: string): File {  const vaultDir = new Directory(Paths.document, 'khaznati', vaultId || 'default');
  if (!vaultDir.exists) {
    vaultDir.create({ intermediates: true, idempotent: true });
  }
  const destFile = new File(vaultDir, fileName);
  destFile.create({ overwrite: true });
  const srcFile = new File(sourceUri);
  srcFile.copy(destFile);
  return destFile;
}

export default function FilesScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const { vaultId } = useLocalSearchParams<{ vaultId: string }>();
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

  const getVaultDir = useCallback(() => {
    return new Directory(Paths.document, 'khaznati', vaultId || 'default');
  }, [vaultId]);

  const loadFiles = useCallback(async () => {
    try {
      setError(null);
      const vaultDir = getVaultDir();
      if (!vaultDir.exists) {
        setFiles([]);
        return;
      }
      const list = vaultDir.list();
      const items: FileItem[] = list.map((entry) => {
        const isDir = entry instanceof Directory;
        return {
          id: entry.uri,
          name: entry.name,
          type: isDir ? 'folder' : 'file',
          size: !isDir ? (entry as File).size : undefined,
          createdAt: (entry instanceof File ? (entry as File).modificationTime : null) ?? Date.now(),
        };
      });
      setFiles(items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getVaultDir]);

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
      const destFile = copyImportedFile(vaultId || 'default', asset.name, asset.uri);

      await itemRepo.create({
        id: generateId(),
        vaultId: vaultId || 'default',
        parentId: null,
        name: asset.name,
        type: ItemType.FILE,
        mimeType: asset.mimeType || null,
        size: asset.size || 0,
        encryptedPath: destFile.uri,
        encryptedData: null,
        thumbnailPath: null,
        metadata: null,
        isFavorite: false,
        isDeleted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deletedAt: null,
      });

      loadFiles();
    } catch (err) {
      setError((err as Error).message);
    }
  }, [loadFiles, itemRepo, vaultId]);

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
          selectedIds.forEach((id) => new File(id).delete());
          clearSelection();
          loadFiles();
        },
      },
    ]);
  }, [selectedIds, clearSelection, loadFiles, t]);

  const handleBatchShare = useCallback(async () => {
    const names = files.filter((f) => selectedIds.has(f.id)).map((f) => f.name).join(', ');
    await Share.share({ message: names });
  }, [selectedIds, files]);

  const handleBatchExport = useCallback(async () => {
    const selected = files.filter((f) => selectedIds.has(f.id) && f.type === 'file');
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('common.error'), t('errors.permission'));
      return;
    }
    for (const item of selected) {
      const src = new File(item.id);
      const tempDir = new Directory(Paths.cache, 'khaznati_export');
      if (!tempDir.exists) tempDir.create({ intermediates: true, idempotent: true });
      const tempFile = new File(tempDir, item.name);
      src.copy(tempFile);
    }
    clearSelection();
    Alert.alert(t('common.success'), t('files.exportSuccess'));
  }, [selectedIds, files, clearSelection, t]);

  const handleFilePress = useCallback((item: FileItem) => {
    router.push({ pathname: '/(app)/modals/file-preview', params: { fileName: item.name, uri: item.id } });
  }, []);

  const handleDeleteFile = useCallback((item: FileItem) => {
    Alert.alert(t('common.delete'), t('files.deleteConfirm', { name: item.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: (): void => {
          const file = new File(item.id);
          file.delete();
          loadFiles();
        },
      },
    ]);
  }, [loadFiles, t]);

  const handleRenameFile = useCallback((item: FileItem) => {
    setRenameTarget(item);
    const oldName = item.name;
    const extIndex = oldName.lastIndexOf('.');
    setRenameText(extIndex > 0 ? oldName.substring(0, extIndex) : oldName);
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
    const vaultDir = getVaultDir();
    const oldFile = new File(renameTarget.id);
    const extIndex = renameTarget.name.lastIndexOf('.');
    const ext = extIndex > 0 ? renameTarget.name.substring(extIndex) : '';
    const newFile = new File(vaultDir, renameText.trim() + ext);
    if (newFile.exists && newFile.uri !== oldFile.uri) {
      Alert.alert(t('common.error'), t('files.nameExists'));
      return;
    }
    oldFile.rename(renameText.trim() + ext);
    setRenameTarget(null);
    setRenameText('');
    loadFiles();
  }, [renameTarget, renameText, getVaultDir, loadFiles, t]);

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
    <ScreenLayout title={t('files.title')} subtitle={t('vault.itemsCount', { count: files.length })} showBack onBack={() => router.push('/(app)/(tabs)/vault')}>
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
