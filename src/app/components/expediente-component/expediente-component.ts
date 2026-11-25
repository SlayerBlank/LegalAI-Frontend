import { Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, finalize } from 'rxjs';
import {
  CASE_STATUSES,
  CASE_TITLE_MAX,
  CLOSED_CASE_STATUSES,
  CaseFilters,
  CaseRequest,
  CaseResponse,
  CaseStatus,
} from '../../models/expediente';
import { ClientResponse } from '../../models/management';
import { ClienteService } from '../../services/cliente-service';
import { ExpedienteService } from '../../services/expediente-service';
import { I18nService } from '../../services/i18n.service';
import { I18N_PIPES } from '../../shared/i18n/i18n.pipes';
import { ManagementDialogDirective } from '../../shared/management-dialog.directive';
import { managementError } from '../../shared/management-http-state';
import { nonBlank } from '../../shared/legal-records/record-form';

/** Fecha de cierre válida respecto de la apertura (misma regla que applyRequest del backend). */
function closedAfterOpened(group: AbstractControl): ValidationErrors | null {
  const opened = group.get('openedAt')?.value as string;
  const closed = group.get('closedAt');
  if (!closed || closed.disabled || !opened || !closed.value) return null;
  return closed.value < opened ? { closedBeforeOpened: true } : null;
}

function rangeInOrder(group: AbstractControl): ValidationErrors | null {
  const from = group.get('openedFrom')?.value as string;
  const to = group.get('openedTo')?.value as string;
  return from && to && from > to ? { range: true } : null;
}

@Component({
  selector: 'app-expediente',
  standalone: true,
  imports: [ReactiveFormsModule, ManagementDialogDirective, ...I18N_PIPES],
  templateUrl: './expediente-component.html',
  styleUrls: [
    '../../shared/management.css',
    '../../shared/modern-module.css',
    './expediente-component.css',
  ],
})
export class ExpedienteComponent implements OnInit {
  private readonly api = inject(ExpedienteService);
  private readonly clientsApi = inject(ClienteService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder).nonNullable;
  readonly i18n = inject(I18nService);

  readonly statuses = CASE_STATUSES;
  readonly titleMax = CASE_TITLE_MAX;
  readonly pageSize = 8;

  readonly cases = signal<CaseResponse[]>([]);
  readonly clients = signal<ClientResponse[]>([]);
  readonly clientsError = signal('');
  /** null = conteo no disponible (no se asume cero). */
  readonly sessionCounts = signal<Map<number, number> | null>(null);

  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');

  readonly query = signal('');
  readonly clientFilter = signal<number | null>(null);
  readonly page = signal(1);
  readonly activeFilters = signal<CaseFilters>({});

  readonly editing = signal<CaseResponse | 'new' | null>(null);
  readonly selected = signal<CaseResponse | null>(null);
  readonly pending = signal<CaseResponse | null>(null);

  readonly filterForm = this.fb.group(
    {
      status: this.fb.control<CaseStatus | ''>(''),
      openedFrom: '',
      openedTo: '',
    },
    { validators: rangeInOrder },
  );

  readonly form = this.fb.group(
    {
      clientId: this.fb.control<number | null>(null, Validators.required),
      title: this.fb.control('', [nonBlank, Validators.maxLength(CASE_TITLE_MAX)]),
      description: '',
      status: this.fb.control<CaseStatus>('OPEN', Validators.required),
      openedAt: '',
      closedAt: this.fb.control({ value: '', disabled: true }),
    },
    { validators: closedAfterOpened },
  );

  readonly clientNames = computed(
    () => new Map(this.clients().map((c) => [c.clientId, c.fullNameOrCompany])),
  );

