/** Minimum number of security questions required to enable PIN recovery. */
export const MIN_SECURITY_QUESTIONS = 2;
/** Maximum number of security questions a vault can have. */
export const MAX_SECURITY_QUESTIONS = 3;
/** Minimum length of a security answer. */
export const MIN_SECURITY_ANSWER_LENGTH = 2;
/** Maximum length of a security answer. */
export const MAX_SECURITY_ANSWER_LENGTH = 60;
/** Maximum question text length. */
export const MAX_SECURITY_QUESTION_LENGTH = 120;
/** Number of wrong-answer attempts allowed per recovery session before the form locks. */
export const MAX_RECOVERY_ATTEMPTS = 3;

/** Built-in security questions shown as selectable presets (labels are localized). */
export interface SecurityQuestionPreset {
  id: string;
  labelKey: string;
}

/** Predefined security question presets with their i18n label keys. */
export const SECURITY_QUESTION_PRESETS: SecurityQuestionPreset[] = [
  { id: 'motherName', labelKey: 'recovery.presets.motherName' },
  { id: 'favoriteCity', labelKey: 'recovery.presets.favoriteCity' },
  { id: 'petName', labelKey: 'recovery.presets.petName' },
  { id: 'firstSchool', labelKey: 'recovery.presets.firstSchool' },
  { id: 'favoriteFood', labelKey: 'recovery.presets.favoriteFood' },
  { id: 'firstCar', labelKey: 'recovery.presets.firstCar' },
  { id: 'birthCity', labelKey: 'recovery.presets.birthCity' },
];
