import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Paths, Directory } from 'expo-file-system';
import { useTheme } from '@ui/providers/ThemeProvider';
import { ScreenLayout } from '@ui/components/organisms/ScreenLayout';
import { Input } from '@ui/components/atoms/Input';
import { Button } from '@ui/components/atoms/Button';
import { Typography } from '@ui/components/atoms/Typography';
import { spacing } from '@core/theme';

export default function CreateFolderModal() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { vaultId } = useLocalSearchParams<{ vaultId: string }>();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = useCallback(async () => {
    const folderName = name.trim();
    if (!folderName) return;

    setCreating(true);
    setError(null);

    try {
      const vaultDir = new Directory(Paths.document, 'khaznati', vaultId || 'default');
      if (!vaultDir.exists) {
        vaultDir.create({ intermediates: true });
      }
      const newDir = new Directory(vaultDir, folderName);
      newDir.create({ idempotent: false });
      Keyboard.dismiss();
      router.back();
    } catch (err) {
      setError((err as Error).message);
      setCreating(false);
    }
  }, [name, vaultId]);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={{ flex: 1 }}>
        <ScreenLayout title={t('files.addFolder')} showBack onBack={() => router.back()}>
          <KeyboardAvoidingView behavior={Platform.OS === 'android' ? undefined : 'padding'} style={styles.container}>
            <Input
              label={t('files.folderName')}
              value={name}
              onChangeText={(t) => { setName(t); setError(null); }}
              placeholder={t('files.folderNamePlaceholder')}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
            {error && (
              <Typography variant="bodySmall" color={colors.error} style={styles.error}>
                {error}
              </Typography>
            )}
            <Button title={creating ? t('common.loading') : t('common.save')} onPress={handleCreate} variant="primary" fullWidth disabled={!name.trim() || creating} />
          </KeyboardAvoidingView>
        </ScreenLayout>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    flex: 1,
    gap: spacing.md,
  },
  error: {
    marginTop: spacing.xs,
  },
});
