import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';
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

  /**
   * HU-70: GET /api/audit-logs/advanced-search. El backend exige al menos dos filtros y
   * recibe las fechas como LocalDate (yyyy-MM-dd), a diferencia de search().
   */
  advancedSearch(
    filters: AuditLogFilters,
    page = 0,
    size = AUDIT_PAGE_SIZE,
  ): Observable<PageResult<AuditLogResponse>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (filters.userId !== null) params = params.set('userId', filters.userId);
    if (filters.action.trim()) params = params.set('action', filters.action.trim());
    if (filters.entityType.trim()) params = params.set('entityType', filters.entityType.trim());
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
    return this.http
      .get<SpringPage<AuditLogResponse>>(`${this.url}/advanced-search`, { params })
      .pipe(map((raw) => normalizePage(raw)));
  }

  /** Recorre las páginas de advancedSearch hasta maxPages; total es el conteo del servidor. */
  advancedSearchAll(
    filters: AuditLogFilters,
    size = 500,
    maxPages = 20,
  ): Observable<{ events: AuditLogResponse[]; total: number }> {
    return this.advancedSearch(filters, 0, size).pipe(
      expand((result) =>
        result.number + 1 < Math.min(result.totalPages, maxPages)
          ? this.advancedSearch(filters, result.number + 1, size)
          : EMPTY,
      ),
      reduce(
        (acc, result) => ({ events: acc.events.concat(result.content), total: result.totalElements }),
        { events: [] as AuditLogResponse[], total: 0 },
      ),
    );
  }

  get(id: number): Observable<AuditLogResponse> {
    return this.http.get<AuditLogResponse>(`${this.url}/${id}`);
  }
}
