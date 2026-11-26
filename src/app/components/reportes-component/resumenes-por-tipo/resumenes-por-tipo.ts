import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin, map, of, tap } from 'rxjs';
import { CaseResponse } from '../../../models/expediente';
import { SummaryResponse } from '../../../models/response/summary-response';
import { ExpedienteService } from '../../../services/expediente-service';
import { ResumenService } from '../../../services/resumen-service';
import { I18N_PIPES } from '../../../shared/i18n/i18n.pipes';
import { recordDateMatches } from '../../../shared/legal-records/record-form';
import { ReportChartComponent } from '../report-chart/report-chart';
import { ReportShellComponent } from '../report-shell/report-shell';
import { ReportQuery, ReportRow, countBy, invalidRange } from '../report-state';
import { ReportTableComponent } from '../report-table/report-table';

/** HU-138: resúmenes por tipo, con filtro de expediente y fecha de creación (HU-65). */
@Component({
  selector: 'app-reporte-resumenes-por-tipo',
  standalone: true,
  imports: [
    FormsModule,
    ReportShellComponent,
    ReportChartComponent,
    ReportTableComponent,
    ...I18N_PIPES,
  ],
  templateUrl: './resumenes-por-tipo.html',
  styleUrls: ['../report-common.css', './resumenes-por-tipo.css'],
})
export class ResumenesPorTipoComponent {
  private readonly summaries = inject(ResumenService);
  private readonly casesApi = inject(ExpedienteService);
  private readonly destroyRef = inject(DestroyRef);

  readonly query = new ReportQuery<{ summaryType: string }>(this.destroyRef);
  readonly cases = signal<CaseResponse[]>([]);
  readonly caseId = signal<number | null>(null);
  readonly from = signal('');
  readonly to = signal('');
  readonly filterError = signal('');
  readonly rangeError = computed(() => invalidRange(this.from(), this.to()));
  private all: SummaryResponse[] = [];

  readonly rows = computed<ReportRow[]>(() =>
    countBy(this.query.data(), (summary) => summary.summaryType?.trim() || '—'),
  );

  constructor() {
    this.casesApi
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (cases) => this.cases.set(cases ?? []), error: () => this.cases.set([]) });
    this.apply();
  }

  /**
   * Con expediente y ambas fechas se consulta GET /api/summaries/filter, que exige además un
   * tipo: se pide una vez por tipo conocido y se consolida. Con filtros parciales se filtra
   * el listado propio en el navegador.
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
      const types = [...new Set(this.all.map((summary) => summary.summaryType))];
      this.query.run(() =>
        types.length
          ? forkJoin(
              types.map((type) => this.summaries.filterRecords(caseId, type, from, to)),
            ).pipe(map((groups) => groups.flat()))
          : of([]),
      );
      return;
    }
    this.query.run(() =>
      this.summaries.list().pipe(
        tap((rows) => (this.all = rows ?? [])),
        map((rows) =>
          (rows ?? []).filter(
            (summary) =>
              (caseId === null || summary.caseId === caseId) &&
              recordDateMatches(summary.createdAt, from, to),
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
}
