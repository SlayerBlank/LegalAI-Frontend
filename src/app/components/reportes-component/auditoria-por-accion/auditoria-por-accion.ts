import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { map, tap } from 'rxjs';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  AuditLogFilters,
  AuditLogResponse,
} from '../../../models/auditoria';
import { UserResponse } from '../../../models/management';
import { AuditoriaService } from '../../../services/auditoria-service';
import { I18nService } from '../../../services/i18n.service';
import { UsuarioService } from '../../../services/usuario-service';
import { I18N_PIPES } from '../../../shared/i18n/i18n.pipes';
import { ReportChartComponent } from '../report-chart/report-chart';
import { ReportShellComponent } from '../report-shell/report-shell';
import { ReportQuery, ReportRow, countBy, invalidRange } from '../report-state';
import { ReportTableComponent } from '../report-table/report-table';

/** Criterios que cuenta el backend para exigir al menos dos (from y to cuentan por separado). */
export function activeCriteria(filters: AuditLogFilters): number {
  return [
    filters.userId !== null,
    !!filters.action.trim(),
    !!filters.entityType.trim(),
    !!filters.from,
    !!filters.to,
  ].filter(Boolean).length;
}

/** HU-133: eventos de auditoría por acción con al menos dos filtros (consume HU-70). Solo ADMIN. */
@Component({
  selector: 'app-reporte-auditoria-por-accion',
  standalone: true,
  imports: [
    FormsModule,
    ReportShellComponent,
    ReportChartComponent,
    ReportTableComponent,
    ...I18N_PIPES,
  ],
  templateUrl: './auditoria-por-accion.html',
  styleUrls: ['../report-common.css', './auditoria-por-accion.css'],
})
export class AuditoriaPorAccionComponent {
  private readonly audit = inject(AuditoriaService);
  private readonly usersApi = inject(UsuarioService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  readonly actions = Object.keys(AUDIT_ACTIONS);
  readonly entityTypes = AUDIT_ENTITY_TYPES;
  readonly query = new ReportQuery<AuditLogResponse>(this.destroyRef);
  readonly users = signal<UserResponse[]>([]);
  readonly usersError = signal(false);
  readonly userId = signal<number | null>(null);
  readonly action = signal('');
  readonly entityType = signal('');
  readonly from = signal('');
  readonly to = signal('');
  readonly filterError = signal('');
  readonly rangeError = computed(() => invalidRange(this.from(), this.to()));
  /** Total informado por el servidor; puede superar lo cargado si se alcanzó el tope de páginas. */
  readonly serverTotal = signal(0);
  readonly truncated = computed(() => this.serverTotal() > this.query.data().length);

  readonly criteria = computed(() => activeCriteria(this.filters()));

  readonly rows = computed<ReportRow[]>(() =>
    countBy(
      this.query.data(),
      (log) => log.action,
      (action) => this.actionLabel(action),
    ),
  );

  constructor() {
    this.usersApi
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (users) => this.users.set(users ?? []),
        error: () => this.usersError.set(true),
      });
  }

  filters(): AuditLogFilters {
    return {
      userId: this.userId(),
      action: this.action(),
      entityType: this.entityType(),
      from: this.from(),
      to: this.to(),
    };
  }

  apply(): void {
    this.filterError.set('');
    const filters = this.filters();
    if (activeCriteria(filters) < 2) {
      this.filterError.set('reports.r133.errMinFilters');
      return;
    }
    if (this.rangeError()) {
      this.filterError.set('reports.errRange');
      return;
    }
    this.query.run(() =>
      this.audit.advancedSearchAll(filters).pipe(
        tap(({ total }) => this.serverTotal.set(total)),
        map(({ events }) => events),
      ),
    );
  }

  clear(): void {
    this.userId.set(null);
    this.action.set('');
    this.entityType.set('');
    this.from.set('');
    this.to.set('');
    this.filterError.set('');
    this.serverTotal.set(0);
    this.query.reset();
  }

  /** Respaldo si /users falla: identificador numérico escrito a mano. */
  setUserId(value: number | string | null): void {
    const id = value === null || value === '' ? null : Number(value);
    this.userId.set(id !== null && Number.isInteger(id) && id > 0 ? id : null);
  }

  actionLabel(action: string): string {
    return action in AUDIT_ACTIONS ? this.i18n.t(`action.${action}`) : action;
  }
}
