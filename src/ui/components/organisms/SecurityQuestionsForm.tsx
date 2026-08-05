import { useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing, borderRadius } from '@core/theme';
import { Typography } from '@ui/components/atoms/Typography';
import { Icon } from '@ui/components/atoms/Icon';
import { Input } from '@ui/components/atoms/Input';
import {
  MIN_SECURITY_QUESTIONS,
  MAX_SECURITY_QUESTIONS,
  MIN_SECURITY_ANSWER_LENGTH,
  SECURITY_QUESTION_PRESETS,
} from '@core/constants/securityQuestions';

/** A single security question row: a preset question id + the user's answer. */
export interface SecurityQuestionEntry {
  question: string;
  answer: string;
}

interface SecurityQuestionsFormProps {
  entries: SecurityQuestionEntry[];
  onChange: (entries: SecurityQuestionEntry[]) => void;
  disabled?: boolean;
  showErrors?: boolean;
}

/** Editable list of security questions (preset picker + answer input). */
export function SecurityQuestionsForm({ entries, onChange, disabled, showErrors }: SecurityQuestionsFormProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const updateEntry = useCallback((index: number, patch: Partial<SecurityQuestionEntry>) => {
    onChange(entries.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }, [entries, onChange]);

  const removeEntry = useCallback((index: number) => {
    onChange(entries.filter((_, i) => i !== index));
  }, [entries, onChange]);

  const addEntry = useCallback(() => {
    if (entries.length < MAX_SECURITY_QUESTIONS) {
      onChange([...entries, { question: '', answer: '' }]);
    }
  }, [entries, onChange]);

  return (
    <View style={styles.container}>
      <Typography variant="bodySmall" color={colors.onSurfaceVariant} style={styles.hint}>{t('recovery.setupHint')}</Typography>

      {entries.map((entry, index) => {
        const error = showErrors
          ? !entry.question.trim()
            ? t('recovery.questionRequired')
            : entry.answer.length === 0
              ? t('recovery.answerRequired')
              : entry.answer.length < MIN_SECURITY_ANSWER_LENGTH
                ? t('recovery.answerTooShort')
                : undefined
          : undefined;

        return (
          <View key={index} style={[styles.row, { borderColor: colors.outlineVariant }]}>
            <View style={styles.rowHeader}>
              <Typography variant="labelLarge" color={colors.primary}>
                {t('recovery.answerLabel', { count: index + 1 })}
              </Typography>
              {entries.length > MIN_SECURITY_QUESTIONS && !disabled && (
                <TouchableOpacity
                  onPress={() => removeEntry(index)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={t('recovery.removeQuestion')}
                >
                  <Icon name="close" size={18} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              )}
            </View>

            <Typography variant="bodySmall" color={colors.onSurfaceVariant} style={styles.selectHint}>
              {t('recovery.selectQuestion')}
            </Typography>

            <View style={styles.chips}>
              {SECURITY_QUESTION_PRESETS.map((preset) => {
                const selected = entry.question === preset.id;
                return (
                  <TouchableOpacity
                    key={preset.id}
                    onPress={() => updateEntry(index, { question: selected ? '' : preset.id })}
                    disabled={disabled}
                    style={[styles.chip, {
                      backgroundColor: selected ? colors.primary : colors.surface,
                      borderColor: selected ? colors.primary : colors.outline,
                    }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={t(preset.labelKey)}
                  >
                    <Typography variant="labelSmall" color={selected ? colors.onPrimary : colors.onSurfaceVariant}>
                      {t(preset.labelKey)}
                    </Typography>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Input
              value={entry.answer}
              onChangeText={(text) => updateEntry(index, { answer: text })}
              placeholder={t('recovery.answerPlaceholder')}
              editable={!disabled}
              error={error}
            />
          </View>
        );
      })}

      {entries.length < MAX_SECURITY_QUESTIONS && !disabled && (
        <TouchableOpacity
          onPress={addEntry}
          style={[styles.addBtn, { borderColor: colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel={t('recovery.addQuestion')}
        >
          <Icon name="plus" size={18} color={colors.primary} />
          <Typography variant="bodyMedium" color={colors.primary}>{t('recovery.addQuestion')}</Typography>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  hint: {
    marginBottom: spacing.xs,
  },
  row: {
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectHint: {
    marginBottom: spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
});
