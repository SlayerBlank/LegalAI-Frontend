import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEventType, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, filter, map, tap } from 'rxjs';
import { API_BASE_URL } from '../core/http/api.config';
import {
  CaseResponse,
  DocumentPreparationResponse,
  DocumentResponse,
  DocumentTextResponse,
  ProcessingStatus,
  EmbeddingGenerationResponse,
} from '../models/documento';

@Injectable({ providedIn: 'root' })
export class DocumentoService {
  private readonly http = inject(HttpClient);
  private readonly cases = `${API_BASE_URL}/cases`;
  private readonly documents = `${API_BASE_URL}/documents`;

  /** Expedientes propios del usuario autenticado. */
  listCases(): Observable<CaseResponse[]> {
    return this.http.get<CaseResponse[]>(this.cases);
  }

  list(caseId: number): Observable<DocumentResponse[]> {
    return this.http.get<DocumentResponse[]>(`${this.cases}/${caseId}/documents`);
  }

  /**
   * Sube el PDF; el backend lo guarda y luego intenta extraer texto, chunks y embeddings.
   * HU-94 (TA-04): onProgress recibe el porcentaje enviado (0-100) mientras sube el archivo.
   */
  upload(
    caseId: number,
    file: File,
    category: string | null,
    onProgress?: (percent: number) => void,
  ): Observable<DocumentResponse> {
    const body = new FormData();
    body.append('file', file, file.name);
    if (category) body.append('category', category);
    return this.http
      .post<DocumentResponse>(`${this.cases}/${caseId}/documents/upload`, body, {
        observe: 'events',
        reportProgress: true,
      })
      .pipe(
        tap((event) => {
          if (event.type === HttpEventType.UploadProgress && onProgress) {
            const total = event.total || file.size;
            onProgress(total > 0 ? Math.min(100, Math.round((event.loaded / total) * 100)) : 0);
          }
        }),
        filter((event): event is HttpResponse<DocumentResponse> => event instanceof HttpResponse),
        map((event) => event.body as DocumentResponse),
      );
  }

  get(id: number): Observable<DocumentResponse> {
    return this.http.get<DocumentResponse>(`${this.documents}/${id}`);
  }

  /** HU-124: estado de preparación calculado por el backend (etapa, fragmentos y embeddings). */
  preparation(id: number): Observable<DocumentPreparationResponse> {
    return this.http.get<DocumentPreparationResponse>(`${this.documents}/${id}/preparation`);
  }

  /** HU-125: reintenta la preparación completa (texto, fragmentos y embeddings) y devuelve el estado. */
  prepare(id: number): Observable<DocumentPreparationResponse> {
    return this.http.post<DocumentPreparationResponse>(`${this.documents}/${id}/prepare`, null);
  }

  /** HU-99: extrae el texto del PDF y devuelve el documento con su nuevo estado. */
  process(id: number): Observable<DocumentResponse> {
    return this.http.post<DocumentResponse>(`${this.documents}/${id}/process`, null);
  }

  /** HU-126: genera los embeddings de los fragmentos; force=true los vuelve a calcular. */
  generateEmbeddings(id: number, force = false): Observable<EmbeddingGenerationResponse> {
    const params = new HttpParams().set('force', force);
    return this.http.post<EmbeddingGenerationResponse>(`${this.documents}/${id}/embeddings`, null, {
      params,
    });
  }

  text(id: number): Observable<DocumentTextResponse> {
    return this.http.get<DocumentTextResponse>(`${this.documents}/${id}/text`);
  }

  /** Descarga autenticada (pasa por el interceptor JWT), por eso se pide como Blob. */
  download(id: number): Observable<Blob> {
    return this.http.get(`${this.documents}/${id}/download`, { responseType: 'blob' });
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.documents}/${id}`);
  }

  /** HU-67: documentos del abogado pendientes de revisión (UPLOADED, PROCESSING y ERROR). */
  pendingReview(
    abogadoId: number,
    status: ProcessingStatus | null = null,
  ): Observable<DocumentResponse[]> {
    const params = status ? new HttpParams().set('status', status) : new HttpParams();
    return this.http.get<DocumentResponse[]>(`${this.documents}/pending-review/${abogadoId}`, {
      params,
    });
  }
}
