import { registerDecorator, ValidationOptions } from 'class-validator';

export interface ValidDateOptions {
  // dateOfBirth: must be today or earlier, and not before 1900
  past?: boolean;
}

// Checks a real calendar date in YYYY-MM-DD format.
// "2026-02-30" or "7387-20-81" fail here with 400 instead of reaching
// PostgreSQL and failing with 500.
export function isValidDateString(
  value: unknown,
  options: ValidDateOptions = {},
): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    return false;
  }

  if (options.past) {
    const today = new Date().toISOString().slice(0, 10);
    return value >= '1900-01-01' && value <= today;
  }

  return true;
}

export function IsValidDate(
  options: ValidDateOptions = {},
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidDate',
      target: object.constructor,
      propertyName,
      options: {
        message: options.past
          ? `${propertyName} must be a real date in YYYY-MM-DD format, between 1900-01-01 and today`
          : `${propertyName} must be a real date in YYYY-MM-DD format`,
        ...validationOptions,
      },
      validator: {
        validate: (value: unknown) => isValidDateString(value, options),
      },
    });
  };
}
