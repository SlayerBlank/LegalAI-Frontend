import { Component, HostListener, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  imports: [FormsModule, DatePipe, ManagementDialogDirective],
  templateUrl: './auditoria-component.html',
  styleUrls: ['../../shared/management.css', './auditoria-component.css'],
})
export class AuditoriaComponent extends ManagementHttpState<AuditLogResponse> implements OnInit {
  private readonly api = inject(AuditoriaService);
  private readonly usersApi = inject(UsuarioService);

  readonly actions = Object.keys(AUDIT_ACTIONS);
  readonly entityTypes = AUDIT_ENTITY_TYPES;
  /** Filtros del formulario (borrador) y filtros con los que se hizo la última consulta. */
  form: AuditLogFilters = { ...EMPTY_FILTERS };
  applied: AuditLogFilters = { ...EMPTY_FILTERS };
  formError = '';

  result: PageResult<AuditLogResponse> = {
    content: [],
    number: 0,
    size: AUDIT_PAGE_SIZE,
    totalElements: 0,
    totalPages: 0,
  };
  users: UserResponse[] = [];
  usersAvailable = true;

  ngOnInit() {
    this.load();
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
    this.formError = this.validate(this.form);
    if (this.formError) return;
    this.applied = { ...this.form, action: this.form.action.trim().toUpperCase() };
    this.fetch(0);
  }

  clear() {
    if (this.loading || this.busy) return;
    this.form = { ...EMPTY_FILTERS };
    this.formError = '';
    this.applied = { ...EMPTY_FILTERS };
    this.fetch(0);
  }

  goTo(page: number) {
    if (page < 0 || page >= this.result.totalPages || page === this.result.number) return;
    this.fetch(page);
  }

  /** Atajo desde el detalle: todos los registros del mismo usuario. */
  filterByUser(userId: number) {
    if (this.busy) return;
    this.close();
    this.form = { ...EMPTY_FILTERS, userId };
    this.search();
  }

  validate(filters: AuditLogFilters): string {
    if (filters.from && filters.to && filters.from > filters.to)
      return 'La fecha “desde” no puede ser posterior a la fecha “hasta”.';
    if (filters.action.length > 80 || filters.entityType.length > 80)
      return 'La acción y la entidad no deben superar los 80 caracteres.';
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
    return AUDIT_ACTIONS[action] ?? action;
  }

  userLabel(log: AuditLogResponse): string {
    if (log.userFullName) return log.userFullName;
    return this.users.find((u) => u.userId === log.userId)?.fullName ?? `Usuario #${log.userId}`;
  }

  userEmail(log: AuditLogResponse): string {
    return log.userEmail ?? this.users.find((u) => u.userId === log.userId)?.email ?? '';
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
    this.run(this.api.search(this.applied, page), 'loading', (result) => (this.result = result));
  }
}

/** Escapa comillas y neutraliza fórmulas (=, +, -, @) para que Excel no las ejecute. */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
