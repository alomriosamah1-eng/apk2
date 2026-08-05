import React, { useCallback } from 'react';
import { FlatList, StyleSheet, RefreshControl, ListRenderItem } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing } from '@core/theme';
import { EmptyState } from '@ui/components/atoms/EmptyState';
import { MediaThumb, MediaItem, MEDIA_THUMB_SIZE } from './MediaThumb';

interface MediaGalleryProps {
  items: MediaItem[];
  search: string;
  refreshing: boolean;
  isSelecting: boolean;
  selectedIds: Set<string>;
  onRefresh: () => void;
  onToggle: (id: string) => void;
  onView: (item: MediaItem) => void;
  onImport: () => void;
}

const NUM_COLUMNS = 3;

/**
 * Virtualized media grid. Renders a bounded window of rows via FlatList so a
 * vault with thousands of items never mounts all thumbnails at once and the
 * UI thread stays responsive while scrolling.
 */
export function MediaGallery({ items, search, refreshing, isSelecting, selectedIds, onRefresh, onToggle, onView, onImport }: MediaGalleryProps): React.JSX.Element {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const renderItem: ListRenderItem<MediaItem> = useCallback(({ item }) => (
    <MediaThumb
      item={item}
      selected={selectedIds.has(item.id)}
      onPress={() => (isSelecting ? onToggle(item.id) : onView(item))}
      onLongPress={() => onToggle(item.id)}
    />
  ), [selectedIds, isSelecting, onToggle, onView]);

  const ListEmptyComponent = useCallback(() => (
    <EmptyState
      icon="image-multiple-outline"
      title={search ? t('common.noResults') : t('media.empty')}
      description={search ? t('common.noResults') : t('media.emptyDesc')}
      actionLabel={search ? undefined : t('files.addFile')}
      onAction={search ? undefined : onImport}
    />
  ), [onImport, search, t]);

  const rowHeight = MEDIA_THUMB_SIZE + spacing.sm;

  return (
    <FlatList
      data={items}
      key={`grid-${NUM_COLUMNS}`}
      numColumns={NUM_COLUMNS}
      keyExtractor={useCallback((item: MediaItem) => item.id, [])}
      renderItem={renderItem}
      ListEmptyComponent={ListEmptyComponent}
      contentContainerStyle={styles.grid}
      columnWrapperStyle={styles.column}
      showsVerticalScrollIndicator={false}
      initialNumToRender={18}
      maxToRenderPerBatch={18}
      windowSize={7}
      removeClippedSubviews
      getItemLayout={(_, index) => ({ length: rowHeight, offset: rowHeight * Math.floor(index / NUM_COLUMNS), index })}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    />
  );
}

const styles = StyleSheet.create({
  grid: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  column: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
});