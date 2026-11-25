import { Component, DestroyRef, computed, inject } from '@angular/core';
import { ClientDocumentCountResponse } from '../../../models/management';
import { ClienteService } from '../../../services/cliente-service';
import { I18N_PIPES } from '../../../shared/i18n/i18n.pipes';
import { ReportChartComponent } from '../report-chart/report-chart';
import { ReportShellComponent } from '../report-shell/report-shell';
import { ReportQuery, ReportRow } from '../report-state';
import { ReportTableComponent } from '../report-table/report-table';

/** HU-125: documentos por cliente (consume HU-62). */
@Component({
  selector: 'app-reporte-documentos-por-cliente',
  standalone: true,
  imports: [ReportShellComponent, ReportChartComponent, ReportTableComponent, ...I18N_PIPES],
  templateUrl: './documentos-por-cliente.html',
  styleUrls: ['../report-common.css', './documentos-por-cliente.css'],
})
export class DocumentosPorClienteComponent {
  private readonly clients = inject(ClienteService);

  readonly query = new ReportQuery<ClientDocumentCountResponse>(inject(DestroyRef), (rows) =>
    rows.every((row) => !row.cantidadDocumentos),
  );

  readonly rows = computed<ReportRow[]>(() =>
    this.query
      .data()
      .map((row) => ({
        key: String(row.clientId),
        label: row.nombreCliente,
        count: row.cantidadDocumentos ?? 0,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
  );

  constructor() {
    this.query.run(() => this.clients.getDocumentCount());
  }
}
