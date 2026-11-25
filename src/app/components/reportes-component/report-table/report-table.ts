import { Component, computed, input } from '@angular/core';
import { I18N_PIPES } from '../../../shared/i18n/i18n.pipes';
import { ReportRow, totalOf } from '../report-state';

/** Tabla accesible con los datos del gráfico: etiqueta, cantidad, porcentaje y total. */
@Component({
  selector: 'app-report-table',
  standalone: true,
  imports: [...I18N_PIPES],
  templateUrl: './report-table.html',
  styleUrls: ['../report-common.css', './report-table.css'],
})
export class ReportTableComponent {
  readonly rows = input.required<readonly ReportRow[]>();
  readonly caption = input.required<string>();
  readonly labelHeader = input.required<string>();
  readonly countHeader = input.required<string>();
  /** Muestra el color de cada fila; útil cuando el gráfico usa un color por categoría. */
  readonly swatches = input(false);

  readonly total = computed(() => totalOf(this.rows()));

  share(count: number): number {
    const total = this.total();
    return total ? (count / total) * 100 : 0;
  }

  swatch(index: number): string {
    return `var(--chart-${(index % 8) + 1})`;
  }
}
