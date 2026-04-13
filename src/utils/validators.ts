// Provides validation helpers that return booleans or error messages.
export const isNonEmptyText = (value: string): boolean =>
  value.trim().length > 0;

export const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export const isValidPassword = (value: string): boolean => value.length >= 6;
