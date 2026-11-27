import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Subscription, finalize, map, of } from 'rxjs';
import { SummaryResponse } from '../../models/response/summary-response';
import {
  CaseOption,
  DocumentOption,
  LegalRecordSourceService,
} from '../../services/legal-record-source.service';
import { ResumenService } from '../../services/resumen-service';
import { DeleteRecordDialog } from '../../shared/legal-records/delete-record-dialog';
import { RecordFilter, RecordFilterValue } from '../../shared/legal-records/record-filter';
import { nonBlank, recordDateMatches, recordError } from '../../shared/legal-records/record-form';
import { RecordWorkspace } from '../../shared/legal-records/record-workspace';
import { I18N_PIPES } from '../../shared/i18n/i18n.pipes';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-resumen',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatProgressBarModule,
    RecordFilter,
    ...I18N_PIPES,
  ],
  templateUrl: './resumen-component.html',
  styleUrls: ['../../shared/legal-records/legal-records.css', './resumen-component.css'],
})
export class ResumenComponent {
  private readonly api = inject(ResumenService);
  private readonly source = inject(LegalRecordSourceService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly browserDocument = inject(DOCUMENT);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly i18n = inject(I18nService);
  private documentRequest?: Subscription;

  protected readonly workspace = new RecordWorkspace<SummaryResponse>(
    (summary) => summary.summaryId,
  );
  protected readonly cases = signal<CaseOption[]>([]);
  protected readonly documents = signal<DocumentOption[]>([]);
  protected readonly caseError = signal('');
  protected readonly documentError = signal('');
  protected readonly loadingDocuments = signal(false);
  protected readonly selected = signal<SummaryResponse | null>(null);
  protected readonly editing = signal(false);
  protected readonly types = computed(() => [
    ...new Set(this.workspace.allRecords().map((item) => item.summaryType)),
  ]);

  protected readonly form = this.fb.group(
    {
      caseId: this.fb.control<number | null>(null),
      documentId: this.fb.control<number | null>(null),
      summaryType: this.fb.control('', [nonBlank, Validators.maxLength(100)]),
      content: this.fb.control('', nonBlank),
    },
    {
      validators: (form) =>
        form.get('caseId')?.value || form.get('documentId')?.value
          ? null
          : { sourceRequired: true },
    },
  );

  constructor() {
    this.workspace.load(this.api.list());
    this.loadCases();
    this.form.controls.caseId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => {
        this.form.controls.documentId.setValue(null);
        this.loadDocuments(id);
      });
  }

