import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { catchError, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { DocumentResponse, ProcessingStatus } from '../../../models/documento';
import { DocumentoService } from '../../../services/documento-service';
import { I18nService } from '../../../services/i18n.service';
import { LoginService } from '../../../services/login-service';
import { UsuarioService } from '../../../services/usuario-service';
import { I18N_PIPES } from '../../../shared/i18n/i18n.pipes';
import { ReportChartComponent } from '../report-chart/report-chart';
import { ReportShellComponent } from '../report-shell/report-shell';
import { ReportQuery, ReportRow, countByKeys } from '../report-state';
import { ReportTableComponent } from '../report-table/report-table';

/** Estados que el backend considera pendientes de revisión (ESTADOS_PENDIENTES_REVISION). */
export const PENDING_STATUSES: readonly ProcessingStatus[] = ['UPLOADED', 'PROCESSING', 'ERROR'];

/** HU-140: documentos pendientes de revisión por estado de procesamiento (consume HU-67). */
@Component({
  selector: 'app-reporte-documentos-pendientes',
  standalone: true,
  imports: [ReportShellComponent, ReportChartComponent, ReportTableComponent, ...I18N_PIPES],
  templateUrl: './documentos-pendientes.html',
  styleUrls: ['../report-common.css', './documentos-pendientes.css'],
})
export class DocumentosPendientesComponent {
  private readonly documents = inject(DocumentoService);
  private readonly login = inject(LoginService);
  private readonly users = inject(UsuarioService);
  private readonly i18n = inject(I18nService);

  readonly query = new ReportQuery<DocumentResponse>(inject(DestroyRef));
  private readonly caseTitles = signal(new Map<number, string>());

  readonly rows = computed<ReportRow[]>(() =>
    countByKeys(
      this.query.data(),
      PENDING_STATUSES,
      (doc) => doc.processingStatus,
      (status) => this.i18n.t(`status.${status}`),
    ),
  );

  /** Detalle ordenado por antigüedad, como lo entrega el backend (createdAt ascendente). */
  readonly detail = computed(() => this.query.data());

  constructor() {
    this.query.run(() => {
      const current = this.login.currentUser();
      const userId$ = current
        ? of(current.userId)
        : this.users.getCurrentUser().pipe(map((user) => user.userId));
      return userId$.pipe(
        switchMap((userId) =>
          forkJoin([
            this.documents.pendingReview(userId),
            // Sin títulos de expediente el reporte sigue siendo útil: se muestra el identificador.
            this.documents.listCases().pipe(catchError(() => of([]))),
          ]),
        ),
        tap(([, cases]) =>
          this.caseTitles.set(new Map(cases.map((item) => [item.caseId, item.title]))),
        ),
        map(([docs]) => docs),
      );
    });
  }

  caseTitle(caseId: number): string {
    return this.caseTitles().get(caseId) ?? this.i18n.t('reports.caseFallback', { id: caseId });
  }
}
