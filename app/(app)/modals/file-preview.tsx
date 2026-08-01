import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
import { decryptFile } from '@core/utils/crypto';
import { getVaultKey } from '@data/media/MediaStorage';

const TEXT_EXTENSIONS = ['.txt', '.md', '.json', '.xml', '.html', '.csv', '.log', '.yml', '.yaml', '.ini', '.cfg'];

export default function FilePreviewModal() {
  const { t } = useTranslation();
  const { fileName, uri, vaultId } = useLocalSearchParams<{ fileName: string; uri: string; type: string; vaultId: string }>();
  const vid = vaultId || 'default';
  const ext = fileName ? `.${fileName.split('.').pop()?.toLowerCase()}` : '';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext.replace('.', ''));
  const isVideo = ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext.replace('.', ''));
  const isText = TEXT_EXTENSIONS.includes(ext);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string>('');

  useEffect(() => {
    if (!uri) {
      setLoading(false);
      setError(t('errors.itemNotFound'));
      return;
    }
    (async () => {
      try {
        const file = new File(uri);
        if (!file.exists) {
          setError(t('errors.itemNotFound'));
          setLoading(false);
          return;
        }
        const sizeNum = Number(file.size);
        if (sizeNum > 0) {
          const kb = sizeNum / 1024;
          setFileSize(kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(1)} KB`);
        }
        const key = await getVaultKey(vid);
        const encryptedBase64 = await file.text();
        const decryptedBase64 = await decryptFile(key, encryptedBase64);
        if (isText) {
          const content = decodeBase64Utf8(decryptedBase64);
          setTextContent(content);
        } else if (isImage) {
          setImageUri(`data:image/jpeg;base64,${decryptedBase64}`);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [uri, isText, isImage, vid, t]);

  return (
    <FilePreviewView
      fileName={fileName}
      uri={uri}
      isImage={isImage}
      isVideo={isVideo}
      isText={isText}
      textContent={textContent}
      imageUri={imageUri}
      loading={loading}
      error={error}
      fileSize={fileSize}
      onBack={() => router.back()}
      onErrorRetry={() => router.back()}
      t={t}
    />
  );
}

function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

interface PreviewViewProps {
  fileName?: string;
  uri?: string;
  isImage: boolean;
  isVideo: boolean;
  isText: boolean;
  textContent: string | null;
  imageUri: string | null;
  loading: boolean;
  error: string | null;
  fileSize: string;
  onBack: () => void;
  onErrorRetry: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function FilePreviewView({
  fileName, uri, isImage, isVideo, isText, textContent, imageUri, loading, error, fileSize, onBack, onErrorRetry, t,
}: PreviewViewProps) {
  const { colors } = useTheme();
  const ext = fileName ? `.${fileName.split('.').pop()?.toLowerCase()}` : '';

  if (!uri) {
    return (
      <ScreenLayout title={t('files.preview')} showBack onBack={onBack}>
        <View style={styles.center}>
          <Icon name="file-question-outline" size={64} color={colors.onSurfaceVariant} />
          <Typography variant="bodyLarge" color={colors.onSurfaceVariant} style={styles.text}>{t('files.noFileSelected')}</Typography>
        </View>
      </ScreenLayout>
    );
  }

  if (loading) {
    return <Loading fullScreen message={t('common.loading')} />;
  }

  if (error && !isImage && !isVideo) {
    return <ErrorView message={error} onRetry={onErrorRetry} />;
  }

  return (
    <ScreenLayout title={fileName || t('files.preview')} showBack onBack={onBack}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {isImage ? (
          imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} contentFit="contain" accessibilityLabel={fileName} />
          ) : (
            <View style={styles.center}>
              <Icon name="file-image-outline" size={64} color={colors.onSurfaceVariant} />
              <Typography variant="bodyLarge" color={colors.error} style={styles.text}>{error || t('common.error')}</Typography>
            </View>
          )
        ) : isVideo ? (
          <View style={[styles.videoPlaceholder, { backgroundColor: colors.surfaceVariant }]}>
            <Icon name="video-outline" size={64} color={colors.onSurfaceVariant} />
            <Typography variant="bodyLarge" color={colors.onSurfaceVariant} style={styles.text}>{t('files.videoPlayer')}</Typography>
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
              {ext ? t('files.fileType', { ext: ext.toUpperCase() }) : 'File'}
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
