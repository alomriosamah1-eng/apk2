import { useState, useEffect, useRef } from 'react';
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
import { AudioPlayer } from '@ui/components/organisms/AudioPlayer';
import { spacing } from '@core/theme';
import { getVaultKey, readAndDecryptFileBytes, decryptVaultFileToCache, deleteTempFile, persistPlaybackDuration } from '@data/media/MediaStorage';

const TEXT_EXTENSIONS = ['.txt', '.md', '.json', '.xml', '.html', '.csv', '.log', '.yml', '.yaml', '.ini', '.cfg'];
const AUDIO_EXTENSIONS = new Set([
  'mp3', 'mp2', 'mp1', 'mpga', 'mpa', 'mpeg3', 'wav', 'wave', 'ogg', 'oga', 'opus',
  'aac', 'm4a', 'm4b', 'm4p', 'm4r', 'mp4a', 'flac', 'amr', 'awb', 'mid', 'midi',
  'wma', 'aif', 'aiff', 'ape', 'caf', 'weba', 'mka', 'ac3', 'eac3', 'dts', 'wv',
  'tta', 'ra', 'rm', 'snd', 'au', 'voc', 'xmf',
]);

export default function FilePreviewModal() {
  const { t } = useTranslation();
  const { fileName, uri, vaultId, type, dbId, size } = useLocalSearchParams<{
    fileName: string; uri: string; vaultId: string; type?: string; dbId?: string; size?: string;
  }>();
  const vid = vaultId || 'default';
  const ext = fileName ? `.${fileName.split('.').pop()?.toLowerCase()}` : '';
  const extName = ext.replace('.', '');
  const isAudio = type === 'audio' || AUDIO_EXTENSIONS.has(extName);
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(extName);
  const isVideo = ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(extName);
  const isText = TEXT_EXTENSIONS.includes(ext);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string>('');
  const tempUriRef = useRef<string | null>(null);

  // Clean up the plaintext preview temp file when leaving the modal.
  useEffect(() => {
    return () => {
      if (tempUriRef.current) {
        void deleteTempFile(tempUriRef.current);
        tempUriRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!uri) {
      setLoading(false);
      setError(t('errors.itemNotFound'));
      return;
    }
    (async () => {
      try {
        // Show the plaintext size recorded in the DB when available; it is the
        // true size, unlike the ciphertext's inflated on-disk size.
        const plaintextSize = Number(size) || 0;
        if (plaintextSize > 0) {
          setFileSize(formatBytes(plaintextSize));
        } else {
          const file = new File(uri);
          if (!file.exists) {
            setError(t('errors.itemNotFound'));
            setLoading(false);
            return;
          }
          const sizeNum = Number(file.size);
          if (sizeNum > 0) setFileSize(formatBytes(sizeNum));
        }

        if (isAudio) {
          // Decrypt to a plaintext cache temp file for the native player.
          tempUriRef.current = await decryptVaultFileToCache(uri, vid, fileName);
          setAudioUri(tempUriRef.current);
          return;
        }

        const key = await getVaultKey(vid);
        const plainBytes = await readAndDecryptFileBytes(key, uri);
        if (isText) {
          const content = bytesToUtf8(plainBytes);
          setTextContent(content);
        } else if (isImage) {
          setImageUri(`data:image/jpeg;base64,${bytesToBase64Url(plainBytes)}`);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [uri, isAudio, isText, isImage, vid, t, size]);

  return (
    <FilePreviewView
      fileName={fileName}
      uri={uri}
      isImage={isImage}
      isVideo={isVideo}
      isAudio={isAudio}
      isText={isText}
      audioUri={audioUri}
      textContent={textContent}
      imageUri={imageUri}
      loading={loading}
      error={error}
      fileSize={fileSize}
      onDurationKnown={(sec) => { if (dbId) void persistPlaybackDuration(dbId, sec); }}
      onBack={() => router.back()}
      onErrorRetry={() => router.back()}
      t={t}
    />
  );
}

function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function formatBytes(bytes: number): string {
  const kb = bytes / 1024;
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(1)} KB`;
}

interface PreviewViewProps {
  fileName?: string;
  uri?: string;
  isImage: boolean;
  isVideo: boolean;
  isAudio: boolean;
  isText: boolean;
  audioUri: string | null;
  textContent: string | null;
  imageUri: string | null;
  loading: boolean;
  error: string | null;
  fileSize: string;
  onDurationKnown: (seconds: number) => void;
  onBack: () => void;
  onErrorRetry: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function FilePreviewView({
  fileName, uri, isImage, isVideo, isAudio, isText, audioUri, textContent, imageUri, loading, error, fileSize, onDurationKnown, onBack, onErrorRetry, t,
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

  if (error && !isImage && !isVideo && !isAudio) {
    return <ErrorView message={error} onRetry={onErrorRetry} />;
  }

  return (
    <ScreenLayout title={fileName || t('files.preview')} showBack onBack={onBack}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {isAudio ? (
          audioUri ? (
            <AudioPlayer sourceUri={audioUri} onDurationKnown={onDurationKnown} />
          ) : error ? (
            <View style={styles.center}>
              <Icon name="music-off" size={64} color={colors.onSurfaceVariant} />
              <Typography variant="bodyLarge" color={colors.error} style={styles.text}>{error}</Typography>
            </View>
          ) : (
            <View style={styles.center}>
              <Icon name="music" size={64} color={colors.onSurfaceVariant} />
              <Typography variant="bodyLarge" color={colors.onSurfaceVariant} style={styles.text}>{fileName}</Typography>
              {fileSize && <Typography variant="bodySmall" color={colors.onSurfaceVariant}>{fileSize}</Typography>}
            </View>
          )
        ) : isImage ? (
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