  protected loadCases() {
    this.caseError.set('');
    this.source
      .cases()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cases) => this.cases.set(cases),
        error: (error: unknown) =>
          this.caseError.set(recordError(error, this.i18n.t('records.errCases'))),
      });
  }

  protected hasCase(id: number) {
    return this.cases().some((item) => item.caseId === id);
  }

  protected hasDocument(id: number) {
    return this.documents().some((item) => item.documentId === id);
  }

  protected sourceLabel(summary: SummaryResponse) {
    if (summary.caseId !== null) {
      return (
        this.cases().find((item) => item.caseId === summary.caseId)?.title ??
        this.i18n.t('records.caseFallback', { id: summary.caseId })
      );
    }
    return this.i18n.t('records.documentFallback', { id: summary.documentId ?? '' });
  }

  protected documentName(id: number) {
    return this.documents().find((item) => item.documentId === id)?.fileName ?? this.i18n.t('records.documentFallback', { id });
  }

  protected create() {
    if (this.canLeave()) this.show(null);
  }

  protected open(id: number) {
    if (!this.canLeave()) return;
    this.workspace.run(
      this.api.get(id),
      (summary) => this.show(summary),
      this.i18n.t('summaries.errOpen'),
    );
  }

  protected save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const { caseId, documentId, summaryType, content } = this.form.getRawValue();
    this.workspace.run(
      this.api.save(this.selected()?.summaryId ?? null, {
        caseId,
        documentId,
        summaryType: summaryType.trim(),
        content: content.trim(),
      }),
      (summary) => {
        this.show(summary);
        this.workspace.saved(summary, this.i18n.t('summaries.savedNotice'));
      },
      this.i18n.t('summaries.errSave'),
    );
  }

  protected remove(summary: SummaryResponse) {
    this.dialog
      .open(DeleteRecordDialog, { data: summary.summaryType })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.workspace.run(
          this.api.remove(summary.summaryId),
          () => {
            this.close();
            this.workspace.removed(summary.summaryId, this.i18n.t('summaries.deletedNotice'));
          },
          this.i18n.t('summaries.errDelete'),
        );
      });
  }

  protected download(id: number) {
    this.workspace.run(
      this.source.download(id),
      (blob) => {
        const url = URL.createObjectURL(blob);
        const link = this.browserDocument.createElement('a');
        link.href = url;
        link.download = this.documentName(id);
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      this.i18n.t('summaries.errDownload'),
    );
  }

  protected filter({ caseId, value, from, to }: RecordFilterValue) {
    if (caseId !== null && value && from && to) {
      this.workspace.filter(() => this.api.filter(caseId, value, from, to));
      return;
    }
    this.workspace.filter(() => {
      const type = value.toLocaleLowerCase();
      const candidates = this.workspace
        .allRecords()
        .filter(
          (summary) =>
            (!type || summary.summaryType.toLocaleLowerCase() === type) &&
            recordDateMatches(summary.createdAt, from, to),
        );

      if (caseId === null) {
        return of(new Set(candidates.map(({ summaryId }) => summaryId)));
      }

      const directMatches = candidates.filter((summary) => summary.caseId === caseId);
      const ids = new Set(directMatches.map(({ summaryId }) => summaryId));
      const linkedDocuments = candidates.filter(
        (summary): summary is SummaryResponse & { documentId: number } =>
          summary.caseId === null && summary.documentId !== null,
      );
      if (!linkedDocuments.length) return of(ids);

      return this.source.documents(caseId).pipe(
        map((documents) => {
          const caseDocuments = new Set(documents.map(({ documentId }) => documentId));
          for (const summary of linkedDocuments) {
            if (caseDocuments.has(summary.documentId)) ids.add(summary.summaryId);
          }
          return ids;
        }),
      );
    });
  }

  protected reload() {
    this.workspace.load(this.api.list());
  }

  protected reloadDocuments() {
    const { caseId, documentId } = this.form.getRawValue();
    this.loadDocuments(caseId, documentId);
  }

  protected cancel() {
    if (this.canLeave()) this.close();
  }

  private close() {
    this.documentRequest?.unsubscribe();
    this.selected.set(null);
    this.editing.set(false);
    this.form.reset(undefined, { emitEvent: false });
  }

  private show(summary: SummaryResponse | null) {
    this.workspace.feedback.set('');
    this.workspace.error.set('');
    this.selected.set(summary);
    this.form.reset(summary ?? undefined, { emitEvent: false });
    this.loadDocuments(summary?.caseId ?? null, summary?.documentId ?? null);
    this.editing.set(true);
  }

  private loadDocuments(caseId: number | null, selectedId: number | null = null) {
    this.documentRequest?.unsubscribe();
    this.documents.set([]);
    this.documentError.set('');

    const request =
      caseId !== null
        ? this.source.documents(caseId)
        : selectedId !== null
          ? this.source.document(selectedId).pipe(map((document) => [document]))
          : null;
    if (!request) return;

    this.loadingDocuments.set(true);
    this.documentRequest = request
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loadingDocuments.set(false)),
      )
      .subscribe({
        next: (documents) => this.documents.set(documents),
        error: (error: unknown) =>
          this.documentError.set(recordError(error, this.i18n.t('summaries.errDocuments'))),
      });
  }

  private canLeave() {
    return !this.form.dirty || window.confirm(this.i18n.t('records.discard'));
  }
}
