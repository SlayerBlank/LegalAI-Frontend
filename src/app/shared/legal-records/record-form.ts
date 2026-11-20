import { HttpErrorResponse } from '@angular/common/http';
import { ValidatorFn } from '@angular/forms';

export const nonBlank: ValidatorFn = (control) =>
  typeof control.value === 'string' && control.value.trim() ? null : { required: true };

export function recordError(error: unknown, fallback: string): string {
  const message = error instanceof HttpErrorResponse ? error.error?.message : undefined;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

export function recordDateMatches(timestamp: string, from: string, to: string): boolean {
  // Spring supplies LocalDateTime. Use its calendar date without applying a timezone.
  const date = timestamp.slice(0, 10);
  return (!from || date >= from) && (!to || date <= to);
}
