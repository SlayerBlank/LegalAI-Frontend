import { Component, HostListener, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  AUDIT_PAGE_SIZE,
  AuditLogFilters,
  AuditLogResponse,
  PageResult,
} from '../../models/auditoria';
import { UserResponse } from '../../models/management';
import { AuditoriaService } from '../../services/auditoria-service';
import { UsuarioService } from '../../services/usuario-service';
import { ManagementHttpState } from '../../shared/management-http-state';
import { ManagementDialogDirective } from '../../shared/management-dialog.directive';
import { I18N_PIPES } from '../../shared/i18n/i18n.pipes';
import { I18nService } from '../../services/i18n.service';

const EMPTY_FILTERS: AuditLogFilters = {
  userId: null,
  action: '',
  entityType: '',
  from: '',
  to: '',
};

@Component({
  selector: 'app-auditoria',
  standalone: true,
  imports: [FormsModule, ManagementDialogDirective, ...I18N_PIPES],
  templateUrl: './auditoria-component.html',
  styleUrls: [
    '../../shared/management.css',
    '../../shared/modern-module.css',
    './auditoria-component.css',
  ],
})
export class AuditoriaComponent extends ManagementHttpState<AuditLogResponse> implements OnInit {
  private readonly api = inject(AuditoriaService);
  private readonly usersApi = inject(UsuarioService);
  private readonly route = inject(ActivatedRoute);
  readonly i18n = inject(I18nService);

  readonly actions = Object.keys(AUDIT_ACTIONS);
  readonly entityTypes = AUDIT_ENTITY_TYPES;
  /** Filtros del formulario (borrador) y filtros con los que se hizo la última consulta. */
  form: AuditLogFilters = { ...EMPTY_FILTERS };
  applied: AuditLogFilters = { ...EMPTY_FILTERS };
  formError = '';
  /** HU-131: modo "búsqueda avanzada" del formulario y modo con el que se hizo la última consulta. */
  advanced = false;
  appliedAdvanced = false;

  result: PageResult<AuditLogResponse> = {
    content: [],
    number: 0,
    size: AUDIT_PAGE_SIZE,
    totalElements: 0,
    totalPages: 0,
  };
  users: UserResponse[] = [];
  usersAvailable = true;
  /** HU-121: actividad de un usuario; logs es null mientras carga o si falló. */
  activity: { userId: number; logs: AuditLogResponse[] | null } | null = null;

  ngOnInit() {
    this.load();
    /** HU-121: acceso directo desde Gestión de usuarios con /auditoria?userId=7 */
    const userId = Number(this.route.snapshot.queryParamMap.get('userId'));
    if (Number.isInteger(userId) && userId > 0) this.showActivity(userId, true);
  }

  /** Primera carga: registros y usuarios. Si /users falla, la auditoría sigue mostrando los IDs. */
  load() {
    if (this.loading || this.busy) return;
    this.run(
      forkJoin({
        page: this.api.search(this.applied, 0),
        users: this.usersApi.list().pipe(catchError(() => of(null))),
      }),
      'loading',
      ({ page, users }) => {
        this.result = page;
        this.users = users ?? [];
        this.usersAvailable = users !== null;
      },
    );
  }

  search() {
    if (this.loading || this.busy) return;
    this.formError = this.validate(this.form) || this.validateAdvanced(this.form);
    if (this.formError) return;
    this.applied = { ...this.form, action: this.form.action.trim().toUpperCase() };
    this.appliedAdvanced = this.advanced;
    this.fetch(0);
  }

  clear() {
    if (this.loading || this.busy) return;
    this.form = { ...EMPTY_FILTERS };
    this.formError = '';
    this.applied = { ...EMPTY_FILTERS };
    this.appliedAdvanced = false;
    this.fetch(0);
  }

  /** HU-131: al salir del modo avanzado se vuelve a la búsqueda normal con los mismos filtros. */
  setAdvanced(on: boolean) {
    if (this.loading || this.busy) return;
    this.advanced = on;
    this.formError = '';
    if (!on && this.appliedAdvanced) {
      this.appliedAdvanced = false;
      this.fetch(0);
    }
  }

