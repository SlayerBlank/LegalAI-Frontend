import { Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import {
  CaseResponse,
  DOCUMENT_CATEGORY_MAX,
  DOCUMENT_FILE_NAME_MAX,
  DOCUMENT_MAX_FILE_BYTES,
  DocumentPreparationResponse,
  DocumentResponse,
  PreparationStage,
  ProcessingStatus,
} from '../../models/documento';
import { DocumentoService } from '../../services/documento-service';
import { ManagementHttpState } from '../../shared/management-http-state';
import { ManagementDialogDirective } from '../../shared/management-dialog.directive';
import { I18N_PIPES } from '../../shared/i18n/i18n.pipes';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-documento',
  standalone: true,
  imports: [FormsModule, ManagementDialogDirective, ...I18N_PIPES],
  templateUrl: './documento-component.html',
  styleUrls: ['../../shared/management.css', './documento-component.css'],
})
export class DocumentoComponent extends ManagementHttpState<DocumentResponse> implements OnInit {
  private readonly api = inject(DocumentoService);
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

  preparation: DocumentPreparationResponse | null = null;
  text: string | null = null;

  ngOnInit() {
    const requested = Number(this.route.snapshot.queryParamMap.get('caseId'));
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
    this.uploadOpen = true;
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.uploadFile = input.files?.[0] ?? null;
    this.uploadError = this.uploadFile ? this.validateFile(this.uploadFile) : '';
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
    const source = this.api.upload(caseId, this.uploadFile, category).pipe(
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

  prepare() {
    const doc = this.selected;
    if (!doc || this.busy) return;
    const id = doc.documentId;
    this.run(
      this.api
        .prepare(id)
        .pipe(switchMap((prep) => this.api.get(id).pipe(map((fresh) => ({ prep, fresh }))))),
      'busy',
      ({ prep, fresh }) => {
        this.preparation = prep;
        this.selected = fresh;
        this.replace(fresh);
        this.notice = this.i18n.t('docs.preparedNotice', { stage: this.stageLabel(prep.stage) });
      },
      // Una etapa puede fallar después de que otras se completaron: se refresca el estado sin ocultar el error.
      () => this.refreshQuietly(id),
    );
  }

  loadText() {
    const doc = this.selected;
    if (!doc || this.busy) return;
    this.run(this.api.text(doc.documentId), 'busy', (value) => (this.text = value.text ?? ''));
  }

  download(doc: DocumentResponse) {
    if (this.busy) return;
    this.run(this.api.download(doc.documentId), 'busy', (blob) => saveBlob(blob, doc.fileName));
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
