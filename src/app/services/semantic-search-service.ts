import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../core/http/api.config';
import {
  SEARCH_TOP_K_DEFAULT,
  SemanticSearchRequest,
  SemanticSearchResult,
} from '../models/semantic-search';

/**
 * Búsqueda semántica en todos los documentos de un expediente.
 * La búsqueda dentro de un documento (HU-101) está en DocumentoService.semanticSearch.
 */
@Injectable({ providedIn: 'root' })
export class SemanticSearchService {
  private readonly http = inject(HttpClient);

  /** Fragmentos de todos los documentos de un expediente propio (404 si es ajeno). */
  searchCase(
    caseId: number,
    query: string,
    topK = SEARCH_TOP_K_DEFAULT,
  ): Observable<SemanticSearchResult[]> {
    return this.post(`${API_BASE_URL}/cases/${caseId}/search`, { query: query.trim(), topK });
  }

  /** El backend ya ordena por distancia; se garantiza el orden de más a menos relevante. */
  private post(url: string, body: SemanticSearchRequest): Observable<SemanticSearchResult[]> {
    return this.http
      .post<SemanticSearchResult[]>(url, body)
      .pipe(map((rows) => [...(rows ?? [])].sort((a, b) => a.distance - b.distance)));
  }
}
