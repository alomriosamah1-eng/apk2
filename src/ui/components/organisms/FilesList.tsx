import React, { useCallback } from 'react';
import { FlatList, StyleSheet, RefreshControl, ListRenderItem } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing } from '@core/theme';
import { EmptyState } from '@ui/components/atoms/EmptyState';
import { FileRow, FileItem } from '@ui/components/molecules/FileRow';

interface FilesListProps {
  files: FileItem[];
  search: string;
  refreshing: boolean;
  selectedIds: Set<string>;
  onRefresh: () => void;
  onToggle: (id: string) => void;
  onPress: (item: FileItem) => void;
  onLongPress: (item: FileItem) => void;
  onImport: () => void;
}

/**
 * Virtualized file list. Only the visible window is rendered so a vault with
 * tens of thousands of files stays responsive and memory-bounded.
 */
export function FilesList({ files, search, refreshing, selectedIds, onRefresh, onToggle, onPress, onLongPress, onImport }: FilesListProps): React.JSX.Element {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const filteredFiles = search
    ? files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    : files;
  const renderItem: ListRenderItem<FileItem> = useCallback(({ item }) => (
    <FileRow
      item={item}
      selected={selectedIds.has(item.id)}
      onToggle={() => onToggle(item.id)}
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
    />
  ), [selectedIds, onToggle, onPress, onLongPress]);

  const ListEmptyComponent = useCallback(() => (
    <EmptyState
      icon="folder-open-outline"
      title={search ? t('common.noResults') : t('files.empty')}
      description={search ? t('common.noResults') : t('files.emptyDesc')}
      actionLabel={search ? undefined : t('files.addFile')}
      onAction={search ? undefined : onImport}
    />
  ), [onImport, search, t]);

  return (
    <FlatList
      style={styles.listContainer}
      data={filteredFiles}
      keyExtractor={useCallback((item: FileItem) => item.id, [])}
      renderItem={renderItem}
      ListEmptyComponent={ListEmptyComponent}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      initialNumToRender={20}
      maxToRenderPerBatch={20}
      windowSize={9}
      removeClippedSubviews
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    />
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
});
