import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/http/api.config';
import {
  ChatCreateSessionRequest,
  ChatMessage,
  ChatMessageResponse,
  ChatPage,
  ChatSendMessageRequest,
  ChatSession,
  ChatUpdateSessionRequest,
} from '../models/chat-ia';

@Injectable({ providedIn: 'root' })
export class ChatIaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_BASE_URL}/chat/sessions`;

  /** Sesiones propias, más recientes primero; caseId opcional (404 si el expediente no es propio). */
  listSessions(caseId: number | null = null, paging: ChatPage = {}): Observable<ChatSession[]> {
    let params = pageParams(paging);
    if (caseId !== null) params = params.set('caseId', caseId);
    return this.http.get<ChatSession[]>(this.url, { params });
  }

  getSession(id: number): Observable<ChatSession> {
    return this.http.get<ChatSession>(`${this.url}/${id}`);
  }

  createSession(body: ChatCreateSessionRequest): Observable<ChatSession> {
    return this.http.post<ChatSession>(this.url, body);
  }

  renameSession(id: number, body: ChatUpdateSessionRequest): Observable<ChatSession> {
    return this.http.patch<ChatSession>(`${this.url}/${id}`, body);
  }

  /** Elimina la sesión y todos sus mensajes. */
  deleteSession(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  /** Historial en orden cronológico (página 0 = mensajes más antiguos). */
  history(id: number, paging: ChatPage = {}): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(`${this.url}/${id}/messages`, {
      params: pageParams(paging),
    });
  }

  /**
   * Envía la pregunta y espera la respuesta generada. Repetir el mismo clientMessageId con el
   * mismo contenido devuelve el turno ya registrado en lugar de generar otro.
   */
  send(id: number, body: ChatSendMessageRequest): Observable<ChatMessageResponse> {
    return this.http.post<ChatMessageResponse>(`${this.url}/${id}/messages`, body);
  }
}

function pageParams({ page, size }: ChatPage): HttpParams {
  let params = new HttpParams();
  if (page !== undefined) params = params.set('page', page);
  if (size !== undefined) params = params.set('size', size);
  return params;
}
