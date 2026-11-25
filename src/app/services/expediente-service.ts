import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/http/api.config';
import {
  CaseFilters,
  CaseRequest,
  CaseResponse,
  CaseSessionCountResponse,
} from '../models/expediente';

@Injectable({ providedIn: 'root' })
export class ExpedienteService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_BASE_URL}/cases`;

  /**
   * Expedientes propios. Sin filtros el backend devuelve todos; con alguno aplica
   * status/openedFrom/openedTo (orden openedAt DESC) y responde 400 si openedFrom > openedTo.
   */
  list(filters: CaseFilters = {}): Observable<CaseResponse[]> {
    let params = new HttpParams();
    if (filters.status) params = params.set('status', filters.status);
    if (filters.openedFrom) params = params.set('openedFrom', filters.openedFrom);
    if (filters.openedTo) params = params.set('openedTo', filters.openedTo);
    return this.http.get<CaseResponse[]>(this.url, { params });
  }

  get(id: number): Observable<CaseResponse> {
    return this.http.get<CaseResponse>(`${this.url}/${id}`);
  }

  create(body: CaseRequest): Observable<CaseResponse> {
    return this.http.post<CaseResponse>(this.url, body);
  }

  update(id: number, body: CaseRequest): Observable<CaseResponse> {
    return this.http.put<CaseResponse>(`${this.url}/${id}`, body);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  /** Cantidad de sesiones de chat por expediente propio. */
  sessionCounts(): Observable<CaseSessionCountResponse[]> {
    return this.http.get<CaseSessionCountResponse[]>(`${this.url}/chat-session-count`);
  }
}
