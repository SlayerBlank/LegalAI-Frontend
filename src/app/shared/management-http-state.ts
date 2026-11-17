import { ChangeDetectorRef, DestroyRef, Directive, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize } from 'rxjs';
import { ManagementState } from './management-state';

export function managementError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return 'No se pudo completar la operación.';
  if (error.status === 0) return 'No fue posible conectar con el servidor. Inténtalo de nuevo.';
  const defaults: Record<number, string> = {
    400: 'Revisa los datos enviados.',
    401: 'La sesión no es válida. Inicia sesión de nuevo.',
    403: 'No tienes autorización para esta operación.',
    404: 'El recurso ya no está disponible.',
    409: 'El recurso está en uso o existe un conflicto.',
    500: 'El servidor no pudo completar la operación.',
  };
  const message =
    typeof error.error?.message === 'string' ? error.error.message : defaults[error.status];
  return `${error.status}: ${message || 'No se pudo completar la operación.'}`;
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
