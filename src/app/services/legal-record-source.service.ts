import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';

export interface CaseOption {
  caseId: number;
  title: string;
}

export interface DocumentOption {
  documentId: number;
  caseId: number;
  fileName: string;
}

@Injectable({ providedIn: 'root' })
export class LegalRecordSourceService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiBaseUrl;

  cases() {
    return this.http.get<CaseOption[]>(`${this.api}/cases`);
  }

  documents(caseId: number) {
    return this.http.get<DocumentOption[]>(`${this.api}/cases/${caseId}/documents`);
  }

  document(id: number) {
    return this.http.get<DocumentOption>(`${this.api}/documents/${id}`);
  }

  download(id: number) {
    return this.http.get(`${this.api}/documents/${id}/download`, { responseType: 'blob' });
  }
}
