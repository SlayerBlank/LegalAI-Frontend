import { ChangeDetectorRef, Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ChatMessageDTO,
  ChatSessionResponseDTO,
  CitacionIAResponseDTO,
} from '../../models/management';
import { CitacionesIaService, CitedFragment } from '../../services/citaciones-ia-service';
import { ManagementHttpState, managementError } from '../../shared/management-http-state';
import { ManagementDialogDirective } from '../../shared/management-dialog.directive';
import { I18N_PIPES } from '../../shared/i18n/i18n.pipes';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-citaciones-ia',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ManagementDialogDirective, ...I18N_PIPES],
  templateUrl: './citaciones-ia-component.html',
  styleUrls: [
    '../../shared/management.css',
    '../../shared/modern-module.css',
    './citaciones-ia-component.css',
  ],
})
export class CitacionesIaComponent
  extends ManagementHttpState<CitacionIAResponseDTO>
  implements OnInit
{
  private readonly api = inject(CitacionesIaService);
  private readonly destroy = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly i18n = inject(I18nService);

  sessions: ChatSessionResponseDTO[] = [];
  messages: ChatMessageDTO[] = [];
  citations: CitacionIAResponseDTO[] = [];
  selectedSessionId = '';
  selectedMessageId = '';

  /** HU-129: cita abierta en el diálogo y el fragmento resuelto. */
  inspecting: CitacionIAResponseDTO | null = null;
  fragment: CitedFragment | null = null;
  fragmentLoading = false;
  fragmentError = '';

  ngOnInit(): void {
    this.loadSessions();
  }

  get selectedSession(): ChatSessionResponseDTO | null {
    return (
      this.sessions.find((session) => session.sessionId === Number(this.selectedSessionId)) ?? null
    );
  }

  get selectedMessage(): ChatMessageDTO | null {
    return this.messages.find((item) => item.messageId === Number(this.selectedMessageId)) ?? null;
  }

  get linkedDocumentCount(): number {
    return new Set(
      this.citations
        .map((citation) => citation.documentId)
        .filter((documentId): documentId is number => documentId !== null),
    ).size;
  }

  get retainedCount(): number {
    return this.citations.filter((citation) => citation.documentId === null).length;
  }

  get filtered(): CitacionIAResponseDTO[] {
    const query = this.query.trim().toLocaleLowerCase();
    return this.citations.filter((citation) => {
      const matchesDocument =
        this.filter === 'linked'
          ? citation.documentId !== null
          : this.filter === 'retained'
            ? citation.documentId === null
            : true;
      const searchable = [
        citation.citationId,
        citation.messageId,
        citation.documentId ?? 'documento-retendido',
        citation.chunkId ?? '',
        citation.relevanceScore ?? '',
      ]
        .join(' ')
        .toLocaleLowerCase();
      return matchesDocument && searchable.includes(query);
    });
  }

  /** HU-129: abre la cita y consulta el documento y su fragmento. */
  inspect(citation: CitacionIAResponseDTO): void {
    this.inspecting = citation;
    this.fragment = null;
    this.fragmentError = '';
    this.fragmentLoading = true;
    this.api
      .citedFragment(citation)
      .pipe(
        takeUntilDestroyed(this.destroy),
        finalize(() => {
          this.fragmentLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (result) => {
          if (this.inspecting === citation) this.fragment = result;
        },
        error: (e: unknown) => (this.fragmentError = managementError(e)),
      });
  }

  closeFragment(): void {
    this.inspecting = null;
    this.fragment = null;
    this.fragmentError = '';
  }

  @HostListener('document:keydown.escape') dismiss(): void {
    this.closeFragment();
  }

  loadSessions(): void {
    this.citations = [];
    this.messages = [];
    this.run(this.api.listSessions(), 'loading', (sessions) => {
      this.sessions = sessions;
      this.selectedSessionId = sessions.length ? String(sessions[0].sessionId) : '';
      if (this.selectedSessionId) this.loadMessages();
    });
  }

  onSessionChange(): void {
    this.query = '';
    this.filter = '';
    this.selectedMessageId = '';
    this.citations = [];
    this.resetPage();
    this.loadMessages();
  }

  onMessageChange(): void {
    this.query = '';
    this.filter = '';
    this.resetPage();
    this.loadCitations();
  }

  loadMessages(): void {
    const sessionId = Number(this.selectedSessionId);
    this.messages = [];
    this.citations = [];
    this.selectedMessageId = '';
    if (!Number.isSafeInteger(sessionId) || sessionId <= 0) return;

    this.run(this.api.listMessages(sessionId), 'busy', (messages) => {
      this.messages = messages.filter((item) => item.role === 'ASSISTANT');
      this.selectedMessageId = this.messages.length ? String(this.messages[0].messageId) : '';
      if (this.selectedMessageId) this.loadCitations();
    });
  }

  loadCitations(): void {
    const sessionId = Number(this.selectedSessionId);
    const messageId = Number(this.selectedMessageId);
    if (
      !Number.isSafeInteger(sessionId) ||
      sessionId <= 0 ||
      !Number.isSafeInteger(messageId) ||
      messageId <= 0
    ) {
      this.citations = [];
      this.error = this.i18n.t('cites.errSelect');
      return;
    }

    this.resetPage();
    this.run(this.api.listByMessage(sessionId, messageId), 'loading', (citations) => {
      this.citations = citations;
    });
  }
}
