import { Component, Signal, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnyTranslationKey } from '../../../services/i18n.service';
import { I18N_PIPES } from '../../../shared/i18n/i18n.pipes';
import { ReportStatus } from '../report-state';

/** Lo que el marco necesita de la consulta de un reporte. */
export interface ReportView {
  status: Signal<ReportStatus>;
  error: Signal<string>;
  empty: Signal<boolean>;
  retry(): void;
}

/**
 * Marco común de cada reporte: volver al índice, título, filtros proyectados y los estados
 * de carga, vacío y error con reintento. El gráfico y la tabla van en el contenido.
 */
@Component({
  selector: 'app-report-shell',
  standalone: true,
  imports: [RouterLink, ...I18N_PIPES],
  templateUrl: './report-shell.html',
  styleUrl: './report-shell.css',
})
export class ReportShellComponent {
  readonly hu = input.required<string>();
  readonly titleKey = input.required<AnyTranslationKey>();
  readonly descriptionKey = input.required<AnyTranslationKey>();
  readonly emptyKey = input<AnyTranslationKey>('reports.empty');
  readonly idleKey = input<AnyTranslationKey>('reports.idle');
  readonly query = input.required<ReportView>();
}
