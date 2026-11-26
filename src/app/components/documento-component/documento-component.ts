import { ChangeDetectorRef, Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import {
  CaseResponse,
  DOCUMENT_CATEGORY_MAX,
  DOCUMENT_FILE_NAME_MAX,
  DOCUMENT_MAX_FILE_BYTES,
  DocumentPreparationResponse,
  DocumentResponse,
  PreparationStage,
  PreparationTone,
  ProcessingStatus,
  preparationTone,
} from '../../models/documento';
import { DocumentoService } from '../../services/documento-service';
import { DocumentChunkService } from '../../services/document-chunk-service';
import {
  SEARCH_TOP_K_DEFAULT,
  SEARCH_TOP_K_OPTIONS,
  SemanticSearchResult,
  relevanceScore,
} from '../../models/semantic-search';
import { ManagementHttpState, managementError } from '../../shared/management-http-state';
import { ManagementDialogDirective } from '../../shared/management-dialog.directive';
import { I18N_PIPES } from '../../shared/i18n/i18n.pipes';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-documento',
  standalone: true,
  imports: [FormsModule, ManagementDialogDirective, ...I18N_PIPES],
  templateUrl: './documento-component.html',
  styleUrls: [
    '../../shared/management.css',
    '../../shared/modern-module.css',
    './documento-component.css',
  ],
})
export class DocumentoComponent extends ManagementHttpState<DocumentResponse> implements OnInit {
  private readonly api = inject(DocumentoService);
  private readonly chunksApi = inject(DocumentChunkService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  readonly i18n = inject(I18nService);

  readonly categoryMax = DOCUMENT_CATEGORY_MAX;
  cases: CaseResponse[] = [];
  caseId: number | null = null;
  documents: DocumentResponse[] = [];

  uploadOpen = false;
  uploadFile: File | null = null;
  uploadCategory = '';
  uploadError = '';
  /** HU-94 (TA-04): porcentaje enviado del archivo; null cuando no hay subida en curso. */
  uploadProgress: number | null = null;
  /** HU-97 (CA-03): documento que se está descargando, para que el botón lo indique. */
  downloadingId: number | null = null;

  preparation: DocumentPreparationResponse | null = null;
  text: string | null = null;
  /** HU-101: búsqueda semántica dentro del documento abierto. */
  readonly topKOptions = SEARCH_TOP_K_OPTIONS;
  searchQuery = '';
  searchTopK = SEARCH_TOP_K_DEFAULT;
  searchResults: SemanticSearchResult[] | null = null;
  searchError = '';
  searching = false;

  /** HU-128: documento que se abre al llegar desde una fuente del chat (?documentId=). */
  private openOnLoad: number | null = null;

  ngOnInit() {
    const query = this.route.snapshot.queryParamMap;
    const requested = Number(query.get('caseId'));
    const documentId = Number(query.get('documentId'));
    this.openOnLoad = Number.isInteger(documentId) && documentId > 0 ? documentId : null;
    this.load(Number.isInteger(requested) && requested > 0 ? requested : null);
  }

  /** Carga los expedientes propios y los documentos del expediente elegido en una sola petición encadenada. */
  load(preferredCaseId: number | null = this.caseId) {
    if (this.loading || this.busy) return;
    this.documents = [];
    this.resetPage();
    const source = this.api.listCases().pipe(
      switchMap((cases) => {
        const id = cases.some((c) => c.caseId === preferredCaseId)
          ? preferredCaseId
          : (cases[0]?.caseId ?? null);
        return id === null
          ? of({ cases, id, docs: [] as DocumentResponse[] })
          : this.api.list(id).pipe(map((docs) => ({ cases, id, docs })));
      }),
    );
    this.run(source, 'loading', ({ cases, id, docs }) => {
      this.cases = cases;
      this.caseId = id;
      this.documents = docs;
      const target = docs.find((d) => d.documentId === this.openOnLoad);
      this.openOnLoad = null;
      if (target) setTimeout(() => this.showDetail(target));
    });
  }

  selectCase(id: number | null) {
    if (id === null || this.loading || this.busy) return;
    this.caseId = id;
    this.documents = [];
    this.resetPage();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { caseId: id },
      replaceUrl: true,
    });
    this.run(this.api.list(id), 'loading', (docs) => (this.documents = docs));
  }

  get currentCase(): CaseResponse | undefined {
    return this.cases.find((c) => c.caseId === this.caseId);
  }

  get filtered(): DocumentResponse[] {
    const q = this.query.trim().toLocaleLowerCase();
    return this.documents.filter(
      (d) =>
        (!this.filter || d.processingStatus === this.filter) &&
        `${d.fileName} ${d.category ?? ''}`.toLocaleLowerCase().includes(q),
    );
  }

  count(...statuses: ProcessingStatus[]): number {
    return this.documents.filter((d) => statuses.includes(d.processingStatus)).length;
  }

  statusLabel(status: ProcessingStatus): string {
    return this.i18n.t(`status.${status}`);
  }

  stageLabel(stage: PreparationStage): string {
    return this.i18n.t(`stage.${stage}`);
  }

  /** HU-124: color de la etapa (verde listo, ámbar en curso o pendiente, rojo con error). */
  stageTone(stage: PreparationStage): PreparationTone {
    return preparationTone(stage);
  }

  /** HU-124: explicación de por qué el documento no está listo, o '' si lo está. */
  stageReason(stage: PreparationStage): string {
    return stage === 'READY' ? '' : this.i18n.t(`stageReason.${stage}`);
  }

  formatSize(bytes: number | null): string {
    return this.i18n.formatBytes(bytes);
  }

  // ---- Subida -------------------------------------------------------------

  openUpload() {
    if (this.loading || this.busy || this.caseId === null) return;
    this.error = '';
    this.uploadFile = null;
    this.uploadCategory = '';
    this.uploadError = '';
    this.dragging = false;
    this.uploadOpen = true;
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.pickFile(input.files?.[0] ?? null);
  }

  // ---- Arrastrar y soltar --------------------------------------------------

  dragging = false;

  onDragOver(event: DragEvent) {
    event.preventDefault();
    if (!this.busy) this.dragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.dragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragging = false;
    if (this.busy) return;
    this.pickFile(event.dataTransfer?.files?.[0] ?? null);
  }

  private pickFile(file: File | null) {
    this.uploadFile = file;
    this.uploadError = file ? this.validateFile(file) : '';
  }

  /** Mismas reglas que DocumentoServiceImplement.validateUpload; el servidor decide al final. */
  validateFile(file: File): string {
    if (file.size === 0) return this.i18n.t('docs.errEmpty');
    if (file.size > DOCUMENT_MAX_FILE_BYTES)
      return this.i18n.t('docs.errTooLarge', { max: this.formatSize(DOCUMENT_MAX_FILE_BYTES) });
    if (!file.name.toLowerCase().endsWith('.pdf') || file.type !== 'application/pdf')
      return this.i18n.t('docs.errNotPdf');
    if (file.name.length > DOCUMENT_FILE_NAME_MAX || /[<>:"/\\|?*\u0000-\u001f]/.test(file.name))
      return this.i18n.t('docs.errName');
    return '';
  }

  upload() {
    if (!this.uploadFile || this.caseId === null || this.busy) return;
    this.uploadError = this.validateFile(this.uploadFile);
    if (this.uploadError) return;
    const caseId = this.caseId;
    const category = this.uploadCategory.trim() || null;
    this.uploadProgress = 0;
    const onProgress = (percent: number) => {
      this.uploadProgress = percent;
      this.cdr.markForCheck();
    };
    const source = this.api.upload(caseId, this.uploadFile, category, onProgress).pipe(
      finalize(() => (this.uploadProgress = null)),
      switchMap((doc) =>
        this.api.preparation(doc.documentId).pipe(
          map((prep) => ({ doc, prep: prep as DocumentPreparationResponse | null })),
          // El documento ya quedó guardado aunque falle la consulta del estado.
          catchError(() => of({ doc, prep: null })),
        ),
      ),
    );
    this.run(source, 'busy', ({ doc, prep }) => {
      if (this.caseId === caseId) this.documents = [doc, ...this.documents];
      this.uploadOpen = false;
      this.resetPage();
      this.notice = prep
        ? this.i18n.t('docs.uploadedNotice', { stage: this.stageLabel(prep.stage) })
        : this.i18n.t('docs.uploadedPlain');
    });
  }

  // ---- Detalle y preparación para la IA -------------------------------------

  showDetail(doc: DocumentResponse) {
    if (this.busy || this.loading) return;
    this.preparation = null;
    this.text = null;
    this.resetSearch();
    this.run(
      forkJoin({ doc: this.api.get(doc.documentId), prep: this.api.preparation(doc.documentId) }),
      'busy',
      ({ doc: fresh, prep }) => {
        this.selected = fresh;
        this.preparation = prep;
        this.replace(fresh);
      },
    );
  }

  /** HU-124: vuelve a consultar el estado mientras el documento se procesa. */
  refreshPreparation() {
    const doc = this.selected;
    if (!doc || this.busy) return;
    const id = doc.documentId;
    this.run(
      forkJoin({ fresh: this.api.get(id), prep: this.api.preparation(id) }),
      'busy',
      ({ fresh, prep }) => {
        this.selected = fresh;
        this.preparation = prep;
        this.replace(fresh);
      },
    );
  }

  /** Completa la preparación para la IA de un documento que aún no está listo. */
  prepare() {
    const doc = this.selected;
    if (!doc || this.busy) return;
    this.runPrepare(doc.documentId, 'docs.preparedNotice');
  }

  /** HU-125: el reintento solo se ofrece cuando el backend dejó el documento en ERROR. */
  canRetry(doc: DocumentResponse): boolean {
    return doc.processingStatus === 'ERROR';
  }

  /** HU-125: POST /prepare desde la tabla o el detalle; si vuelve a fallar se muestra el error. */
  retry(doc: DocumentResponse) {
    if (this.busy || this.loading || !this.canRetry(doc)) return;
    this.runPrepare(doc.documentId, 'docs.retriedNotice');
  }

  private runPrepare(id: number, noticeKey: string) {
    this.run(
      this.api
        .prepare(id)
        .pipe(switchMap((prep) => this.api.get(id).pipe(map((fresh) => ({ prep, fresh }))))),
      'busy',
      ({ prep, fresh }) => {
        if (this.selected?.documentId === id) {
          this.preparation = prep;
          this.selected = fresh;
          this.text = null;
        }
        this.replace(fresh);
        this.notice = this.i18n.t(noticeKey, { stage: this.stageLabel(prep.stage) });
      },
      // Una etapa puede fallar después de que otras se completaron: se refresca el estado sin ocultar el error.
      () => this.refreshQuietly(id),
    );
  }

  /**
   * HU-99: solo se procesan documentos recién subidos; reprocesar uno listo borraría sus
   * fragmentos. Un documento en ERROR se reintenta con la preparación (HU-125).
   */
  canProcess(doc: DocumentResponse): boolean {
    return doc.processingStatus === 'UPLOADED';
  }

  /** HU-99: POST /process y luego el estado de /preparation, sin recargar la lista. */
  process(doc: DocumentResponse) {
    if (this.busy || this.loading || !this.canProcess(doc)) return;
    const id = doc.documentId;
    const source = this.api.process(id).pipe(
      switchMap((fresh) =>
        this.api.preparation(id).pipe(
          map((prep) => ({ fresh, prep: prep as DocumentPreparationResponse | null })),
          catchError(() => of({ fresh, prep: null })),
        ),
      ),
    );
    this.run(
      source,
      'busy',
      ({ fresh, prep }) => {
        this.replace(fresh);
        if (this.selected?.documentId === id) {
          this.selected = fresh;
          this.preparation = prep;
          this.text = null;
        }
        this.notice = this.i18n.t('docs.processedNotice', {
          status: this.statusLabel(fresh.processingStatus),
        });
      },
      /** HU-99: si falla la extracción, se muestra el estado ERROR que deja el backend (HU-124). */
      () => this.refreshQuietly(id),
    );
  }

  /** HU-122: genera los fragmentos del documento abierto; sin texto extraído no llama a la API. */
  generateChunks() {
    const doc = this.selected;
    if (!doc || this.busy) return;
    if (!doc.hasExtractedText || doc.processingStatus !== 'PROCESSED') {
      this.notice = '';
      this.error = this.i18n.t('docs.chunksNeedText');
      return;
    }
    const id = doc.documentId;
    const source = this.chunksApi
      .regenerate(id)
      .pipe(
        switchMap((result) => this.api.preparation(id).pipe(map((prep) => ({ result, prep })))),
      );
    this.run(
      source,
      'busy',
      ({ result, prep }) => {
        if (this.selected?.documentId === id) this.preparation = prep;
        this.notice = this.i18n.t('docs.chunksNotice', { count: result.chunksCreated });
      },
      () => this.refreshQuietly(id),
    );
  }

  /** HU-126: genera (o regenera con force) los embeddings del documento abierto. */
  generateEmbeddings(force = false) {
    const doc = this.selected;
    if (!doc || this.busy) return;
    const id = doc.documentId;
    const source = this.api
      .generateEmbeddings(id, force)
      .pipe(
        switchMap((result) => this.api.preparation(id).pipe(map((prep) => ({ result, prep })))),
      );
    this.run(
      source,
      'busy',
      ({ result, prep }) => {
        this.preparation = prep;
        this.notice = this.i18n.t('docs.embeddingsNotice', {
          generated: result.embeddingsGenerated,
          chunks: result.chunksProcessed,
        });
      },
      () => this.refreshQuietly(id),
    );
  }

  /** HU-101: CA-02 sin texto no se llama a la API; CA-01 resultados por relevancia; CA-03 errores. */
  search() {
    const doc = this.selected;
    if (!doc || this.searching) return;
    const query = this.searchQuery.trim();
    if (!query) {
      this.searchResults = null;
      this.searchError = this.i18n.t('search.errEmpty');
      return;
    }
    const id = doc.documentId;
    this.searching = true;
    this.searchError = '';
    this.api
      .semanticSearch(id, query, this.searchTopK)
      .pipe(
        takeUntilDestroyed(this.destroy),
        finalize(() => {
          this.searching = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (rows) => {
          if (this.selected?.documentId === id) this.searchResults = rows;
        },
        error: (e: unknown) => {
          this.searchResults = null;
          this.searchError = managementError(e);
        },
      });
  }

  score(result: SemanticSearchResult): number {
    return relevanceScore(result.distance);
  }

  private resetSearch() {
    this.searchQuery = '';
    this.searchTopK = SEARCH_TOP_K_DEFAULT;
    this.searchResults = null;
    this.searchError = '';
  }

  loadText() {
    const doc = this.selected;
    if (!doc || this.busy) return;
    this.run(this.api.text(doc.documentId), 'busy', (value) => (this.text = value.text ?? ''));
  }

  download(doc: DocumentResponse) {
    if (this.busy) return;
    const id = doc.documentId;
    this.downloadingId = id;
    this.run(
      this.api.download(id).pipe(finalize(() => (this.downloadingId = null))),
      'busy',
      (blob) => saveBlob(blob, doc.fileName),
    );
  }

  /** HU-97 (CA-03): true mientras se descarga ese documento. */
  isDownloading(doc: DocumentResponse): boolean {
    return this.downloadingId === doc.documentId;
  }

  openChunks(doc: DocumentResponse) {
    if (this.busy) return;
    this.close();
    this.router.navigate(['/documentos', doc.documentId, 'fragmentos']);
  }

  // ---- Eliminación ---------------------------------------------------------

  confirmRemove(doc: DocumentResponse) {
    if (this.busy || this.loading) return;
    this.error = '';
    this.selected = null;
    this.pending = doc;
  }

  remove() {
    if (!this.pending || this.busy) return;
    const id = this.pending.documentId;
    this.run(this.api.remove(id), 'busy', () => {
      this.documents = this.documents.filter((d) => d.documentId !== id);
      this.pending = null;
      this.page = Math.min(this.page, this.pages(this.filtered));
      this.notice = this.i18n.t('docs.deletedNotice');
    });
  }

  override close(): void {
    if (this.busy) return;
    super.close();
    this.uploadOpen = false;
    this.preparation = null;
    this.text = null;
    this.resetSearch();
  }

  @HostListener('document:keydown.escape') dismiss() {
    this.close();
  }

  private replace(doc: DocumentResponse) {
    this.documents = this.documents.map((d) => (d.documentId === doc.documentId ? doc : d));
  }

  private refreshQuietly(id: number) {
    forkJoin({ doc: this.api.get(id), prep: this.api.preparation(id) })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: ({ doc, prep }) => {
          if (this.selected?.documentId === id) {
            this.selected = doc;
            this.preparation = prep;
          }
          this.replace(doc);
        },
        error: () => undefined,
      });
  }
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url));
}
