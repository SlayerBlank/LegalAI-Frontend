import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../core/http/api.config';
import {
  AUDIT_PAGE_SIZE,
  AuditLogFilters,
  AuditLogResponse,
  PageResult,
  SpringPage,
  normalizePage,
} from '../models/auditoria';

@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_BASE_URL}/audit-logs`;

  /**
   * GET /api/audit-logs con filtros opcionales y paginación del servidor (page empieza en 0).
   * Las fechas del día se envían como LocalDateTime ISO: inicio y fin del día.
   */
  search(
    filters: AuditLogFilters,
    page = 0,
    size = AUDIT_PAGE_SIZE,
  ): Observable<PageResult<AuditLogResponse>> {
    let params = new HttpParams()
      .set('page', page)
      .set('size', size)
      .append('sort', 'createdAt,desc')
      .append('sort', 'logId,desc');
    if (filters.userId !== null) params = params.set('userId', filters.userId);
    if (filters.action.trim()) params = params.set('action', filters.action.trim());
    if (filters.entityType.trim()) params = params.set('entityType', filters.entityType.trim());
    if (filters.from) params = params.set('from', `${filters.from}T00:00:00`);
    if (filters.to) params = params.set('to', `${filters.to}T23:59:59`);
    return this.http
      .get<SpringPage<AuditLogResponse>>(this.url, { params })
      .pipe(map((raw) => normalizePage(raw)));
  }

  get(id: number): Observable<AuditLogResponse> {
    return this.http.get<AuditLogResponse>(`${this.url}/${id}`);
  }

  /** HU-121: todos los eventos de un usuario; se garantiza el orden del más reciente al más antiguo. */
  byUser(userId: number): Observable<AuditLogResponse[]> {
    return this.http
      .get<AuditLogResponse[]>(`${this.url}/usuario/${userId}`)
      .pipe(map((logs) => [...(logs ?? [])].sort(newestFirst)));
  }
}

function newestFirst(a: AuditLogResponse, b: AuditLogResponse): number {
  return b.createdAt.localeCompare(a.createdAt) || b.logId - a.logId;
}
