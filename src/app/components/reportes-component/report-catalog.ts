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

/** Sprint 4: HU-124 a HU-133. El orden es el del índice. */
export const REPORTS: readonly ReportEntry[] = [
  { slug: 'sesiones-por-expediente', hu: 'HU-124', titleKey: 'reports.r124.title', descriptionKey: 'reports.r124.card', chart: 'bar' },
  { slug: 'documentos-por-cliente', hu: 'HU-125', titleKey: 'reports.r125.title', descriptionKey: 'reports.r125.card', chart: 'bar' },
  { slug: 'expedientes-abiertos-por-abogado', hu: 'HU-126', titleKey: 'reports.r126.title', descriptionKey: 'reports.r126.card', chart: 'bar' },
  { slug: 'borradores-por-estado', hu: 'HU-127', titleKey: 'reports.r127.title', descriptionKey: 'reports.r127.card', chart: 'doughnut' },
  { slug: 'resumenes-por-tipo', hu: 'HU-128', titleKey: 'reports.r128.title', descriptionKey: 'reports.r128.card', chart: 'bar' },
  { slug: 'expedientes-por-estado', hu: 'HU-129', titleKey: 'reports.r129.title', descriptionKey: 'reports.r129.card', chart: 'bar' },
  { slug: 'documentos-pendientes', hu: 'HU-130', titleKey: 'reports.r130.title', descriptionKey: 'reports.r130.card', chart: 'doughnut' },
  { slug: 'expedientes-de-cliente', hu: 'HU-131', titleKey: 'reports.r131.title', descriptionKey: 'reports.r131.card', chart: 'doughnut' },
  { slug: 'actividad-chat', hu: 'HU-132', titleKey: 'reports.r132.title', descriptionKey: 'reports.r132.card', chart: 'line' },
  { slug: 'auditoria-por-accion', hu: 'HU-133', titleKey: 'reports.r133.title', descriptionKey: 'reports.r133.card', chart: 'bar', adminOnly: true },
];
