import { Component, DestroyRef, computed, inject } from '@angular/core';
import { CaseSessionCountResponse } from '../../../models/expediente';
import { ExpedienteService } from '../../../services/expediente-service';
import { I18N_PIPES } from '../../../shared/i18n/i18n.pipes';
import { ReportChartComponent } from '../report-chart/report-chart';
import { ReportShellComponent } from '../report-shell/report-shell';
import { ReportQuery, ReportRow } from '../report-state';
import { ReportTableComponent } from '../report-table/report-table';

/** HU-134: sesiones de chat por expediente (consume HU-61). */
@Component({
  selector: 'app-reporte-sesiones-por-expediente',
  standalone: true,
  imports: [ReportShellComponent, ReportChartComponent, ReportTableComponent, ...I18N_PIPES],
  templateUrl: './sesiones-por-expediente.html',
  styleUrls: ['../report-common.css', './sesiones-por-expediente.css'],
})
export class SesionesPorExpedienteComponent {
  private readonly cases = inject(ExpedienteService);

  readonly query = new ReportQuery<CaseSessionCountResponse>(inject(DestroyRef), (rows) =>
    rows.every((row) => !row.cantidadSesiones),
  );

  readonly rows = computed<ReportRow[]>(() =>
    this.query
      .data()
      .map((row) => ({
        key: String(row.caseId),
        label: row.tituloExpediente,
        count: row.cantidadSesiones ?? 0,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
  );

  constructor() {
    this.query.run(() => this.cases.sessionCounts());
  }
}