  readonly filtered = computed(() => {
    const q = this.query().trim().toLocaleLowerCase();
    const client = this.clientFilter();
    return this.cases().filter(
      (c) =>
        (client === null || c.clientId === client) &&
        `${c.title} ${c.description ?? ''} ${this.clientName(c.clientId)}`
          .toLocaleLowerCase()
          .includes(q),
    );
  });
  readonly pages = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize)));
  readonly rows = computed(() => {
    const start = (Math.min(this.page(), this.pages()) - 1) * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  });
  readonly hasServerFilters = computed(() => {
    const f = this.activeFilters();
    return !!(f.status || f.openedFrom || f.openedTo);
  });

  constructor() {
    this.form.controls.status.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status) => this.syncClosedAt(status));
  }

  ngOnInit() {
    this.load();
    this.loadClients();
    this.loadSessionCounts();
  }

  // ---- Carga ---------------------------------------------------------------

  load() {
    if (this.loading() || this.busy()) return;
    this.run(this.api.list(this.activeFilters()), 'loading', (rows) => {
      this.cases.set(rows);
      this.page.set(1);
    });
  }

  loadClients() {
    this.clientsError.set('');
    this.clientsApi
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => this.clients.set(rows),
        error: (e: unknown) => this.clientsError.set(managementError(e)),
      });
  }

  private loadSessionCounts() {
    this.api
      .sessionCounts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) =>
          this.sessionCounts.set(new Map(rows.map((r) => [r.caseId, r.cantidadSesiones]))),
        error: () => this.sessionCounts.set(null),
      });
  }

  applyFilters() {
    this.filterForm.markAllAsTouched();
    if (this.filterForm.invalid || this.loading() || this.busy()) return;
    const { status, openedFrom, openedTo } = this.filterForm.getRawValue();
    this.activeFilters.set({
      status: status || null,
      openedFrom: openedFrom || null,
      openedTo: openedTo || null,
    });
    this.load();
  }

  clearFilters() {
    if (this.loading() || this.busy()) return;
    this.filterForm.reset();
    const hadFilters = this.hasServerFilters();
    this.activeFilters.set({});
    if (hadFilters) this.load();
  }

  setQuery(value: string) {
    this.query.set(value);
    this.page.set(1);
  }

  setClientFilter(value: string) {
    this.clientFilter.set(value ? Number(value) : null);
    this.page.set(1);
  }

  // ---- Presentación --------------------------------------------------------

  clientName(id: number): string {
    return this.clientNames().get(id) ?? this.i18n.t('cases.clientFallback', { id });
  }

  sessionsOf(id: number): string {
    const counts = this.sessionCounts();
    if (!counts) return this.i18n.t('common.none');
    return this.i18n.formatNumber(counts.get(id) ?? 0);
  }

  count(...statuses: CaseStatus[]): number {
    return this.cases().filter((c) => statuses.includes(c.status)).length;
  }

  statusLabel(status: CaseStatus): string {
    return this.i18n.t(`caseStatus.${status}`);
  }

  /** LocalDate (yyyy-MM-dd) sin desplazamiento por zona horaria. */
  day(value: string | null): string {
    if (!value) return this.i18n.t('common.none');
    const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(this.i18n.locale(), {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  }

  get closedEnabled(): boolean {
    return CLOSED_CASE_STATUSES.includes(this.form.controls.status.value);
  }

  // ---- Formulario ----------------------------------------------------------

  openForm(item?: CaseResponse) {
    if (this.busy() || this.loading()) return;
    this.error.set('');
    this.selected.set(null);
    if (!item) {
      this.form.reset({
        clientId: this.clientFilter(),
        title: '',
        description: '',
        status: 'OPEN',
        openedAt: '',
        closedAt: '',
      });
      this.syncClosedAt('OPEN');
      this.editing.set('new');
      return;
    }
    this.run(this.api.get(item.caseId), 'busy', (fresh) => {
      this.form.reset({
        clientId: fresh.clientId,
        title: fresh.title,
        description: fresh.description ?? '',
        status: fresh.status,
        openedAt: fresh.openedAt ?? '',
        closedAt: fresh.closedAt ?? '',
      });
      this.syncClosedAt(fresh.status);
      this.replace(fresh);
      this.editing.set(fresh);
    });
  }

  hasClient(id: number | null): boolean {
    return id === null || this.clients().some((c) => c.clientId === id);
  }

  save() {
    const target = this.editing();
    this.form.markAllAsTouched();
    if (!target || this.form.invalid || this.busy()) return;
    const v = this.form.getRawValue();
    const request: CaseRequest = {
      clientId: v.clientId as number,
      title: v.title.trim(),
      description: v.description.trim() || null,
      status: v.status,
      openedAt: v.openedAt || null,
      closedAt: CLOSED_CASE_STATUSES.includes(v.status) ? v.closedAt || null : null,
    };
    const source =
      target === 'new' ? this.api.create(request) : this.api.update(target.caseId, request);
    this.run(source, 'busy', (saved) => {
      if (target === 'new') {
        this.cases.update((rows) => [saved, ...rows]);
        this.page.set(1);
      } else {
        this.replace(saved);
      }
      this.editing.set(null);
      this.notice.set(this.i18n.t('cases.savedNotice'));
    });
  }

  // ---- Detalle -------------------------------------------------------------

  showDetail(item: CaseResponse) {
    if (this.busy() || this.loading()) return;
    this.run(this.api.get(item.caseId), 'busy', (fresh) => {
      this.replace(fresh);
      this.selected.set(fresh);
    });
  }

  openDocuments(item: CaseResponse) {
    this.close();
    this.router.navigate(['/documentos'], { queryParams: { caseId: item.caseId } });
  }

  openChat(item: CaseResponse) {
    this.close();
    this.router.navigate(['/chat-ia'], { queryParams: { caseId: item.caseId } });
  }

  // ---- Eliminación ---------------------------------------------------------

  confirmRemove(item: CaseResponse) {
    if (this.busy() || this.loading()) return;
    this.error.set('');
    this.selected.set(null);
    this.pending.set(item);
  }

  remove() {
    const item = this.pending();
    if (!item || this.busy()) return;
    this.run(this.api.remove(item.caseId), 'busy', () => {
      this.cases.update((rows) => rows.filter((c) => c.caseId !== item.caseId));
      this.page.update((p) => Math.min(p, this.pages()));
      this.pending.set(null);
      this.notice.set(this.i18n.t('cases.deletedNotice'));
    });
  }

  close() {
    if (this.busy()) return;
    this.editing.set(null);
    this.selected.set(null);
    this.pending.set(null);
  }

  @HostListener('document:keydown.escape') dismiss() {
    this.close();
  }

  // ---- Internos ------------------------------------------------------------

  private syncClosedAt(status: CaseStatus) {
    const control = this.form.controls.closedAt;
    if (CLOSED_CASE_STATUSES.includes(status)) control.enable({ emitEvent: false });
    else {
      control.setValue('', { emitEvent: false });
      control.disable({ emitEvent: false });
    }
    this.form.updateValueAndValidity({ emitEvent: false });
  }

  private replace(item: CaseResponse) {
    this.cases.update((rows) => rows.map((c) => (c.caseId === item.caseId ? item : c)));
  }

  private run<R>(
    source: Observable<R>,
    kind: 'loading' | 'busy',
    success: (value: R) => void,
  ): void {
    const flag = kind === 'loading' ? this.loading : this.busy;
    flag.set(true);
    if (kind === 'loading') this.loaded.set(false);
    this.error.set('');
    this.notice.set('');
    source
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => flag.set(false)),
      )
      .subscribe({
        next: (value) => {
          if (kind === 'loading') this.loaded.set(true);
          success(value);
        },
        error: (e: unknown) => this.error.set(managementError(e)),
      });
  }
}
