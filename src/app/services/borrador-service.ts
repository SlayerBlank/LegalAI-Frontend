import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { API_BASE_URL } from '../core/http/api.config';
import { DraftFilterResponse, DraftResponse } from '../models/response/draft-response';
import { DraftRequest } from '../models/request/draft-request';

@Injectable({ providedIn: 'root' })
export class BorradorService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_BASE_URL}/drafts`;

  list() {
    return this.http.get<DraftResponse[]>(this.url);
  }

  filter(caseId: number, status: string, updatedFrom: string, updatedTo: string) {
    return this.filterRecords(caseId, status, updatedFrom, updatedTo).pipe(
      map((drafts) => new Set(drafts.map(({ draftId }) => draftId))),
    );
  }

  /** GET /api/drafts/filter: el backend exige expediente, estado y ambas fechas. */
  filterRecords(caseId: number, status: string, updatedFrom: string, updatedTo: string) {
    return this.http.get<DraftFilterResponse[]>(`${this.url}/filter`, {
      params: { caseId, status, updatedFrom, updatedTo },
    });
  }

  get(id: number) {
    return this.http.get<DraftResponse>(`${this.url}/${id}`);
  }

  save(id: number | null, request: DraftRequest) {
    return id === null
      ? this.http.post<DraftResponse>(this.url, request)
      : this.http.put<DraftResponse>(`${this.url}/${id}`, request);
  }

  remove(id: number) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
