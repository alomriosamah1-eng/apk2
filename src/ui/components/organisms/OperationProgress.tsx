import React from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing, borderRadius } from '@core/theme';
import { Typography } from '@ui/components/atoms/Typography';
import { Icon } from '@ui/components/atoms/Icon';
import { ImportProgressUpdate, ImportPhase } from '@data/media/MediaStorage';

interface OperationProgressProps {
  /** Live update stream, or null to hide the overlay. */
  progress: ImportProgressUpdate | null;
  onCancel: () => void;
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function formatEta(ms: number): string {
  if (ms < 0 || !isFinite(ms)) return '--';
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '--';
  if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  if (bytesPerSec >= 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${Math.round(bytesPerSec)} B/s`;
}

/**
 * Live operation overlay: phase, per-file counts, percentage, elapsed time,
 * ETA, throughput and the current file, all refreshed on every progress tick.
 */
export function OperationProgress({ progress, onCancel }: OperationProgressProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const { colors } = useTheme();

  if (!progress) return null;

  const { total, done, phase, currentName, elapsedMs, speedBytesPerSec } = progress;
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const etaMs = done > 0 ? (elapsedMs / done) * (total - done) : -1;
  const phaseKey: Record<ImportPhase, string> = {
    waiting: 'progress.waiting',
    reading: 'progress.reading',
    hashing: 'progress.hashing',
    encrypting: 'progress.encrypting',
    writing: 'progress.writing',
    done: 'progress.done',
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Typography variant="title">{t('progress.title')}</Typography>

          <View style={styles.rowBetween}>
            <Typography variant="bodySmall">{t(phaseKey[phase])}</Typography>
            <Typography variant="bodySmall">{t('progress.percent', { percent })}</Typography>
          </View>

          <View style={[styles.track, { backgroundColor: colors.surfaceVariant }]}>
            <View style={[styles.fill, { width: `${percent}%`, backgroundColor: colors.primary }]} />
          </View>

          <View style={styles.rowBetween}>
            <Typography variant="bodySmall">
              {t('progress.files', { done, total })}
            </Typography>
            <Typography variant="bodySmall">{t('progress.remaining', { count: Math.max(0, total - done) })}</Typography>
          </View>

          {currentName ? (
            <View style={styles.currentRow}>
              <Icon name="file" size={16} color={colors.onSurfaceVariant} />
              <Typography variant="caption" numberOfLines={1} style={styles.currentName}>
                {currentName}
              </Typography>
            </View>
          ) : null}

          <View style={styles.metrics}>
            <Metric label={t('progress.elapsed')} value={formatElapsed(elapsedMs)} />
            <Metric label={t('progress.eta')} value={formatEta(etaMs)} />
            <Metric label={t('progress.speed')} value={formatSpeed(speedBytesPerSec)} />
          </View>

          <TouchableOpacity
            onPress={onCancel}
            style={[styles.cancelBtn, { borderColor: colors.error }]}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Text style={{ color: colors.error }}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function Metric({ label, value }: { label: string; value: string }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={styles.metric}>
      <Typography variant="caption" color={colors.onSurfaceVariant}>{label}</Typography>
      <Typography variant="bodySmall">{value}</Typography>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  currentName: {
    flex: 1,
  },
  metrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metric: {
    alignItems: 'center',
    gap: 2,
  },
  cancelBtn: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
});
