import React from 'react';
import { ScrollView, View, StyleSheet, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing } from '@core/theme';
import { EmptyState } from '@ui/components/atoms/EmptyState';
import { MediaThumb, MediaItem } from './MediaThumb';

interface MediaGalleryProps {
  items: MediaItem[];
  search: string;
  refreshing: boolean;
  selectedIds: Set<string>;
  onRefresh: () => void;
  onToggle: (id: string) => void;
  onView: (item: MediaItem) => void;
  onImport: () => void;
}

export function MediaGallery({ items, search, refreshing, selectedIds, onRefresh, onToggle, onView, onImport }: MediaGalleryProps): React.JSX.Element {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const isEmpty = items.length === 0;

  return (
    <ScrollView
      contentContainerStyle={styles.grid}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {isEmpty ? (
        <EmptyState
          icon="image-multiple-outline"
          title={search ? t('common.noResults') : t('media.empty')}
          description={search ? t('common.noResults') : t('media.emptyDesc')}
          actionLabel={search ? undefined : t('files.addFile')}
          onAction={search ? undefined : onImport}
        />
      ) : (
        <View style={styles.gridRow}>
          {items.map((item, index) => (
            <MediaThumb
              key={item.id}
              item={item}
              selected={selectedIds.has(item.id)}
              showLabel={index < 3}
              onPress={() => onView(item)}
              onLongPress={() => onToggle(item.id)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  grid: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
