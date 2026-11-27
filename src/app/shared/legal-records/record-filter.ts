import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { CaseOption } from '../../services/legal-record-source.service';
import { I18N_PIPES } from '../i18n/i18n.pipes';
import { I18nService } from '../../services/i18n.service';

export interface RecordFilterValue {
  caseId: number | null;
  value: string;
  from: string;
  to: string;
}

@Component({
  selector: 'app-record-filter',
  imports: [FormsModule, MatButtonModule, ...I18N_PIPES],
  styleUrl: './legal-records.css',
  template: `
    <details class="filters">
      <summary>{{ heading() }}</summary>
      <form class="filter-fields" (ngSubmit)="apply()">
        <fieldset [disabled]="disabled()">
          <label
            >{{ 'records.case' | t }}
            <select name="case" [(ngModel)]="caseId" [disabled]="!cases().length">
              <option [ngValue]="null">
                {{ (cases().length ? 'records.allCases' : 'records.noCases') | t }}
              </option>
              @for (item of cases(); track item.caseId) {
                <option [ngValue]="item.caseId">{{ item.title }}</option>
              }
            </select>
          </label>
          <label
            >{{ label() }}
            <input name="value" [(ngModel)]="value" [attr.list]="suggestionId()" />
            <datalist [id]="suggestionId()">
              @for (option of options(); track option) {
                <option [value]="option"></option>
              }
            </datalist>
          </label>
          <label>{{ 'records.from' | t }} <input type="date" name="from" [(ngModel)]="from" /></label>
          <label>{{ 'records.to' | t }} <input type="date" name="to" [(ngModel)]="to" /></label>
          <div class="actions">
            <button mat-flat-button [disabled]="disabled()" type="submit">
              {{ 'records.apply' | t }}
            </button>
            <button mat-button [disabled]="disabled()" type="button" (click)="reset()">
              {{ 'records.clear' | t }}
            </button>
          </div>
        </fieldset>
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
      </form>
    </details>
  `,
})
export class RecordFilter {
  readonly cases = input.required<CaseOption[]>();
  readonly heading = input.required<string>();
  readonly label = input.required<string>();
  readonly suggestionId = input.required<string>();
  readonly options = input<string[]>([]);
  readonly disabled = input(false);
  readonly applied = output<RecordFilterValue>();
  readonly cleared = output<void>();

  protected caseId: number | null = null;
  protected value = '';
  protected from = '';
  protected to = '';
  protected readonly error = signal('');
  private readonly i18n = inject(I18nService);

  protected apply() {
    if (this.from && this.to && this.from > this.to) {
      this.error.set(this.i18n.t('records.errRange'));
      return;
    }
    this.error.set('');
    if (this.caseId === null && !this.value.trim() && !this.from && !this.to) {
      this.cleared.emit();
      return;
    }
    this.applied.emit({
      caseId: this.caseId,
      value: this.value.trim(),
      from: this.from,
      to: this.to,
    });
  }

  protected reset() {
    this.caseId = null;
    this.value = this.from = this.to = '';
    this.error.set('');
    this.cleared.emit();
  }
}