  /** HU-131: criterios como los cuenta el backend; from y to cuentan por separado. */
  criteriaCount(f: AuditLogFilters): number {
    return [
      f.userId !== null,
      !!f.action.trim(),
      !!f.entityType.trim(),
      !!f.from,
      !!f.to,
    ].filter(Boolean).length;
  }

  /** HU-131: mínimo dos criterios en modo avanzado, validado antes de llamar a la API. */
  validateAdvanced(f: AuditLogFilters): string {
    if (!this.advanced) return '';
    const count = this.criteriaCount(f);
    return count < 2 ? this.i18n.t('audit.errMinCriteria', { count }) : '';
  }

  goTo(page: number) {
    if (page < 0 || page >= this.result.totalPages || page === this.result.number) return;
    this.fetch(page);
  }

  /** Atajo desde el detalle: todos los registros del mismo usuario. */
  filterByUser(userId: number) {
    if (this.busy) return;
    this.close();
    this.advanced = false;
    this.form = { ...EMPTY_FILTERS, userId };
    this.search();
  }

  validate(filters: AuditLogFilters): string {
    if (filters.from && filters.to && filters.from > filters.to)
      return this.i18n.t('audit.errDates');
    if (filters.action.length > 80 || filters.entityType.length > 80)
      return this.i18n.t('audit.errLength');
    return '';
  }

  get activeFilters(): number {
    const f = this.applied;
    return [f.userId !== null, !!f.action, !!f.entityType, !!f.from, !!f.to].filter(Boolean).length;
  }

  get firstRow(): number {
    return this.result.totalElements ? this.result.number * this.result.size + 1 : 0;
  }

  get lastRow(): number {
    return this.result.number * this.result.size + this.result.content.length;
  }

  actionLabel(action: string): string {
    // Acciones nuevas del backend que aún no estén en el diccionario se muestran tal cual.
    return action in AUDIT_ACTIONS ? this.i18n.t(`action.${action}`) : action;
  }

  userLabel(log: AuditLogResponse): string {
    if (log.userFullName) return log.userFullName;
    return (
      this.users.find((u) => u.userId === log.userId)?.fullName ??
      this.i18n.t('audit.userFallback', { id: log.userId })
    );
  }

  userEmail(log: AuditLogResponse): string {
    return log.userEmail ?? this.users.find((u) => u.userId === log.userId)?.email ?? '';
  }

  /** HU-121: GET /api/audit-logs/usuario/{userId} en un diálogo propio. */
  showActivity(userId: number, force = false) {
    if (this.busy || (this.loading && !force)) return;
    this.selected = null;
    this.activity = { userId, logs: null };
    this.run(this.api.byUser(userId), 'busy', (logs) => {
      if (this.activity?.userId === userId) this.activity = { userId, logs };
    });
  }

  userName(userId: number): string {
    return (
      this.users.find((u) => u.userId === userId)?.fullName ??
      this.i18n.t('audit.userFallback', { id: userId })
    );
  }

  override close(): void {
    if (this.busy) return;
    super.close();
    this.activity = null;
  }

  showDetail(log: AuditLogResponse) {
    if (this.busy || this.loading) return;
    this.run(this.api.get(log.logId), 'busy', (fresh) => (this.selected = fresh));
  }

  /** Exporta la página visible a CSV (UTF-8 con BOM para que Excel respete las tildes). */
  exportCsv() {
    if (!this.result.content.length) return;
    const header = [
      'logId',
      'fecha',
      'userId',
      'usuario',
      'correo',
      'accion',
      'entidad',
      'entityId',
      'detalles',
    ];
    const rows = this.result.content.map((log) => [
      log.logId,
      log.createdAt,
      log.userId,
      this.userLabel(log),
      this.userEmail(log),
      log.action,
      log.entityType,
      log.entityId ?? '',
      log.details ?? '',
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `auditoria-pagina-${this.result.number + 1}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url));
  }

  @HostListener('document:keydown.escape') dismiss() {
    this.close();
  }

  private fetch(page: number) {
    /** HU-131: la paginación respeta el modo de la última consulta. */
    const source = this.appliedAdvanced
      ? this.api.advancedSearch(this.applied, page)
      : this.api.search(this.applied, page);
    this.run(source, 'loading', (result) => (this.result = result));
  }
}

/** Escapa comillas y neutraliza fórmulas (=, +, -, @) para que Excel no las ejecute. */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
