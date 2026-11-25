import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CASE_STATUSES, CaseResponse } from '../../../models/expediente';
import { ExpedienteService } from '../../../services/expediente-service';
import { I18nService } from '../../../services/i18n.service';
import { I18N_PIPES } from '../../../shared/i18n/i18n.pipes';
import { ReportChartComponent } from '../report-chart/report-chart';
import { ReportShellComponent } from '../report-shell/report-shell';
import { ReportQuery, ReportRow, countByKeys, invalidRange } from '../report-state';
import { ReportTableComponent } from '../report-table/report-table';

/** HU-129: expedientes propios por estado dentro de un rango de apertura (consume HU-66). */
@Component({
  selector: 'app-reporte-expedientes-por-estado',
  standalone: true,
  imports: [
    FormsModule,
    ReportShellComponent,
    ReportChartComponent,
    ReportTableComponent,
    ...I18N_PIPES,
  ],
  templateUrl: './expedientes-por-estado.html',
  styleUrls: ['../report-common.css', './expedientes-por-estado.css'],
})
export class ExpedientesPorEstadoComponent {
  private readonly cases = inject(ExpedienteService);
  private readonly i18n = inject(I18nService);

  readonly query = new ReportQuery<CaseResponse>(inject(DestroyRef));
  readonly from = signal('');
  readonly to = signal('');
  readonly filterError = signal('');
  readonly rangeError = computed(() => invalidRange(this.from(), this.to()));

  readonly rows = computed<ReportRow[]>(() =>
    countByKeys(
      this.query.data(),
      CASE_STATUSES,
      (item) => item.status,
      (status) => this.i18n.t(`caseStatus.${status}`),
    ),
  );

  constructor() {
    this.apply();
  }

  /** GET /api/cases con openedFrom/openedTo; el backend responde 400 si el rango es inválido. */
  apply(): void {
    this.filterError.set('');
    if (this.rangeError()) {
      this.filterError.set('reports.errRange');
      return;
    }
    const filters = { openedFrom: this.from() || null, openedTo: this.to() || null };
    this.query.run(() => this.cases.list(filters));
  }

  clear(): void {
    this.from.set('');
    this.to.set('');
    this.apply();
  }
}
