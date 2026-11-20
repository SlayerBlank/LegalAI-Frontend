import { DestroyRef, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { managementError } from '../../../shared/management-http-state';

/**
 * Estado de una consulta de conteo del panel: carga, vacío ([] con 200), error con reintento,
 * filas ordenadas de mayor a menor y total. Un error nunca se presenta como cero.
 */
export class CountQuery<T> {
  readonly status = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly error = signal('');
  private readonly data = signal<T[]>([]);

  readonly rows = computed(() =>
    [...this.data()].sort((a, b) => this.count(b) - this.count(a) || this.id(a) - this.id(b)),
  );
  readonly total = computed(() => this.data().reduce((sum, row) => sum + this.count(row), 0));
  readonly empty = computed(() => this.status() === 'ready' && this.data().length === 0);

  constructor(
    private readonly source: () => Observable<T[]>,
    private readonly count: (row: T) => number,
    private readonly id: (row: T) => number,
    private readonly destroyRef: DestroyRef,
  ) {}

  load(): void {
    if (this.status() === 'loading') return;
    this.status.set('loading');
    this.error.set('');
    this.source()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.data.set(rows ?? []);
          this.status.set('ready');
        },
        error: (e: unknown) => {
          this.data.set([]);
          this.error.set(managementError(e));
          this.status.set('error');
        },
      });
  }
}
