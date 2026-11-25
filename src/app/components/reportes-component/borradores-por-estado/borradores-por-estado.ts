import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin, map, of, tap } from 'rxjs';
import { CaseResponse } from '../../../models/expediente';
import { DraftResponse } from '../../../models/response/draft-response';
import { BorradorService } from '../../../services/borrador-service';
import { ExpedienteService } from '../../../services/expediente-service';
import { I18N_PIPES } from '../../../shared/i18n/i18n.pipes';
import { recordDateMatches } from '../../../shared/legal-records/record-form';
import { ReportChartComponent } from '../report-chart/report-chart';
import { ReportShellComponent } from '../report-shell/report-shell';
import { ReportQuery, ReportRow, countBy, invalidRange } from '../report-state';
import { ReportTableComponent } from '../report-table/report-table';

/** Estados que ofrece hoy el módulo Borradores; se suman los que existan en los datos. */
export const DRAFT_STATUSES = ['Borrador', 'En revisión', 'Revisado'] as const;

/** HU-127: borradores por estado, con filtro de expediente y fecha de modificación (HU-64). */
@Component({
  selector: 'app-reporte-borradores-por-estado',
  standalone: true,
  imports: [
    FormsModule,
    ReportShellComponent,
    ReportChartComponent,
    ReportTableComponent,
    ...I18N_PIPES,
  ],
  templateUrl: './borradores-por-estado.html',
  styleUrls: ['../report-common.css', './borradores-por-estado.css'],
})
export class BorradoresPorEstadoComponent {
  private readonly drafts = inject(BorradorService);
  private readonly casesApi = inject(ExpedienteService);
  private readonly destroyRef = inject(DestroyRef);

  readonly query = new ReportQuery<{ status: string }>(this.destroyRef);
  readonly cases = signal<CaseResponse[]>([]);
  readonly caseId = signal<number | null>(null);
  readonly from = signal('');
  readonly to = signal('');
  readonly filterError = signal('');
  readonly rangeError = computed(() => invalidRange(this.from(), this.to()));
  private all: DraftResponse[] = [];

  readonly rows = computed<ReportRow[]>(() =>
    countBy(this.query.data(), (draft) => draft.status?.trim() || '—'),
  );

  constructor() {
    this.casesApi
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (cases) => this.cases.set(cases ?? []), error: () => this.cases.set([]) });
    this.apply();
  }

  /**
   * Con expediente y ambas fechas se consulta GET /api/drafts/filter, que exige además un
   * estado: se pide una vez por estado conocido y se consolida. Con filtros parciales se
   * filtra el listado propio en el navegador.
   */
  apply(): void {
    this.filterError.set('');
    if (this.rangeError()) {
      this.filterError.set('reports.errRange');
      return;
    }
    const caseId = this.caseId();
    const from = this.from();
    const to = this.to();
    if (caseId !== null && from && to) {
      const statuses = this.statuses();
      this.query.run(() =>
        statuses.length
          ? forkJoin(
              statuses.map((status) => this.drafts.filterRecords(caseId, status, from, to)),
            ).pipe(map((groups) => groups.flat()))
          : of([]),
      );
      return;
    }
    this.query.run(() =>
      this.drafts.list().pipe(
        tap((rows) => (this.all = rows ?? [])),
        map((rows) =>
          (rows ?? []).filter(
            (draft) =>
              (caseId === null || draft.caseId === caseId) &&
              recordDateMatches(draft.updatedAt, from, to),
          ),
        ),
      ),
    );
  }

  clear(): void {
    this.caseId.set(null);
    this.from.set('');
    this.to.set('');
    this.apply();
  }

  private statuses(): string[] {
    return [...new Set([...DRAFT_STATUSES, ...this.all.map((draft) => draft.status)])];
  }
}
