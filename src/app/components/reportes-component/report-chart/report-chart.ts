import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  ChartConfiguration,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { BaseChartDirective, provideCharts } from 'ng2-charts';
import { I18nService } from '../../../services/i18n.service';
import { ThemeService } from '../../../services/theme-service';
import { ReportRow } from '../report-state';

export type ReportChartType = 'bar' | 'doughnut' | 'line';

/** Valores de respaldo si los tokens CSS aún no están disponibles (p. ej. en pruebas). */
const FALLBACK: Record<string, string> = {
  '--text': '#20242C',
  '--muted': '#6B7280',
  '--border': '#E5E7EB',
  '--surface': '#FFFFFF',
  '--chart-1': '#2563EB',
  '--chart-2': '#D97706',
  '--chart-3': '#059669',
  '--chart-4': '#DC2626',
  '--chart-5': '#7C3AED',
  '--chart-6': '#0E7490',
  '--chart-7': '#BE185D',
  '--chart-8': '#4D7C0F',
};
const SERIES = 8;
const SUMMARY_LIMIT = 15;

/**
 * Envoltorio de ng2-charts para los reportes. Solo registra las piezas de Chart.js que usa,
 * toma los colores de los tokens del tema y se vuelve a pintar al cambiar tema o idioma.
 */
@Component({
  selector: 'app-report-chart',
  standalone: true,
  imports: [BaseChartDirective],
  providers: [
    provideCharts({
      registerables: [
        BarController,
        BarElement,
        CategoryScale,
        LinearScale,
        DoughnutController,
        ArcElement,
        LineController,
        LineElement,
        PointElement,
        Filler,
        Tooltip,
        Legend,
      ],
    }),
  ],
  templateUrl: './report-chart.html',
  styleUrl: './report-chart.css',
})
export class ReportChartComponent {
  private readonly document = inject(DOCUMENT);
  private readonly theme = inject(ThemeService);
  private readonly i18n = inject(I18nService);

  readonly type = input<ReportChartType>('bar');
  readonly rows = input.required<readonly ReportRow[]>();
  /** Nombre de la serie (p. ej. "Sesiones"); aparece en el tooltip. */
  readonly seriesLabel = input.required<string>();
  /** Título del gráfico para lectores de pantalla. */
  readonly label = input.required<string>();
  /** Barras horizontales: mejor cuando las etiquetas son títulos largos. */
  readonly horizontal = input(false);

  readonly height = computed(() =>
    this.type() === 'bar' && this.horizontal()
      ? Math.max(220, this.rows().length * 34 + 48)
      : this.type() === 'doughnut'
        ? 320
        : 300,
  );

  /** Resumen textual del gráfico: el canvas no transmite los datos por sí mismo. */
  readonly summary = computed(() => {
    const rows = this.rows();
    const shown = rows
      .slice(0, SUMMARY_LIMIT)
      .map((row) => `${row.label}: ${this.i18n.formatNumber(row.count)}`)
      .join('; ');
    const rest = rows.length - SUMMARY_LIMIT;
    const more = rest > 0 ? ` ${this.i18n.t('reports.chartMore', { count: rest })}` : '';
    return `${this.label()}. ${shown}.${more}`;
  });

  readonly config = computed<ChartConfiguration>(() => {
    this.theme.theme();
    const color = (name: string) => this.token(name);
    const type = this.type();
    const rows = this.rows();
    const palette = Array.from({ length: SERIES }, (_, i) => color(`--chart-${i + 1}`));
    const grid = { color: color('--border') };
    const ticks = { color: color('--muted'), precision: 0 };
    const horizontal = type === 'bar' && this.horizontal();
    const reduceMotion =
      this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ??
      false;

    const dataset =
      type === 'doughnut'
        ? {
            label: this.seriesLabel(),
            data: rows.map((r) => r.count),
            backgroundColor: rows.map((_, i) => palette[i % SERIES]),
            borderColor: color('--surface'),
            borderWidth: 2,
          }
        : type === 'line'
          ? {
              label: this.seriesLabel(),
              data: rows.map((r) => r.count),
              borderColor: palette[0],
              backgroundColor: `${palette[0]}33`,
              pointBackgroundColor: palette[0],
              pointRadius: 3,
              fill: true,
              tension: 0.25,
            }
          : {
              label: this.seriesLabel(),
              data: rows.map((r) => r.count),
              backgroundColor: palette[0],
              borderRadius: 4,
              maxBarThickness: 36,
            };

    return {
      type,
      data: { labels: rows.map((r) => r.label), datasets: [dataset] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        locale: this.i18n.locale(),
        animation: reduceMotion ? false : undefined,
        indexAxis: horizontal ? 'y' : 'x',
        plugins: {
          legend: {
            display: type === 'doughnut',
            position: 'bottom',
            labels: { color: color('--text'), boxWidth: 12, padding: 14 },
          },
          tooltip: { enabled: true },
        },
        scales:
          type === 'doughnut'
            ? {}
            : {
                x: { grid, ticks, beginAtZero: true },
                y: { grid, ticks, beginAtZero: true },
              },
      },
    } as ChartConfiguration;
  });

  private token(name: string): string {
    const view = this.document.defaultView;
    const value = view?.getComputedStyle(this.document.documentElement).getPropertyValue(name);
    return value?.trim() || FALLBACK[name];
  }
}
