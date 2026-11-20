import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CaseSessionCountResponse } from '../../../models/expediente';
import { ClientDocumentCountResponse } from '../../../models/management';
import { ClienteService } from '../../../services/cliente-service';
import { ExpedienteService } from '../../../services/expediente-service';
import { I18nService } from '../../../services/i18n.service';
import { I18N_PIPES } from '../../../shared/i18n/i18n.pipes';
import { CountQuery } from './query-state';

/** Sección "Consultas" del panel: conteos agregados calculados por el backend. */
@Component({
  selector: 'app-dashboard-queries',
  standalone: true,
  imports: [RouterLink, ...I18N_PIPES],
  templateUrl: './dashboard-queries.html',
  styleUrl: './dashboard-queries.css',
})
export class DashboardQueriesComponent implements OnInit {
  private readonly cases = inject(ExpedienteService);
  private readonly clients = inject(ClienteService);
  private readonly destroyRef = inject(DestroyRef);
  readonly i18n = inject(I18nService);

  /** HU-61: sesiones de chat por expediente. */
  readonly sessions = new CountQuery<CaseSessionCountResponse>(
    () => this.cases.sessionCounts(),
    (row) => row.cantidadSesiones,
    (row) => row.caseId,
    this.destroyRef,
  );

  /** HU-62: documentos por cliente. */
  readonly documents = new CountQuery<ClientDocumentCountResponse>(
    () => this.clients.getDocumentCount(),
    (row) => row.cantidadDocumentos,
    (row) => row.clientId,
    this.destroyRef,
  );

  ngOnInit(): void {
    this.sessions.load();
    this.documents.load();
  }
}
