import { DestroyRef, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subscription } from 'rxjs';
import { managementError } from '../../shared/management-http-state';

export type ReportStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Fila agregada de un reporte: clave estable, etiqueta visible y cantidad. */
export interface ReportRow {
  key: string;
  label: string;
  count: number;
}

/**
 * Estado de un reporte: carga, vacío, error con reintento y datos. Cada consulta nueva
 * cancela la anterior, así un filtro aplicado dos veces no mezcla respuestas.
 */
export class ReportQuery<T> {
  readonly status = signal<ReportStatus>('idle');
  readonly error = signal('');
  readonly data = signal<T[]>([]);
  readonly empty = computed(() => this.status() === 'ready' && this.isEmpty(this.data()));
  readonly hasData = computed(() => this.status() === 'ready' && !this.isEmpty(this.data()));

  private source: (() => Observable<T[]>) | null = null;
  private subscription?: Subscription;

  /** isEmpty permite tratar como vacío, p. ej., un conteo en el que todo es cero. */
  constructor(
    private readonly destroyRef: DestroyRef,
    private readonly isEmpty: (rows: T[]) => boolean = (rows) => rows.length === 0,
  ) {}

  run(source: () => Observable<T[]>): void {
    this.source = source;
    this.subscription?.unsubscribe();
    this.status.set('loading');
    this.error.set('');
    this.subscription = source()
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

  retry(): void {
    if (this.source) this.run(this.source);
  }

  /** Vuelve al estado inicial (sin consulta) y cancela la petición en curso. */
  reset(): void {
    this.subscription?.unsubscribe();
    this.source = null;
    this.data.set([]);
    this.error.set('');
    this.status.set('idle');
  }
}

/** Cuenta los elementos por clave; ordena de mayor a menor y, si empatan, por etiqueta. */
export function countBy<T>(
  items: readonly T[],
  key: (item: T) => string,
  label: (key: string, item: T) => string = (k) => k,
): ReportRow[] {
  const rows = new Map<string, ReportRow>();
  for (const item of items) {
    const k = key(item);
    const row = rows.get(k);
    if (row) row.count++;
    else rows.set(k, { key: k, label: label(k, item), count: 1 });
  }
  return [...rows.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Conteo con un orden fijo de claves (p. ej. un enum); incluye las claves en cero. */
export function countByKeys<T>(
  items: readonly T[],
  keys: readonly string[],
  key: (item: T) => string,
  label: (key: string) => string,
): ReportRow[] {
  const counts = new Map(keys.map((k) => [k, 0]));
  for (const item of items) {
    const k = key(item);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts].map(([k, count]) => ({ key: k, label: label(k), count }));
}

export function totalOf(rows: readonly ReportRow[]): number {
  return rows.reduce((sum, row) => sum + row.count, 0);
}

/** true si ambas fechas (yyyy-MM-dd) existen y la inicial es posterior a la final. */
export function invalidRange(from: string, to: string): boolean {
  return !!from && !!to && from > to;
}

/** Fecha local yyyy-MM-dd; desplazada en días si se indica. */
export function isoDay(date = new Date(), offsetDays = 0): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Día calendario de un LocalDateTime de Spring, sin aplicar zona horaria. */
export function dayOf(timestamp: string | null | undefined): string {
  return (timestamp ?? '').slice(0, 10);
}

/** Etiqueta corta y localizada de un día yyyy-MM-dd. */
export function formatDay(day: string, locale: string): string {
  const [y, m, d] = day.split('-').map(Number);
  if (!y || !m || !d) return day;
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(y, m - 1, d),
  );
}
