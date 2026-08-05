import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, StyleSheet, Alert, Share } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File, Directory } from 'expo-file-system';
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
import { getEncryptedDir, deleteImportedSource, pickSafDirectory, exportUnits, importUnits, type ExportUnitInput, type ExportMode, type ExportBatchReport, type ImportUnitSource, type ImportBatchReport } from '@data/media/MediaStorage';
import { confirmBody, successBody, deleteSuccessBody, batchReportBody } from '@ui/utils/itemMessages';
import { OperationProgress } from '@ui/components/organisms/OperationProgress';
import { useOperationProgress } from '@ui/hooks/useOperationProgress';
import { ActivityLogRepositoryImpl } from '@data/repositories/ActivityLogRepositoryImpl';

function getVaultDir(vaultId: string): Directory {
  return getEncryptedDir(vaultId);
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

  const op = useOperationProgress();

  const loadFiles = useCallback(async () => {
    try {
      setError(null);
      const result = await itemRepo.findByVaultId(vid);
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      const items: FileItem[] = result.data
        .filter((it) => it.type === ItemType.FILE || it.type === ItemType.FOLDER)
        .map((it) => ({
          id: it.encryptedPath ?? it.id,
          dbId: it.id,
          name: it.name,
          mimeType: it.mimeType,
          type: it.type === ItemType.FOLDER ? 'folder' : 'file',
          itemType: it.type,
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
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: true });
      if (result.canceled || result.assets.length === 0) return;
      const sources: ImportUnitSource[] = result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name || `file_${Date.now()}`,
        mimeType: asset.mimeType || null,
      }));

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
              await deleteImportedSource(src.uri);
            } catch { /* best-effort cleanup of the picked copy */ }
          },
        });

        if (report.imported > 0) {
          logItemActivity(ActivityAction.ADD_ITEM, vid, `${report.imported} file(s)`);
        }
        loadFiles();

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
      setError((err as Error).message);
    }
  }, [vid, loadFiles, t, op]);

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

  const toTyped = (list: FileItem[]) => list.map((f) => ({ type: f.itemType }));

const handleBatchDelete = useCallback(() => {
    const selected = files.filter((f) => selectedIds.has(f.id));
    if (selected.length === 0) return;
    Alert.alert(t('common.delete'), confirmBody(t, toTyped(selected), 'deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: (): void => {
          selected.forEach((item) => {
            if (item.dbId) void itemRepo.delete(item.dbId);
            new File(item.id).delete();
            logItemActivity(ActivityAction.DELETE_ITEM, vid, item.name);
          });
          clearSelection();
          loadFiles();
          Alert.alert(t('common.success'), deleteSuccessBody(t, toTyped(selected)));
        },
      },
    ]);
  }, [selectedIds, files, clearSelection, loadFiles, itemRepo, t, vid]);

  const handleBatchShare = useCallback(async () => {
    const names = files.filter((f) => selectedIds.has(f.id)).map((f) => f.name).join(', ');
    await Share.share({ message: names });
  }, [selectedIds, files]);

  const runExport = useCallback(async (selected: FileItem[], mode: ExportMode) => {
    try {
      const units: ExportUnitInput[] = selected.map((f) => ({
        encryptedPath: f.id,
        dbId: f.dbId,
        name: f.name,
        mimeType: f.mimeType,
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
          loadFiles();
          clearSelection();
        }
        if (report.failed > 0 || report.cancelled > 0) {
          Alert.alert(t('common.error'), batchReportBody(t, report));
        } else if (mode === 'extract') {
          Alert.alert(t('common.success'), successBody(t, toTyped(selected), 'extractSuccess'));
        } else {
          Alert.alert(t('common.success'), successBody(t, toTyped(selected), 'copySuccess'));
        }
        return;
      } finally {
        op.finish();
      }
    } catch (err) {
      op.finish();
      Alert.alert(t('common.error'), (err as Error).message);
    }
  }, [vid, loadFiles, clearSelection, t, op]);

  const chooseExport = useCallback((selected: FileItem[]) => {
    if (selected.length === 0) return;
    Alert.alert(t('action.extractTitle'), `${confirmBody(t, toTyped(selected), 'extractConfirm')}\n\n${t('action.extractHint')}`, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('action.copy'), onPress: (): void => void runExport(selected, 'copy') },
      { text: t('action.extract'), onPress: (): void => void runExport(selected, 'extract') },
    ]);
  }, [t, runExport]);

  const handleBatchExport = useCallback(() => {
    chooseExport(files.filter((f) => selectedIds.has(f.id) && f.type === 'file'));
  }, [chooseExport, selectedIds, files]);

  const handleFilePress = useCallback((item: FileItem) => {
    router.push({
      pathname: '/(app)/modals/file-preview',
      params: {
        fileName: item.name,
        uri: item.id,
        vaultId: vid,
        type: item.itemType,
        dbId: item.dbId || '',
        size: String(item.size ?? ''),
      },
    });
  }, [vid]);

  const handleDeleteFile = useCallback((item: FileItem) => {
    Alert.alert(t('common.delete'), confirmBody(t, toTyped([item]), 'deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: (): void => {
          if (item.dbId) void itemRepo.delete(item.dbId);
          new File(item.id).delete();
          logItemActivity(ActivityAction.DELETE_ITEM, vid, item.name);
          loadFiles();
          Alert.alert(t('common.success'), deleteSuccessBody(t, toTyped([item])));
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
      <OperationProgress progress={op.progress} onCancel={op.cancel} />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  flexOne: { flex: 1 },
});
