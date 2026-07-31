import React from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing, borderRadius } from '@core/theme';
import { Icon } from '@ui/components/atoms/Icon';
import { Typography } from '@ui/components/atoms/Typography';

export interface MediaItem {
  id: string;
  name: string;
  encryptedPath: string;
  decryptedUri: string | null;
}

const NUM_COLUMNS = 3;
const SCREEN_WIDTH = Dimensions.get('window').width;
const ITEM_SIZE = (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

interface MediaThumbProps {
  item: MediaItem;
  selected: boolean;
  showLabel: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

export function MediaThumb({ item, selected, showLabel, onPress, onLongPress }: MediaThumbProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} onLongPress={onLongPress} style={styles.mediaItem}>
      <View style={[styles.thumbnail, { backgroundColor: colors.surfaceVariant }]}>
        {selected && (
          <View style={[styles.checkOverlay, { backgroundColor: colors.primary + '33' }]}>
            <Icon name="check-circle" size={24} color={colors.primary} />
          </View>
        )}
        <Icon name="image" size={28} color={colors.onSurfaceVariant} />
        {showLabel && (
          <Typography variant="caption" color={colors.onSurfaceVariant} style={styles.fileName} numberOfLines={1}>
            {item.name}
          </Typography>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  mediaItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  fileName: {
    marginTop: spacing.xs,
    paddingHorizontal: 4,
  },
});
