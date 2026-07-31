import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing } from '@core/theme';
import { Typography } from '@ui/components/atoms/Typography';

interface RenameEditorProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function RenameEditor({ value, onChangeText, onSubmit, onCancel }: RenameEditorProps): React.JSX.Element {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.renameContainer}>
      <TextInput
        style={[styles.renameInput, { color: colors.onSurface, borderColor: colors.outline }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={t('files.namePlaceholder')}
        placeholderTextColor={colors.onSurfaceVariant}
        autoFocus
        onSubmitEditing={onSubmit}
      />
      <View style={styles.editorActions}>
        <TouchableOpacity onPress={onCancel} style={[styles.editorBtn, { borderColor: colors.outline }]}>
          <Typography color={colors.onSurfaceVariant}>{t('common.cancel')}</Typography>
        </TouchableOpacity>
        <TouchableOpacity onPress={onSubmit} style={[styles.editorBtn, { backgroundColor: colors.primary }]}>
          <Typography color="#FFFFFF">{t('common.rename')}</Typography>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
