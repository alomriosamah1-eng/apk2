import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, StyleSheet, RefreshControl, TouchableOpacity, ScrollView, Alert, TextInput as RNTextInput, Share } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Paths, File, Directory } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing } from '@core/theme';
import { ScreenLayout } from '@ui/components/organisms/ScreenLayout';
import { EmptyState } from '@ui/components/atoms/EmptyState';
import { SearchBar } from '@ui/components/molecules/SearchBar';
import { SelectionBar } from '@ui/components/organisms/SelectionBar';
import { FloatingButton } from '@ui/components/molecules/FloatingButton';
import { Loading } from '@ui/components/atoms/Loading';
import { ErrorView } from '@ui/components/atoms/ErrorView';
import { Typography } from '@ui/components/atoms/Typography';
import { Icon } from '@ui/components/atoms/Icon';
import { DIContainer } from '@core/di/container';
import { IItemRepository } from '@domain/repositories/IItemRepository';
import { ItemType } from '@core/constants';
import { generateId } from '@core/utils';

interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size?: number;
  createdAt: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FilesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
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
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const vaultDir = getVaultDir();
        if (!vaultDir.exists) {
          vaultDir.create({ intermediates: true, idempotent: true });
        }
        const destFile = new File(vaultDir, asset.name);
        destFile.create({ overwrite: true });
        const srcFile = new File(asset.uri);
        srcFile.copy(destFile);

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
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [getVaultDir, loadFiles]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleBatchDelete = useCallback(() => {
    Alert.alert(t('common.delete'), t('files.deleteConfirm', { name: `${selectedIds.size} item(s)` }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
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
        onPress: () => {
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

  const filteredFiles = search
    ? files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    : files;

  if (renameTarget) {
    return (
      <ScreenLayout title={t('common.rename')} showBack onBack={() => { setRenameTarget(null); setRenameText(''); }}>
        <View style={styles.renameContainer}>
          <RNTextInput
            style={[styles.renameInput, { color: colors.onSurface, borderColor: colors.outline }]}
            value={renameText}
            onChangeText={setRenameText}
            placeholder={t('files.namePlaceholder')}
            placeholderTextColor={colors.onSurfaceVariant}
            autoFocus
            onSubmitEditing={submitRename}
          />
          <View style={styles.editorActions}>
            <TouchableOpacity onPress={() => { setRenameTarget(null); setRenameText(''); }} style={[styles.editorBtn, { borderColor: colors.outline }]}>
              <Typography color={colors.onSurfaceVariant}>{t('common.cancel')}</Typography>
            </TouchableOpacity>
            <TouchableOpacity onPress={submitRename} style={[styles.editorBtn, { backgroundColor: colors.primary }]}>
              <Typography color="#FFFFFF">{t('common.rename')}</Typography>
            </TouchableOpacity>
          </View>
        </View>
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
        <ScrollView
          style={styles.listContainer}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        >
          {filteredFiles.length === 0 ? (
            <EmptyState
              icon="folder-open-outline"
              title={search ? t('common.noResults') : t('files.empty')}
              description={search ? t('common.noResults') : t('files.emptyDesc')}
              actionLabel={search ? undefined : t('files.addFile')}
              onAction={search ? undefined : handleImport}
            />
          ) : (
            filteredFiles.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => {
                  if (selectedIds.size > 0) {
                    toggleSelection(item.id);
                  } else {
                    handleFilePress(item);
                  }
                }}
                onLongPress={() => {
                  if (selectedIds.size > 0) {
                    toggleSelection(item.id);
                  } else {
                    Alert.alert(item.name, undefined, [
                      { text: t('common.rename'), onPress: () => handleRenameFile(item) },
                      { text: t('common.delete'), style: 'destructive', onPress: () => handleDeleteFile(item) },
                      { text: t('common.cancel'), style: 'cancel' },
                    ]);
                  }
                }}
                style={[styles.fileRow, { borderBottomColor: colors.outlineVariant }]}
              >
                <TouchableOpacity onPress={() => toggleSelection(item.id)} style={styles.checkbox} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Icon
                    name={selectedIds.has(item.id) ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={22}
                    color={selectedIds.has(item.id) ? colors.primary : colors.onSurfaceVariant}
                  />
                </TouchableOpacity>
                <Icon
                  name={item.type === 'folder' ? 'folder' : 'file-outline'}
                  size={24}
                  color={item.type === 'folder' ? '#FFB74D' : colors.onSurface}
                />
                <View style={styles.fileInfo}>
                  <Typography variant="bodyMedium" numberOfLines={1}>{item.name}</Typography>
                  {item.type === 'file' && item.size !== undefined && (
                    <Typography variant="bodySmall" color={colors.onSurfaceVariant}>
                      {formatSize(item.size)}
                    </Typography>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
        <FloatingButton icon="plus" onPress={handleImport} accessibilityLabel={t('files.addFile')} />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  flexOne: { flex: 1 },
  listContainer: {
    flex: 1,
  },
  list: {
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkbox: {
    marginRight: spacing.sm,
  },
  fileInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  renameContainer: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  renameInput: {
    fontSize: 18,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: spacing.lg,
  },
  editorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  editorBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
  },
});
