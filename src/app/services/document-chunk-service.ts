import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/http/api.config';
import { ChunkGenerationResponse, DocumentChunkResponse } from '../models/documento';

@Injectable({ providedIn: 'root' })
export class DocumentChunkService {
  private readonly http = inject(HttpClient);

  private url(documentId: number): string {
    return `${API_BASE_URL}/documents/${documentId}/chunks`;
  }

  /** Fragmentos ordenados por chunkIndex; el backend valida que el documento sea propio. */
  list(documentId: number): Observable<DocumentChunkResponse[]> {
    return this.http.get<DocumentChunkResponse[]>(this.url(documentId));
  }

  /**
   * Regenera los fragmentos desde el texto extraído (requiere estado PROCESSED).
   * Reemplaza los anteriores, por lo que sus embeddings deben generarse de nuevo.
   */
  regenerate(documentId: number): Observable<ChunkGenerationResponse> {
    return this.http.post<ChunkGenerationResponse>(this.url(documentId), null);
  }
}
