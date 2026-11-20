// Contratos reales de ExpedienteController (/api/cases) y sus DTOs.
import { CaseResponse, CaseStatus } from './documento';

export type { CaseResponse, CaseStatus };

/** EstadoExpediente del backend, en el mismo orden del enum. */
export const CASE_STATUSES: readonly CaseStatus[] = ['OPEN', 'IN_PROGRESS', 'CLOSED', 'ARCHIVED'];

/** Estados que admiten fecha de cierre (applyRequest rechaza closedAt en OPEN/IN_PROGRESS). */
export const CLOSED_CASE_STATUSES: readonly CaseStatus[] = ['CLOSED', 'ARCHIVED'];

/** @Size(max = 200) en ExpedienteRequestDTO.title */
export const CASE_TITLE_MAX = 200;

/**
 * ExpedienteRequestDTO: POST /api/cases y PUT /api/cases/{id}.
 * status, openedAt y closedAt son opcionales: si se omiten, el backend usa OPEN, la fecha
 * actual o conserva los valores existentes. Las fechas viajan como LocalDate (yyyy-MM-dd).
 */
export interface CaseRequest {
  clientId: number;
  title: string;
  description: string | null;
  status: CaseStatus | null;
  openedAt: string | null;
  closedAt: string | null;
}

/** Parámetros opcionales de GET /api/cases (status, openedFrom, openedTo). */
export interface CaseFilters {
  status?: CaseStatus | null;
  openedFrom?: string | null;
  openedTo?: string | null;
}

/** ExpedienteCantidadSesionesResponseDTO: GET /api/cases/chat-session-count */
export interface CaseSessionCountResponse {
  caseId: number;
  tituloExpediente: string;
  cantidadSesiones: number;
}
