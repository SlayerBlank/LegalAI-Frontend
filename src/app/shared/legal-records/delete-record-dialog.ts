import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { I18N_PIPES } from '../i18n/i18n.pipes';

@Component({
  imports: [MatButtonModule, MatDialogModule, ...I18N_PIPES],
  template: `
    <h2 mat-dialog-title>{{ 'records.deleteTitle' | t: { name: name } }}</h2>
    <mat-dialog-content>{{ 'records.deleteText' | t }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="false" cdkFocusInitial>
        {{ 'common.cancel' | t }}
      </button>
      <button mat-flat-button type="button" [mat-dialog-close]="true">
        {{ 'common.delete' | t }}
      </button>
    </mat-dialog-actions>
  `,
})
export class DeleteRecordDialog {
  protected readonly name = inject<string>(MAT_DIALOG_DATA);
}
