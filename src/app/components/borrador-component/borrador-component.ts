import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { of } from 'rxjs';
import { DraftResponse } from '../../models/response/draft-response';
import { BorradorService } from '../../services/borrador-service';
import { CaseOption, LegalRecordSourceService } from '../../services/legal-record-source.service';
import { DeleteRecordDialog } from '../../shared/legal-records/delete-record-dialog';
import { RecordFilter, RecordFilterValue } from '../../shared/legal-records/record-filter';
import { nonBlank, recordDateMatches, recordError } from '../../shared/legal-records/record-form';
import { RecordWorkspace } from '../../shared/legal-records/record-workspace';

@Component({
  selector: 'app-borrador',
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatProgressBarModule,
    RecordFilter,
  ],
  templateUrl: './borrador-component.html',
  styleUrls: ['../../shared/legal-records/legal-records.css', './borrador-component.css'],
})
export class BorradorComponent {
  private readonly api = inject(BorradorService);
  private readonly source = inject(LegalRecordSourceService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly workspace = new RecordWorkspace<DraftResponse>((draft) => draft.draftId);
  protected readonly cases = signal<CaseOption[]>([]);
  protected readonly caseError = signal('');
  protected readonly selected = signal<DraftResponse | null>(null);
  protected readonly editing = signal(false);
  protected readonly search = signal('');
  protected readonly statuses = computed(() => [
    ...new Set([
      'Borrador',
      'En revisión',
      'Revisado',
      ...this.workspace.allRecords().map(({ status }) => status),
    ]),
  ]);

  protected readonly form = this.fb.group({
    caseId: this.fb.control<number | null>(null, Validators.required),
    title: this.fb.control('', [nonBlank, Validators.maxLength(255)]),
    status: this.fb.control('Borrador', [nonBlank, Validators.maxLength(50)]),
    prompt: '',
    content: this.fb.control('', nonBlank),
  });

  protected readonly visible = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    return this.workspace
      .records()
      .filter((draft) =>
        `${draft.title} ${this.caseTitle(draft.caseId)} ${draft.caseId}`
          .toLocaleLowerCase()
          .includes(query),
      );
  });

  constructor() {
    this.workspace.load(this.api.list());
    this.loadCases();
  }

  protected loadCases() {
    this.caseError.set('');
    this.source
      .cases()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cases) => this.cases.set(cases),
        error: (error: unknown) =>
          this.caseError.set(recordError(error, 'No se pudieron cargar los expedientes.')),
      });
  }

  protected hasCase(id: number) {
    return this.cases().some((item) => item.caseId === id);
  }

  protected caseTitle(id: number) {
    return this.cases().find((item) => item.caseId === id)?.title ?? `Expediente #${id}`;
  }

  protected open(id: number) {
    if (!this.canLeave()) return;
    this.workspace.run(
      this.api.get(id),
      (draft) => this.show(draft),
      'No se pudo abrir el borrador.',
    );
  }

  protected create() {
    if (this.canLeave()) this.show(null);
  }

  protected save(reviewed = false) {
    this.form.markAllAsTouched();
    const { caseId, title, content, prompt, status } = this.form.getRawValue();
    if (this.form.invalid || caseId === null) return;

    this.workspace.run(
      this.api.save(this.selected()?.draftId ?? null, {
        caseId,
        title: title.trim(),
        content: content.trim(),
        prompt: prompt.trim() || null,
        status: reviewed ? 'Revisado' : status.trim(),
      }),
      (draft) => {
        this.show(draft);
        this.workspace.saved(
          draft,
          reviewed ? 'Borrador marcado como revisado.' : 'Borrador guardado.',
        );
      },
      'No se pudo guardar el borrador.',
    );
  }

  protected remove(draft: DraftResponse) {
    this.dialog
      .open(DeleteRecordDialog, { data: draft.title })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.workspace.run(
          this.api.remove(draft.draftId),
          () => {
            this.close();
            this.workspace.removed(draft.draftId, 'Borrador eliminado.');
          },
          'No se pudo eliminar el borrador.',
        );
      });
  }

  protected filter({ caseId, value, from, to }: RecordFilterValue) {
    if (caseId !== null && value && from && to) {
      this.workspace.filter(() => this.api.filter(caseId, value, from, to));
      return;
    }
    this.workspace.filter(() => {
      const status = value.toLocaleLowerCase();
      const matches = this.workspace
        .allRecords()
        .filter(
          (draft) =>
            (caseId === null || draft.caseId === caseId) &&
            (!status || draft.status.toLocaleLowerCase() === status) &&
            recordDateMatches(draft.updatedAt, from, to),
        );
      return of(new Set(matches.map(({ draftId }) => draftId)));
    });
  }

  protected reload() {
    this.workspace.load(this.api.list());
  }

  protected cancel() {
    if (this.canLeave()) this.close();
  }

  private close() {
    this.selected.set(null);
    this.editing.set(false);
    this.form.reset();
  }

  private show(draft: DraftResponse | null) {
    this.workspace.feedback.set('');
    this.workspace.error.set('');
    this.selected.set(draft);
    this.form.reset(draft ? { ...draft, prompt: draft.prompt ?? '' } : undefined);
    this.editing.set(true);
  }

  private canLeave() {
    return !this.form.dirty || window.confirm('¿Descartar los cambios sin guardar?');
  }
}
