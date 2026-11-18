import { Component, HostListener, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, map, switchMap } from 'rxjs';
import {
  ChunkGenerationResponse,
  DocumentChunkResponse,
  DocumentPreparationResponse,
  DocumentResponse,
} from '../../models/documento';
import { DocumentChunkService } from '../../services/document-chunk-service';
import { DocumentoService } from '../../services/documento-service';
import { ManagementHttpState } from '../../shared/management-http-state';
import { ManagementDialogDirective } from '../../shared/management-dialog.directive';
import { I18N_PIPES } from '../../shared/i18n/i18n.pipes';
import { I18nService } from '../../services/i18n.service';

export interface TextPart {
  text: string;
  match: boolean;
}

const PREVIEW_CHARS = 280;

@Component({
  selector: 'app-documento-chunk',
  standalone: true,
  imports: [FormsModule, RouterLink, ManagementDialogDirective, ...I18N_PIPES],
  templateUrl: './documento-chunk-component.html',
  styleUrls: ['../../shared/management.css', './documento-chunk-component.css'],
})
export class DocumentoChunkComponent
  extends ManagementHttpState<DocumentChunkResponse>
  implements OnInit
{
  private readonly route = inject(ActivatedRoute);
  private readonly documents = inject(DocumentoService);
  private readonly api = inject(DocumentChunkService);
  readonly i18n = inject(I18nService);

  documentId: number | null = null;
  document: DocumentResponse | null = null;
  preparation: DocumentPreparationResponse | null = null;
  chunks: DocumentChunkResponse[] = [];
  expanded = new Set<number>();
  confirmRegenerate = false;
  lastGeneration: ChunkGenerationResponse | null = null;

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('documentId'));
    this.documentId = Number.isInteger(id) && id > 0 ? id : null;
    if (this.documentId === null) {
      this.error = this.i18n.t('chunks.invalidId');
      return;
    }
    this.load();
  }

  load() {
    const id = this.documentId;
    if (id === null || this.loading || this.busy) return;
    this.chunks = [];
    this.expanded.clear();
    this.resetPage();
    this.run(
      forkJoin({
        doc: this.documents.get(id),
        chunks: this.api.list(id),
        prep: this.documents.preparation(id),
      }),
      'loading',
      ({ doc, chunks, prep }) => {
        this.document = doc;
        this.chunks = chunks;
        this.preparation = prep;
      },
    );
  }

  get filtered(): DocumentChunkResponse[] {
    const q = this.query.trim().toLocaleLowerCase();
    if (!q) return this.chunks;
    return this.chunks.filter((c) => c.content.toLocaleLowerCase().includes(q));
  }

  get averageLength(): number {
    if (!this.chunks.length) return 0;
    const total = this.chunks.reduce((sum, c) => sum + c.content.length, 0);
    return Math.round(total / this.chunks.length);
  }

  get canRegenerate(): boolean {
    return (
      !!this.document &&
      this.document.processingStatus === 'PROCESSED' &&
      this.document.hasExtractedText
    );
  }

  isLong(chunk: DocumentChunkResponse): boolean {
    return chunk.content.length > PREVIEW_CHARS;
  }

  toggle(chunk: DocumentChunkResponse) {
    if (this.expanded.has(chunk.chunkId)) this.expanded.delete(chunk.chunkId);
    else this.expanded.add(chunk.chunkId);
  }

  /** Texto visible del fragmento: completo si está expandido o si hay búsqueda activa. */
  visibleText(chunk: DocumentChunkResponse): string {
    if (this.expanded.has(chunk.chunkId) || this.query.trim() || !this.isLong(chunk)) {
      return chunk.content;
    }
    return `${chunk.content.slice(0, PREVIEW_CHARS).trimEnd()}…`;
  }

  /** Divide el texto para resaltar la búsqueda sin usar innerHTML. */
  highlight(text: string): TextPart[] {
    const q = this.query.trim();
    if (!q) return [{ text, match: false }];
    const lower = text.toLocaleLowerCase();
    const needle = q.toLocaleLowerCase();
    const parts: TextPart[] = [];
    let from = 0;
    let at = lower.indexOf(needle, from);
    while (at !== -1) {
      if (at > from) parts.push({ text: text.slice(from, at), match: false });
      parts.push({ text: text.slice(at, at + needle.length), match: true });
      from = at + needle.length;
      at = lower.indexOf(needle, from);
    }
    if (from < text.length) parts.push({ text: text.slice(from), match: false });
    return parts;
  }

  askRegenerate() {
    if (!this.canRegenerate || this.busy || this.loading) return;
    this.error = '';
    this.confirmRegenerate = true;
  }

  regenerate() {
    const id = this.documentId;
    if (id === null || this.busy) return;
    this.run(
      this.api
        .regenerate(id)
        .pipe(
          switchMap((generation) =>
            forkJoin({ chunks: this.api.list(id), prep: this.documents.preparation(id) }).pipe(
              map((fresh) => ({ generation, ...fresh })),
            ),
          ),
        ),
      'busy',
      ({ generation, chunks, prep }) => {
        this.lastGeneration = generation;
        this.chunks = chunks;
        this.preparation = prep;
        this.expanded.clear();
        this.resetPage();
        this.confirmRegenerate = false;
        this.notice = this.i18n.t('chunks.generatedNotice', {
          count: generation.chunksCreated,
          size: generation.chunkSize,
          overlap: generation.overlap,
        });
      },
    );
  }

  override close(): void {
    if (this.busy) return;
    super.close();
    this.confirmRegenerate = false;
  }

  @HostListener('document:keydown.escape') dismiss() {
    this.close();
  }
}
