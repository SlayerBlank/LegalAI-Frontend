import { Component, DestroyRef, computed, inject } from '@angular/core';
import { OpenCaseWithLawyerResponse } from '../../../models/expediente';
import { ExpedienteService } from '../../../services/expediente-service';
import { I18nService } from '../../../services/i18n.service';
import { I18N_PIPES } from '../../../shared/i18n/i18n.pipes';
import { ReportChartComponent } from '../report-chart/report-chart';
import { ReportShellComponent } from '../report-shell/report-shell';
import { ReportQuery, ReportRow, countBy, formatDay } from '../report-state';
import { ReportTableComponent } from '../report-table/report-table';

/** HU-136: expedientes abiertos agrupados por abogado responsable (consume HU-63). */
@Component({
  selector: 'app-reporte-expedientes-abiertos-por-abogado',
  standalone: true,
  imports: [ReportShellComponent, ReportChartComponent, ReportTableComponent, ...I18N_PIPES],
  templateUrl: './expedientes-abiertos-por-abogado.html',
  styleUrls: ['../report-common.css', './expedientes-abiertos-por-abogado.css'],
})
export class ExpedientesAbiertosPorAbogadoComponent {
  private readonly cases = inject(ExpedienteService);
  private readonly i18n = inject(I18nService);

  readonly query = new ReportQuery<OpenCaseWithLawyerResponse>(inject(DestroyRef));

  readonly rows = computed<ReportRow[]>(() =>
    countBy(
      this.query.data(),
      (item) => (item.abogado ? String(item.abogado.userId) : 'none'),
      (_key, item) => this.lawyerName(item),
    ),
  );

  /** Detalle: título del expediente y abogado, ordenado por abogado y título. */
  readonly detail = computed(() =>
    [...this.query.data()].sort(
      (a, b) =>
        this.lawyerName(a).localeCompare(this.lawyerName(b)) || a.title.localeCompare(b.title),
    ),
  );

  constructor() {
    this.query.run(() => this.cases.openWithLawyer());
  }

  day(value: string): string {
    return formatDay(value, this.i18n.locale());
  }

  lawyerName(item: OpenCaseWithLawyerResponse): string {
    return item.abogado?.fullName?.trim() || this.i18n.t('reports.r136.noLawyer');
  }
}
