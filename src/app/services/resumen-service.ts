import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../environments/environment';
import { SummaryResponse } from '../models/response/summary-response';
import { SummaryRequest } from '../models/request/summary-request';

@Injectable({ providedIn: 'root' })
export class ResumenService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/summaries`;

  list() {
    return this.http.get<SummaryResponse[]>(this.url);
  }

  filter(caseId: number, summaryType: string, createdFrom: string, createdTo: string) {
    return this.http
      .get<Pick<SummaryResponse, 'summaryId'>[]>(`${this.url}/filter`, {
        params: { caseId, summaryType, createdFrom, createdTo },
      })
      .pipe(map((summaries) => new Set(summaries.map(({ summaryId }) => summaryId))));
  }

  get(id: number) {
    return this.http.get<SummaryResponse>(`${this.url}/${id}`);
  }

  save(id: number | null, request: SummaryRequest) {
    return id === null
      ? this.http.post<SummaryResponse>(this.url, request)
      : this.http.put<SummaryResponse>(`${this.url}/${id}`, request);
  }

  remove(id: number) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
