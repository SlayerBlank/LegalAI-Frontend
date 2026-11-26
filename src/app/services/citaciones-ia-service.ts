import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, map, of, switchMap, throwError } from 'rxjs';
import { API_BASE_URL } from '../core/http/api.config';
import {
  ChatMessageDTO,
  ChatSessionResponseDTO,
  CitacionIAResponseDTO,
} from '../models/management';
import { DocumentChunkResponse, DocumentResponse } from '../models/documento';

/** HU-129: fragmento al que apunta una cita, o la indicación de que ya no existe. */
export interface CitedFragment {
  citation: CitacionIAResponseDTO;
  document: DocumentResponse | null;
  chunk: DocumentChunkResponse | null;
  documentMissing: boolean;
  chunkMissing: boolean;
}

@Injectable({ providedIn: 'root' })
export class CitacionesIaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_BASE_URL}/chat`;

  listSessions(): Observable<ChatSessionResponseDTO[]> {
    return this.http.get<ChatSessionResponseDTO[]>(`${this.url}/sessions`);
  }

  listMessages(sessionId: number): Observable<ChatMessageDTO[]> {
    return this.http.get<ChatMessageDTO[]>(`${this.url}/sessions/${sessionId}/messages`);
  }

  /**
   * HU-129: GET /api/documents/{id} y GET /api/documents/{id}/chunks para resolver la cita.
   * Un 404 del documento (o documentId null) significa que fue eliminado; si el chunkId no
   * aparece entre los fragmentos actuales, el fragmento ya no existe. Otros errores se propagan.
   */
  citedFragment(citation: CitacionIAResponseDTO): Observable<CitedFragment> {
    const base = { citation, document: null, chunk: null };
    if (citation.documentId === null) {
      return of({ ...base, documentMissing: true, chunkMissing: true });
    }
    const id = citation.documentId;
    return this.http.get<DocumentResponse>(`${API_BASE_URL}/documents/${id}`).pipe(
      switchMap((document) =>
        this.http.get<DocumentChunkResponse[]>(`${API_BASE_URL}/documents/${id}/chunks`).pipe(
          map((chunks) => {
            const chunk = chunks.find((c) => c.chunkId === citation.chunkId) ?? null;
            return { ...base, document, chunk, documentMissing: false, chunkMissing: !chunk };
          }),
        ),
      ),
      catchError((error: unknown) =>
        error instanceof HttpErrorResponse && error.status === 404
          ? of({ ...base, documentMissing: true, chunkMissing: true })
          : throwError(() => error),
      ),
    );
  }

  listByMessage(
    sessionId: number,
    messageId: number,
  ): Observable<CitacionIAResponseDTO[]> {
    return this.http.get<CitacionIAResponseDTO[]>(
      `${this.url}/sessions/${sessionId}/messages/${messageId}/citations`,
    );
  }
}
