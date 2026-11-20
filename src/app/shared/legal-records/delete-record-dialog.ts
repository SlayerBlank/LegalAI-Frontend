import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

@Component({
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>¿Eliminar {{ name }}?</h2>
    <mat-dialog-content>Se borrará el registro del expediente.</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="false" cdkFocusInitial>Cancelar</button>
      <button mat-flat-button type="button" [mat-dialog-close]="true">Eliminar</button>
    </mat-dialog-actions>
  `,
})
export class DeleteRecordDialog {
  protected readonly name = inject<string>(MAT_DIALOG_DATA);
}
