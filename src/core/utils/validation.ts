/** A single validation rule tied to a specific field. */
export class ValidationRule {
  constructor(
    /** The field name this rule applies to. */
    public readonly field: string,
    private readonly validate: (value: unknown) => string | null,
  ) {}

  /** Runs validation against the provided value. Returns an error message or null. */
  check(value: unknown): string | null {
    return this.validate(value);
  }
}

/** Creates a rule that checks the value is not null, undefined, or empty. */
export function required(field: string): ValidationRule {
  return new ValidationRule(field, (value) => {
    if (value === null || value === undefined || value === '') {
      return `${field} is required`;
    }
    return null;
  });
}

/** Creates a rule that checks a string meets the minimum length requirement. */
export function minLength(field: string, min: number): ValidationRule {
  return new ValidationRule(field, (value) => {
    if (typeof value === 'string' && value.length < min) {
      return `${field} must be at least ${min} characters`;
    }
    return null;
  });
}

/** Creates a rule that checks a string does not exceed the maximum length. */
export function maxLength(field: string, max: number): ValidationRule {
  return new ValidationRule(field, (value) => {
    if (typeof value === 'string' && value.length > max) {
      return `${field} must not exceed ${max} characters`;
    }
    return null;
  });
}

/** Creates a rule that checks a string matches the given regular expression. */
export function matchesPattern(field: string, pattern: RegExp, message: string): ValidationRule {
  return new ValidationRule(field, (value) => {
    if (typeof value === 'string' && !pattern.test(value)) {
      return message;
    }
    return null;
  });
}

/** Creates a rule that checks the value is of a specific JavaScript type. */
export function isType(field: string, type: 'string' | 'number' | 'boolean'): ValidationRule {
  return new ValidationRule(field, (value) => {
    if (typeof value !== type) {
      return `${field} must be a ${type}`;
    }
    return null;
  });
}

/** The outcome of running a set of validation rules. */
export interface ValidationResult {
  /** Whether all rules passed. */
  valid: boolean;
  /** Per-field list of error messages. */
  errors: Record<string, string[]>;
}

/** Validates a data object against an array of rules. */
export function validate(
  data: Record<string, unknown>,
  rules: ValidationRule[],
): ValidationResult {
  const errors: Record<string, string[]> = {};

  for (const rule of rules) {
    const error = rule.check(data[rule.field]);
    if (error) {
      if (!errors[rule.field]) errors[rule.field] = [];
      errors[rule.field]!.push(error);
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
