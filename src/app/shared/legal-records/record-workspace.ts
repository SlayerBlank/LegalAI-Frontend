import { DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, materialize, take } from 'rxjs';
import { recordError } from './record-form';
import { I18nService } from '../../services/i18n.service';

// Keeps the full rows available when the API returns only a filter projection.
export class RecordWorkspace<T> {
  private readonly destroyRef = inject(DestroyRef);
  private readonly i18n = inject(I18nService);
  private readonly rows = signal<T[]>([]);
  private readonly matchingIds = signal<Set<number> | null>(null);
  private activeFilter: (() => Observable<Set<number>>) | null = null;

  readonly busy = signal(false);
  readonly error = signal('');
  readonly feedback = signal('');
  readonly allRecords = this.rows.asReadonly();
  readonly filtered = computed(() => this.matchingIds() !== null);
  readonly records = computed(() => {
    const ids = this.matchingIds();
    return ids ? this.rows().filter((row) => ids.has(this.id(row))) : this.rows();
  });

  constructor(private readonly id: (row: T) => number) {}

  load(request: Observable<T[]>) {
    this.run(
      request,
      (rows) => {
        this.rows.set(rows);
        if (this.activeFilter) this.filter(this.activeFilter);
      },
      this.i18n.t('records.errLoad'),
    );
  }

  filter(request: () => Observable<Set<number>>) {
    this.run(
      request(),
      (ids) => {
        this.activeFilter = request;
        this.matchingIds.set(ids);
      },
      this.i18n.t('records.errFilter'),
    );
  }

  clearFilter() {
    this.activeFilter = null;
    this.matchingIds.set(null);
    this.error.set('');
  }

  saved(row: T, message: string) {
    this.rows.update((rows) => [row, ...rows.filter((item) => this.id(item) !== this.id(row))]);
    this.feedback.set(message);
    if (this.activeFilter) {
      this.filter(this.activeFilter);
    }
  }

  removed(id: number, message: string) {
    this.rows.update((rows) => rows.filter((row) => this.id(row) !== id));
    this.feedback.set(message);
  }

  run<R>(request: Observable<R>, success: (data: R) => void, fallback: string) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');

    request
      .pipe(materialize(), take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.busy.set(false);
        if (result.kind === 'N') success(result.value);
        if (result.kind === 'E') this.error.set(recordError(result.error, fallback));
      });
  }
}
