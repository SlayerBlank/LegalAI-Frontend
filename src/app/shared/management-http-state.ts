import { ChangeDetectorRef, DestroyRef, Directive, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize } from 'rxjs';
import { ManagementState } from './management-state';
import { translate } from '../services/i18n.service';

export function managementError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return translate('errors.generic');
  if (error.status === 0) return translate('errors.network');
  const known = [400, 401, 403, 404, 409, 500];
  const fallback = known.includes(error.status) ? translate(`errors.${error.status}`) : '';
  // El mensaje del backend tiene prioridad: lo escribe el servidor y no se traduce aquí.
  const message = typeof error.error?.message === 'string' ? error.error.message : fallback;
  return `${error.status}: ${message || translate('errors.generic')}`;
}

@Directive()
export abstract class ManagementHttpState<T> extends ManagementState<T> {
  loading = false;
  loaded = false;
  busy = false;
  error = '';
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetector = inject(ChangeDetectorRef);
  protected run<R>(
    source: Observable<R>,
    kind: 'loading' | 'busy',
    success: (value: R) => void,
    failure?: () => void,
  ): void {
    this[kind] = true;
    if (kind === 'loading') this.loaded = false;
    this.error = '';
    this.notice = '';
    source
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this[kind] = false;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: (value) => {
          if (kind === 'loading') this.loaded = true;
          success(value);
          this.changeDetector.markForCheck();
        },
        error: (error) => {
          this.error = managementError(error);
          failure?.();
          this.changeDetector.markForCheck();
        },
      });
  }
  override close(): void {
    if (!this.busy) super.close();
  }
}
