import { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, RefreshControl, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Paths, File, Directory } from 'expo-file-system';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing } from '@core/theme';
import { ScreenLayout } from '@ui/components/organisms/ScreenLayout';
import { EmptyState } from '@ui/components/atoms/EmptyState';
import { SearchBar } from '@ui/components/molecules/SearchBar';
import { FloatingButton } from '@ui/components/molecules/FloatingButton';
import { Loading } from '@ui/components/atoms/Loading';
import { ErrorView } from '@ui/components/atoms/ErrorView';
import { Typography } from '@ui/components/atoms/Typography';
import { Icon } from '@ui/components/atoms/Icon';

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
  const { colors } = useTheme();
  const { vaultId } = useLocalSearchParams<{ vaultId: string }>();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

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
        loadFiles();
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [getVaultDir, loadFiles]);

  const handleFilePress = useCallback((item: FileItem) => {
    router.push({ pathname: '/(app)/modals/file-preview', params: { fileName: item.name, uri: item.id } });
  }, []);

  const filteredFiles = search
    ? files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    : files;

  if (loading && files.length === 0) {
    return <Loading fullScreen message="Loading files..." />;
  }

  if (error && files.length === 0) {
    return <ErrorView message={error} onRetry={loadFiles} />;
  }

  return (
    <ScreenLayout title="Files" subtitle={`${files.length} file${files.length !== 1 ? 's' : ''}`}>
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search files..." onClear={() => setSearch('')} />
      <ScrollView
        style={styles.listContainer}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        {filteredFiles.length === 0 ? (
          <EmptyState
            icon="folder-open-outline"
            title={search ? 'No matching files' : 'No files yet'}
            description={search ? 'Try a different search term' : 'Import files to store them securely in your vault'}
            actionLabel={search ? undefined : 'Import Files'}
            onAction={search ? undefined : handleImport}
          />
        ) : (
          filteredFiles.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => handleFilePress(item)}
              style={[styles.fileRow, { borderBottomColor: colors.outlineVariant }]}
            >
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
      <FloatingButton icon="plus" onPress={handleImport} accessibilityLabel="Import files" />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
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
  fileInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
});
