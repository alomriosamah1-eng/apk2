import { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Item } from '@domain/entities/Item';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing, borderRadius } from '@core/theme';
import { formatFileSize } from '@core/utils/file';
import { Typography } from '@ui/components/atoms/Typography';
import { Icon } from '@ui/components/atoms/Icon';

interface ItemRowProps {
  item: Item;
  onPress?: () => void;
  onLongPress?: () => void;
  showCheckbox?: boolean;
  isSelected?: boolean;
}

const TYPE_ICONS: Record<string, keyof typeof import('@expo/vector-icons').MaterialCommunityIcons.glyphMap> = {
  folder: 'folder',
  image: 'file-image',
  video: 'file-video',
  audio: 'file-music',
  document: 'file-document',
  file: 'file',
};

const TYPE_COLORS: Record<string, string> = {
  folder: '#FFB74D',
  image: '#42A5F5',
  video: '#AB47BC',
  audio: '#66BB6A',
  document: '#EF5350',
  file: '#78909C',
};

function ItemRowComponent({ item, onPress, onLongPress }: ItemRowProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.type}`}
      style={[styles.container, { borderBottomColor: colors.outlineVariant }]}
    >
      <View style={[styles.iconContainer, { backgroundColor: (TYPE_COLORS[item.type] ?? '#78909C') + '20' }]}>
        <Icon
          name={TYPE_ICONS[item.type] ?? 'file'}
          size={24}
          color={TYPE_COLORS[item.type] ?? '#78909C'}
        />
      </View>
      <View style={styles.info}>
        <Typography variant="bodyLarge" numberOfLines={1}>
          {item.name}
        </Typography>
        <Typography variant="bodySmall" color={colors.onSurfaceVariant}>
          {formatFileSize(item.size)}
        </Typography>
      </View>
      {item.isFavorite && (
        <Icon name="star" size={16} color={colors.warning} accessibilityLabel="Favorite" />
      )}
    </TouchableOpacity>
  );
}

export const ItemRow = memo(ItemRowComponent);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  info: {
    flex: 1,
  },
});
