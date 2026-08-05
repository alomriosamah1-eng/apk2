import { SECURITY_QUESTION_PRESETS } from '@core/constants/securityQuestions';
import { TFunction } from 'i18next';

/**
 * Resolves the human-readable label for a stored security question.
 * Questions created from presets store the preset id; anything else (custom)
 * is shown verbatim.
 */
export function securityQuestionLabel(question: string, t: TFunction): string {
  const preset = SECURITY_QUESTION_PRESETS.find((p) => p.id === question);
  return preset ? t(`recovery.presets.${preset.id}`) : question;
}