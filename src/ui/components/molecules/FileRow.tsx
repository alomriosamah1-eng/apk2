import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing } from '@core/theme';
import { ItemType } from '@core/constants';
import { Typography } from '@ui/components/atoms/Typography';
import { Icon } from '@ui/components/atoms/Icon';

export interface FileItem {
  id: string;
  /** Database row id (items.id), used to keep DB rows in sync. */
  dbId?: string;
  name: string;
  mimeType: string | null;
  type: 'file' | 'folder';
  /** The raw vault ItemType, kept for type/count-aware messages. */
  itemType: ItemType;
  size?: number;
  createdAt: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileRowProps {
  item: FileItem;
  selected: boolean;
  onToggle: () => void;
  onPress: () => void;
  onLongPress: () => void;
}

export function FileRow({ item, selected, onToggle, onPress, onLongPress }: FileRowProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.fileRow, { borderBottomColor: colors.outlineVariant }]}
    >
      <TouchableOpacity onPress={onToggle} style={styles.checkbox} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Icon
          name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'}
          size={22}
          color={selected ? colors.primary : colors.onSurfaceVariant}
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
  );
}

const styles = StyleSheet.create({
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
});
