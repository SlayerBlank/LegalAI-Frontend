import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, finalize } from 'rxjs';
import {
  CHAT_MESSAGE_MAX,
  CHAT_PAGE_SIZE_MAX,
  CHAT_TITLE_MAX,
  ChatCreateSessionRequest,
  ChatMessage,
  ChatSession,
} from '../../models/chat-ia';
import { CaseResponse } from '../../models/expediente';
import { DocumentResponse } from '../../models/documento';
import { ChatIaService } from '../../services/chat-ia-service';
import { DocumentoService } from '../../services/documento-service';
import { ExpedienteService } from '../../services/expediente-service';
import { I18nService } from '../../services/i18n.service';
import { I18N_PIPES } from '../../shared/i18n/i18n.pipes';
import { ManagementDialogDirective } from '../../shared/management-dialog.directive';
import { managementError } from '../../shared/management-http-state';
import { nonBlank } from '../../shared/legal-records/record-form';

/** Turno que falló: se reenvía con el mismo clientMessageId para que el backend no lo duplique. */
interface PendingTurn {
  content: string;
  clientMessageId: string;
}

function newClientMessageId(): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `web-${random}`;
}

@Component({
  selector: 'app-chat-ia',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ManagementDialogDirective, ...I18N_PIPES],
  templateUrl: './chat-ia-component.html',
  styleUrls: [
    '../../shared/management.css',
    '../../shared/modern-module.css',
    './chat-ia-component.css',
  ],
})
export class ChatIaComponent implements OnInit {
  private readonly api = inject(ChatIaService);
  private readonly casesApi = inject(ExpedienteService);
  private readonly documentsApi = inject(DocumentoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder).nonNullable;
  readonly i18n = inject(I18nService);

  readonly titleMax = CHAT_TITLE_MAX;
  readonly messageMax = CHAT_MESSAGE_MAX;
  readonly pageSize = CHAT_PAGE_SIZE_MAX;

  private readonly log = viewChild<ElementRef<HTMLElement>>('log');

  // Expedientes (filtro y alta de sesiones)
  readonly cases = signal<CaseResponse[]>([]);
  readonly casesError = signal('');
  readonly caseFilter = signal<number | null>(null);

  // Sesiones
  readonly sessions = signal<ChatSession[]>([]);
  readonly sessionsPage = signal(0);
  readonly hasMoreSessions = signal(false);
  readonly loadingSessions = signal(false);
  readonly sessionsLoaded = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');

  // Conversación activa
  readonly activeId = signal<number | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly historyPage = signal(0);
  readonly loadingHistory = signal(false);
  readonly sending = signal(false);
  readonly chatError = signal('');
  readonly pendingTurn = signal<PendingTurn | null>(null);

  // Diálogos
  readonly creating = signal(false);
  readonly renaming = signal<ChatSession | null>(null);
  readonly deleting = signal<ChatSession | null>(null);
  readonly documents = signal<DocumentResponse[]>([]);
  readonly documentsError = signal('');

  readonly composer = this.fb.control('', [nonBlank, Validators.maxLength(CHAT_MESSAGE_MAX)]);
  readonly createForm = this.fb.group({
    caseId: this.fb.control<number | null>(null, Validators.required),
    documentId: this.fb.control<number | null>(null),
    title: this.fb.control('', Validators.maxLength(CHAT_TITLE_MAX)),
  });
  readonly renameForm = this.fb.group({
    title: this.fb.control('', [nonBlank, Validators.maxLength(CHAT_TITLE_MAX)]),
  });

  readonly composerLength = signal(0);

  readonly active = computed(
    () => this.sessions().find((s) => s.sessionId === this.activeId()) ?? null,
  );
  /** La sesión estaba acotada a un documento que ya no existe: el backend responde 404 al enviar. */
  readonly scopeMissing = computed(() => {
    const s = this.active();
    return !!s && s.documentScopeRequired && s.documentId === null;
  });
  readonly hasOlder = computed(() => this.historyPage() > 0);
  readonly caseTitles = computed(() => new Map(this.cases().map((c) => [c.caseId, c.title])));

