import type { ReportChartType } from './report-chart/report-chart';

/** Entrada del índice de Reportes: ruta hija, HU, textos y tipo de gráfico. */
export interface ReportEntry {
  slug: string;
  hu: string;
  titleKey: string;
  descriptionKey: string;
  chart: ReportChartType;
  /** Solo visible y accesible para ADMIN (además protegido por adminGuard). */
  adminOnly?: boolean;
}

/** Sprint 4: HU-134 a HU-143. El orden es el del índice. */
export const REPORTS: readonly ReportEntry[] = [
  { slug: 'sesiones-por-expediente', hu: 'HU-134', titleKey: 'reports.r134.title', descriptionKey: 'reports.r134.card', chart: 'bar' },
  { slug: 'documentos-por-cliente', hu: 'HU-135', titleKey: 'reports.r135.title', descriptionKey: 'reports.r135.card', chart: 'bar' },
  { slug: 'expedientes-abiertos-por-abogado', hu: 'HU-136', titleKey: 'reports.r136.title', descriptionKey: 'reports.r136.card', chart: 'bar' },
  { slug: 'borradores-por-estado', hu: 'HU-137', titleKey: 'reports.r137.title', descriptionKey: 'reports.r137.card', chart: 'doughnut' },
  { slug: 'resumenes-por-tipo', hu: 'HU-138', titleKey: 'reports.r138.title', descriptionKey: 'reports.r138.card', chart: 'bar' },
  { slug: 'expedientes-por-estado', hu: 'HU-139', titleKey: 'reports.r139.title', descriptionKey: 'reports.r139.card', chart: 'bar' },
  { slug: 'documentos-pendientes', hu: 'HU-140', titleKey: 'reports.r140.title', descriptionKey: 'reports.r140.card', chart: 'doughnut' },
  { slug: 'expedientes-de-cliente', hu: 'HU-141', titleKey: 'reports.r141.title', descriptionKey: 'reports.r141.card', chart: 'doughnut' },
  { slug: 'actividad-chat', hu: 'HU-142', titleKey: 'reports.r142.title', descriptionKey: 'reports.r142.card', chart: 'line' },
  { slug: 'auditoria-por-accion', hu: 'HU-143', titleKey: 'reports.r143.title', descriptionKey: 'reports.r143.card', chart: 'bar', adminOnly: true },
];
