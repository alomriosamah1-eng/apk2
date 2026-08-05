import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, LayoutChangeEvent, GestureResponderEvent } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing } from '@core/theme';
import { Icon } from '@ui/components/atoms/Icon';
import type { MaterialCommunityIcons } from '@expo/vector-icons';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

interface AudioPlayerProps {
  /** Plaintext file URI of the decrypted audio to play. */
  sourceUri: string;
  /** Invoked whenever the decoder reports a (new) duration, in seconds. */
  onDurationKnown?: (durationSeconds: number) => void;
}

/** Load watchdog: if the decoder never reports the file as loaded, it is corrupt/unsupported. */
const LOAD_TIMEOUT_MS = 15_000;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds % 60);
  const m = Math.floor(seconds / 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Native audio playback for a decrypted vault file, backed by expo-audio
 * (ExoPlayer). Provides play/pause, tap-to-seek, ±10s skip, buffering and a
 * decode watchdog so silent/corrupt files surface an error instead of hanging.
 * The player source is a short-lived plaintext temp file that the owning screen
 * removes via MediaStorage.deleteTempFile on unmount.
 */
export function AudioPlayer({ sourceUri, onDurationKnown }: AudioPlayerProps): React.JSX.Element {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!sourceUri) return;
    setDecodeError(null);
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    try {
      player.replace(sourceUri);
    } catch (err) {
      setDecodeError((err as Error).message);
      return;
    }
    return () => {
      if (watchdog.current) clearTimeout(watchdog.current);
    };
  }, [sourceUri, player]);

  const duration = status?.duration ?? 0;
  const currentTime = status?.currentTime ?? 0;
  const isLoaded = Boolean(status?.isLoaded);

  // Arm/disarm the decode watchdog around isLoaded.
  useEffect(() => {
    if (watchdog.current) {
      clearTimeout(watchdog.current);
      watchdog.current = null;
    }
    if (!isLoaded && sourceUri) {
      watchdog.current = setTimeout(() => {
        setDecodeError(t('files.audioDecodeError'));
      }, LOAD_TIMEOUT_MS);
    }
    return () => {
      if (watchdog.current) {
        clearTimeout(watchdog.current);
        watchdog.current = null;
      }
    };
  }, [isLoaded, sourceUri, t]);

  useEffect(() => {
    if (onDurationKnown && duration > 0) onDurationKnown(duration);
  }, [duration, onDurationKnown]);

  if (decodeError) {
    return (
      <View style={[styles.errorBox, { backgroundColor: colors.errorContainer }]}>
        <Icon name="music-off" size={28} color={colors.error} />
        <Text style={[styles.errorText, { color: colors.error }]}>{decodeError}</Text>
      </View>
    );
  }

  const playing = Boolean(status?.playing);
  const buffering = !isLoaded || Boolean(status?.isBuffering);

  const seekToFraction = (fraction: number): void => {
    if (!(duration > 0)) return;
    const target = Math.max(0, Math.min(duration, fraction * duration));
    void player.seekTo(target).catch(() => {});
  };

  const onTrackLayout = (e: LayoutChangeEvent): void => setTrackWidth(e.nativeEvent.layout.width);
  const onTrackPress = (e: GestureResponderEvent): void => {
    if (trackWidth > 0) seekToFraction(e.nativeEvent.locationX / trackWidth);
  };

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceVariant }]}>
      <View style={styles.rowBetween}>
        <Icon name="music" size={22} color={colors.onSurfaceVariant} />
        <Text style={[styles.timeText, { color: colors.onSurfaceVariant }]}>
          {formatTime(currentTime)} / {duration > 0 ? formatTime(duration) : '--:--'}
        </Text>
      </View>

      <View
        style={styles.track}
        onLayout={onTrackLayout}
        onTouchEnd={onTrackPress}
        accessibilityRole="adjustable"
        accessibilityLabel={t('files.audioSeek')}
        accessibilityValue={{ min: 0, max: Math.max(1, Math.round(duration)), now: Math.round(currentTime) }}
      >
        <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: colors.primary }]} />
      </View>

      <View style={styles.controls}>
        <IconButton icon="rewind-10" onPress={() => seekToFraction(Math.max(0, currentTime - 10) / (duration || 1))} />
        <TouchableOpacity
          onPress={() => { if (playing) player.pause(); else player.play(); }}
          accessibilityRole="button"
          accessibilityLabel={playing ? t('audio.pause') : t('audio.play')}
          style={[styles.playButton, { backgroundColor: colors.primary }]}
        >
          {buffering ? (
            <Text style={[styles.buffering, { color: colors.onPrimary }]}>{t('audio.buffering')}</Text>
          ) : (
            <Icon name={playing ? 'pause' : 'play'} size={30} color={colors.onPrimary} />
          )}
        </TouchableOpacity>
        <IconButton icon="fast-forward-10" onPress={() => seekToFraction((currentTime + 10) / (duration || 1))} />
      </View>
    </View>
  );
}

function IconButton({ icon, onPress }: { icon: IconName; onPress: () => void }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" style={styles.iconButton}>
      <Icon name={icon} size={26} color={colors.onSurface} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: 12,
    gap: spacing.md,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeText: { fontVariant: ['tabular-nums'] },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.15)',
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  iconButton: { padding: spacing.sm },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buffering: { fontSize: 12 },
  errorBox: {
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorText: { fontWeight: '600' },
});