  constructor() {
    this.composer.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => this.composerLength.set(v.length));
    this.createForm.controls.caseId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => this.loadDocuments(id));
  }

  ngOnInit() {
    const requested = Number(this.route.snapshot.queryParamMap.get('caseId'));
    this.caseFilter.set(Number.isInteger(requested) && requested > 0 ? requested : null);
    this.loadCases();
    this.loadSessions();
  }

  // ---- Expedientes y sesiones ----------------------------------------------

  loadCases() {
    this.casesError.set('');
    this.casesApi
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => this.cases.set(rows),
        error: (e: unknown) => this.casesError.set(managementError(e)),
      });
  }

  loadSessions(append = false) {
    if (this.loadingSessions() || this.busy()) return;
    const page = append ? this.sessionsPage() + 1 : 0;
    this.loadingSessions.set(true);
    if (!append) this.sessionsLoaded.set(false);
    this.error.set('');
    this.api
      .listSessions(this.caseFilter(), { page, size: this.pageSize })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loadingSessions.set(false)),
      )
      .subscribe({
        next: (rows) => {
          this.sessions.update((current) => (append ? mergeSessions(current, rows) : rows));
          this.sessionsPage.set(page);
          this.hasMoreSessions.set(rows.length === this.pageSize);
          this.sessionsLoaded.set(true);
          if (!append && !rows.some((s) => s.sessionId === this.activeId())) this.clearActive();
        },
        error: (e: unknown) => this.error.set(managementError(e)),
      });
  }

  /** HU-130: el selector de expediente filtra las sesiones con GET /api/chat/sessions?caseId= */
  setCaseFilter(value: string) {
    if (this.loadingSessions() || this.busy()) return;
    const id = value ? Number(value) : null;
    this.caseFilter.set(id);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { caseId: id },
      replaceUrl: true,
    });
    this.loadSessions();
  }

  caseTitle(id: number): string {
    return this.caseTitles().get(id) ?? this.i18n.t('chat.caseFallback', { id });
  }

  sessionTitle(s: ChatSession): string {
    return s.title?.trim() || this.i18n.t('chat.untitled');
  }

  // ---- Conversación ----------------------------------------------------------

  /** HU-127: abre la conversación con su historial ordenado (USER e IA diferenciados). */
  select(session: ChatSession) {
    if (this.sending() || this.loadingHistory() || session.sessionId === this.activeId()) return;
    this.activeId.set(session.sessionId);
    this.messages.set([]);
    this.chatError.set('');
    this.pendingTurn.set(null);
    this.composer.reset('');
    // El historial es cronológico: se abre la última página para ver lo más reciente.
    const last = Math.max(0, Math.ceil(session.messageCount / this.pageSize) - 1);
    this.loadHistory(session.sessionId, last, false);
  }

  /** HU-127: carga la página anterior del historial y la antepone sin duplicar mensajes. */
  loadOlder() {
    const id = this.activeId();
    if (id === null || !this.hasOlder() || this.loadingHistory()) return;
    this.loadHistory(id, this.historyPage() - 1, true);
  }

  private loadHistory(sessionId: number, page: number, prepend: boolean) {
    this.loadingHistory.set(true);
    this.chatError.set('');
    this.api
      .history(sessionId, { page, size: this.pageSize })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loadingHistory.set(false)),
      )
      .subscribe({
        next: (rows) => {
          if (this.activeId() !== sessionId) return;
          this.messages.update((current) =>
            prepend ? mergeMessages(rows, current) : mergeMessages(current, rows),
          );
          this.historyPage.set(page);
          if (!prepend) this.scrollToEnd();
        },
        error: (e: unknown) => this.chatError.set(managementError(e)),
      });
  }

  onComposerKey(event: Event) {
    const key = event as KeyboardEvent;
    if (key.shiftKey || key.isComposing) return;
    key.preventDefault();
    this.send();
  }

  send() {
    const session = this.active();
    this.composer.markAsTouched();
    if (!session || this.sending() || this.scopeMissing() || this.composer.invalid) return;
    const content = this.composer.value.trim();
    const previous = this.pendingTurn();
    const turn: PendingTurn =
      previous && previous.content === content
        ? previous
        : { content, clientMessageId: newClientMessageId() };
    const sessionId = session.sessionId;
    this.sending.set(true);
    this.chatError.set('');
    this.notice.set('');
    this.api
      .send(sessionId, { content: turn.content, clientMessageId: turn.clientMessageId })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.sending.set(false)),
      )
      .subscribe({
        next: (res) => {
          this.pendingTurn.set(null);
          if (this.activeId() === sessionId) {
            const before = this.messages().length;
            this.messages.update((current) =>
              mergeMessages(current, [res.userMessage, res.assistantMessage]),
            );
            const added = this.messages().length - before;
            this.composer.reset('');
            this.touchSession(sessionId, added);
            this.scrollToEnd();
          }
        },
        error: (e: unknown) => {
          this.pendingTurn.set(turn);
          this.chatError.set(managementError(e));
        },
      });
  }

  /** HU-128: fragmentos (documento y fragmento) usados por una respuesta de la IA. */
  sourcesOf(m: ChatMessage) {
    return m.sources ?? [];
  }

  /** HU-128: enlace al documento de una fuente; abre su detalle en Documentos. */
  documentLink(documentId: number) {
    const caseId = this.active()?.caseId;
    return caseId === undefined ? { documentId } : { caseId, documentId };
  }

  // ---- Alta, renombrado y eliminación ----------------------------------------

  openCreate() {
    if (this.busy() || this.sending()) return;
    this.error.set('');
    this.documents.set([]);
    this.documentsError.set('');
    this.createForm.reset({ caseId: this.caseFilter(), documentId: null, title: '' });
    this.creating.set(true);
  }

  private loadDocuments(caseId: number | null) {
    this.documents.set([]);
    this.documentsError.set('');
    this.createForm.controls.documentId.setValue(null, { emitEvent: false });
    if (caseId === null) return;
    this.documentsApi
      .list(caseId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          if (this.createForm.controls.caseId.value === caseId) this.documents.set(rows);
        },
        error: (e: unknown) => this.documentsError.set(managementError(e)),
      });
  }

  create() {
    this.createForm.markAllAsTouched();
    if (this.createForm.invalid || this.busy()) return;
    const { caseId, documentId, title } = this.createForm.getRawValue();
    // documentId y title se omiten si están vacíos: el backend rechaza null y campos desconocidos.
    const body: ChatCreateSessionRequest = { caseId: caseId as number };
    if (documentId !== null) body.documentId = documentId;
    if (title.trim()) body.title = title.trim();
    this.run(this.api.createSession(body), (session) => {
      this.creating.set(false);
      if (this.caseFilter() === null || this.caseFilter() === session.caseId) {
        this.sessions.update((rows) => [session, ...rows]);
      }
      this.activeId.set(session.sessionId);
      this.messages.set([]);
      this.historyPage.set(0);
      this.pendingTurn.set(null);
      this.chatError.set('');
      this.composer.reset('');
      this.notice.set(this.i18n.t('chat.createdNotice'));
    });
  }

  openRename(session: ChatSession) {
    if (this.busy() || this.sending()) return;
    this.error.set('');
    this.renameForm.reset({ title: session.title ?? '' });
    this.renaming.set(session);
  }

  rename() {
    const session = this.renaming();
    this.renameForm.markAllAsTouched();
    if (!session || this.renameForm.invalid || this.busy()) return;
    const title = this.renameForm.controls.title.value.trim();
    this.run(this.api.renameSession(session.sessionId, { title }), (updated) => {
      this.sessions.update((rows) =>
        rows.map((s) => (s.sessionId === updated.sessionId ? updated : s)),
      );
      this.renaming.set(null);
      this.notice.set(this.i18n.t('chat.renamedNotice'));
    });
  }

  confirmDelete(session: ChatSession) {
    if (this.busy() || this.sending()) return;
    this.error.set('');
    this.deleting.set(session);
  }

  remove() {
    const session = this.deleting();
    if (!session || this.busy()) return;
    this.run(this.api.deleteSession(session.sessionId), () => {
      this.sessions.update((rows) => rows.filter((s) => s.sessionId !== session.sessionId));
      if (this.activeId() === session.sessionId) this.clearActive();
      this.deleting.set(null);
      this.notice.set(this.i18n.t('chat.deletedNotice'));
    });
  }

  close() {
    if (this.busy()) return;
    this.creating.set(false);
    this.renaming.set(null);
    this.deleting.set(null);
  }

  @HostListener('document:keydown.escape') dismiss() {
    this.close();
  }

  // ---- Internos ----------------------------------------------------------------

  private clearActive() {
    this.activeId.set(null);
    this.messages.set([]);
    this.historyPage.set(0);
    this.pendingTurn.set(null);
    this.chatError.set('');
  }

  /** Refleja el turno nuevo en la lista: contador y orden por actividad reciente. */
  private touchSession(sessionId: number, added: number) {
    this.sessions.update((rows) => {
      const current = rows.find((s) => s.sessionId === sessionId);
      if (!current) return rows;
      const updated: ChatSession = {
        ...current,
        messageCount: current.messageCount + added,
        updatedAt: new Date().toISOString(),
      };
      return [updated, ...rows.filter((s) => s.sessionId !== sessionId)];
    });
  }

  private scrollToEnd() {
    setTimeout(() => {
      const el = this.log()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  private run<R>(source: Observable<R>, success: (value: R) => void) {
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    source
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: success,
        error: (e: unknown) => this.error.set(managementError(e)),
      });
  }
}

function mergeMessages(first: ChatMessage[], second: ChatMessage[]): ChatMessage[] {
  const seen = new Set(first.map((m) => m.messageId));
  return [...first, ...second.filter((m) => !seen.has(m.messageId))];
}

function mergeSessions(first: ChatSession[], second: ChatSession[]): ChatSession[] {
  const seen = new Set(first.map((s) => s.sessionId));
  return [...first, ...second.filter((s) => !seen.has(s.sessionId))];
}
