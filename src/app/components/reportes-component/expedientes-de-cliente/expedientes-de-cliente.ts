import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin, map } from 'rxjs';
import { CASE_STATUSES } from '../../../models/expediente';
import { ClientCaseResponse, ClientResponse } from '../../../models/management';
import { ClienteService } from '../../../services/cliente-service';
import { I18nService } from '../../../services/i18n.service';
import { I18N_PIPES } from '../../../shared/i18n/i18n.pipes';
import { ReportChartComponent } from '../report-chart/report-chart';
import { ReportShellComponent } from '../report-shell/report-shell';
import { ReportQuery, ReportRow, countByKeys, invalidRange, isoDay } from '../report-state';
import { ReportTableComponent } from '../report-table/report-table';

/** HU-131: expedientes de un cliente por estado en un rango de apertura (consume HU-68). */
@Component({
  selector: 'app-reporte-expedientes-de-cliente',
  standalone: true,
  imports: [
    FormsModule,
    ReportShellComponent,
    ReportChartComponent,
    ReportTableComponent,
    ...I18N_PIPES,
  ],
  templateUrl: './expedientes-de-cliente.html',
  styleUrls: ['../report-common.css', './expedientes-de-cliente.css'],
})
export class ExpedientesDeClienteComponent {
  private readonly clientsApi = inject(ClienteService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  readonly query = new ReportQuery<ClientCaseResponse>(this.destroyRef);
  readonly clients = signal<ClientResponse[]>([]);
  readonly clientsError = signal(false);
  readonly clientId = signal<number | null>(null);
  readonly from = signal(isoDay(new Date(), -365));
  readonly to = signal(isoDay());
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
    this.loadClients();
  }

  loadClients(): void {
    this.clientsError.set(false);
    this.clientsApi
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (clients) => this.clients.set(clients ?? []),
        error: () => this.clientsError.set(true),
      });
  }

  /** El endpoint exige un estado por consulta: se pide una vez por estado y se consolida. */
  apply(): void {
    this.filterError.set('');
    const clientId = this.clientId();
    const from = this.from();
    const to = this.to();
    if (clientId === null) {
      this.filterError.set('reports.r131.errClient');
      return;
    }
    if (!from || !to) {
      this.filterError.set('reports.errDatesRequired');
      return;
    }
    if (this.rangeError()) {
      this.filterError.set('reports.errRange');
      return;
    }
    this.query.run(() =>
      forkJoin(
        CASE_STATUSES.map((status) => this.clientsApi.casesByFilter(clientId, status, from, to)),
      ).pipe(map((groups) => groups.flat())),
    );
  }
}
