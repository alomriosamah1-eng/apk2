import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing, borderRadius } from '@core/theme';
import { Typography } from '@ui/components/atoms/Typography';
import { MediaItem } from './MediaThumb';

interface MediaPreviewProps {
  item: MediaItem;
  onBack: () => void;
  onExport: () => void;
}

export function MediaPreview({ item, onBack, onExport }: MediaPreviewProps): React.JSX.Element {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.previewContainer}>
      <Image
        source={{ uri: item.decryptedUri! }}
        style={styles.previewImage}
        contentFit="contain"
        accessibilityLabel={item.name}
      />
      <View style={styles.previewActions}>
        <TouchableOpacity onPress={onBack} style={[styles.previewBtn, { borderColor: colors.outline }]}>
          <Typography>{t('common.back')}</Typography>
        </TouchableOpacity>
        <TouchableOpacity onPress={onExport} style={[styles.previewBtn, { backgroundColor: colors.primary }]}>
          <Typography color="#FFFFFF">{t('media.export')}</Typography>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  previewImage: {
    flex: 1,
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: spacing.lg,
    gap: spacing.md,
  },
  previewBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
});
