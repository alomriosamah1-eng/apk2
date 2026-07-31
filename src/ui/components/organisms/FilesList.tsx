import React from 'react';
import { ScrollView, StyleSheet, RefreshControl } from 'react-native';
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

export function FilesList({ files, search, refreshing, selectedIds, onRefresh, onToggle, onPress, onLongPress, onImport }: FilesListProps): React.JSX.Element {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const filteredFiles = search
    ? files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    : files;
  const isEmpty = filteredFiles.length === 0;

  return (
    <ScrollView
      style={styles.listContainer}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {isEmpty ? (
        <EmptyState
          icon="folder-open-outline"
          title={search ? t('common.noResults') : t('files.empty')}
          description={search ? t('common.noResults') : t('files.emptyDesc')}
          actionLabel={search ? undefined : t('files.addFile')}
          onAction={search ? undefined : onImport}
        />
      ) : (
        filteredFiles.map((item) => (
          <FileRow
            key={item.id}
            item={item}
            selected={selectedIds.has(item.id)}
            onToggle={() => onToggle(item.id)}
            onPress={() => onPress(item)}
            onLongPress={() => onLongPress(item)}
          />
        ))
      )}
    </ScrollView>
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
