import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import { useTheme } from '@ui/providers/ThemeProvider';
import { ScreenLayout } from '@ui/components/organisms/ScreenLayout';
import { Typography } from '@ui/components/atoms/Typography';
import { Icon } from '@ui/components/atoms/Icon';
import { Loading } from '@ui/components/atoms/Loading';
import { ErrorView } from '@ui/components/atoms/ErrorView';
import { spacing } from '@core/theme';

const TEXT_EXTENSIONS = ['.txt', '.md', '.json', '.xml', '.html', '.csv', '.log', '.yml', '.yaml', '.ini', '.cfg'];

export default function FilePreviewModal() {
  const { colors } = useTheme();
  const { fileName, uri } = useLocalSearchParams<{ fileName: string; uri: string; type: string }>();
  const ext = fileName ? `.${fileName.split('.').pop()?.toLowerCase()}` : '';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext.replace('.', ''));
  const isVideo = ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext.replace('.', ''));
  const isText = TEXT_EXTENSIONS.includes(ext);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string>('');

  useEffect(() => {
    if (!uri) {
      setLoading(false);
      setError('No file specified');
      return;
    }
    (async () => {
      try {
        const file = new File(uri);
        if (!file.exists) {
          setError('File not found');
          setLoading(false);
          return;
        }
        const sizeNum = Number(file.size);
        if (sizeNum > 0) {
          const kb = sizeNum / 1024;
          setFileSize(kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(1)} KB`);
        }
        if (isText) {
          const content = await file.text();
          setTextContent(content);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [uri, isText]);

  if (!uri) {
    return (
      <ScreenLayout title="Preview" showBack onBack={() => router.back()}>
        <View style={styles.center}>
          <Icon name="file-question-outline" size={64} color={colors.onSurfaceVariant} />
          <Typography variant="bodyLarge" color={colors.onSurfaceVariant} style={styles.text}>No file selected</Typography>
        </View>
      </ScreenLayout>
    );
  }

  if (loading) {
    return <Loading fullScreen message="Loading preview..." />;
  }

  if (error && !isImage && !isVideo) {
    return <ErrorView message={error} onRetry={() => router.back()} />;
  }

  return (
    <ScreenLayout title={fileName || 'Preview'} showBack onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {isImage ? (
          <Image source={{ uri }} style={styles.image} contentFit="contain" accessibilityLabel={fileName} />
        ) : isVideo ? (
          <View style={[styles.videoPlaceholder, { backgroundColor: colors.surfaceVariant }]}>
            <Icon name="video-outline" size={64} color={colors.onSurfaceVariant} />
            <Typography variant="bodyLarge" color={colors.onSurfaceVariant} style={styles.text}>Video Player</Typography>
            <Typography variant="bodySmall" color={colors.onSurfaceVariant}>{fileName}</Typography>
          </View>
        ) : isText && textContent !== null ? (
          <View style={[styles.textContainer, { backgroundColor: colors.surfaceVariant }]}>
            <Typography variant="bodySmall" style={styles.textContent} selectable>
              {textContent}
            </Typography>
          </View>
        ) : (
          <View style={styles.center}>
            <Icon name="file-outline" size={64} color={colors.onSurfaceVariant} />
            <Typography variant="bodyLarge" color={colors.onSurfaceVariant} style={styles.text}>
              {ext ? `${ext.toUpperCase()} File` : 'File'}
            </Typography>
            {fileSize && <Typography variant="bodySmall" color={colors.onSurfaceVariant}>{fileSize}</Typography>}
            {error && <Typography variant="bodySmall" color={colors.error} style={styles.text}>{error}</Typography>}
          </View>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  image: {
    width: '100%',
    height: 400,
  },
  videoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    minHeight: 300,
    margin: spacing.lg,
    borderRadius: 12,
  },
  textContainer: {
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: 12,
    minHeight: 300,
  },
  textContent: {
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  text: {
    marginTop: spacing.md,
  },
});
