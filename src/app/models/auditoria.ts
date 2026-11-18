// Contratos reales del backend: AuditLogController y AuditLogResponseDTO (solo ROLE_ADMIN).

/** AuditLogResponseDTO. userFullName/userEmail llegan cuando el backend los incluye. */
export interface AuditLogResponse {
  logId: number;
  userId: number;
  userFullName?: string | null;
  userEmail?: string | null;
  action: string;
  entityType: string;
  entityId: number | null;
  details: string | null;
  createdAt: string;
}

/** Filtros de GET /api/audit-logs; from/to son fechas (yyyy-MM-dd) del formulario. */
export interface AuditLogFilters {
  userId: number | null;
  action: string;
  entityType: string;
  from: string;
  to: string;
}

export interface PageResult<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/**
 * Spring Data puede serializar Page de dos formas: directa (totalElements en la raíz)
 * o VIA_DTO ({ content, page: { number, size, totalElements, totalPages } }).
 */
export interface SpringPage<T> {
  content?: T[];
  number?: number;
  size?: number;
  totalElements?: number;
  totalPages?: number;
  page?: { number: number; size: number; totalElements: number; totalPages: number };
}

export function normalizePage<T>(raw: SpringPage<T> | null | undefined): PageResult<T> {
  const content = raw?.content ?? [];
  const meta = raw?.page ?? raw ?? {};
  return {
    content,
    number: meta.number ?? 0,
    size: meta.size ?? content.length,
    totalElements: meta.totalElements ?? content.length,
    totalPages: meta.totalPages ?? (content.length ? 1 : 0),
  };
}

/** Acciones que registra hoy el backend, con su texto en español. */
export const AUDIT_ACTIONS: Record<string, string> = {
  LOGIN: 'Inicio de sesión',
  CREATE_CLIENT: 'Crear cliente',
  UPDATE_CLIENT: 'Actualizar cliente',
  DELETE_CLIENT: 'Eliminar cliente',
  CREATE_CASE: 'Crear expediente',
  UPDATE_CASE: 'Actualizar expediente',
  CLOSE_CASE: 'Cerrar expediente',
  DELETE_CASE: 'Eliminar expediente',
  UPLOAD_DOCUMENT: 'Subir documento',
  PROCESS_DOCUMENT: 'Procesar documento',
  GENERATE_DOCUMENT_CHUNKS: 'Generar fragmentos',
  PREPARE_DOCUMENT: 'Preparar documento para IA',
  DELETE_DOCUMENT: 'Eliminar documento',
  CREATE_CHAT_SESSION: 'Crear sesión de chat',
  UPDATE_CHAT_SESSION: 'Actualizar sesión de chat',
  DELETE_CHAT_SESSION: 'Eliminar sesión de chat',
  SEND_CHAT_MESSAGE: 'Enviar mensaje al chat',
  RAG_QUERY: 'Consulta a la IA',
};

export const AUDIT_ENTITY_TYPES = ['Usuario', 'Cliente', 'Expediente', 'Documento', 'ChatSession'];

export const AUDIT_PAGE_SIZE = 20;
