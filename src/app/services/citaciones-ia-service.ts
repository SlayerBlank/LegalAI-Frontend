import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/http/api.config';
import {
  ChatMessageDTO,
  ChatSessionResponseDTO,
  CitacionIAResponseDTO,
} from '../models/management';

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

  listByMessage(
    sessionId: number,
    messageId: number,
  ): Observable<CitacionIAResponseDTO[]> {
    return this.http.get<CitacionIAResponseDTO[]>(
      `${this.url}/sessions/${sessionId}/messages/${messageId}/citations`,
    );
  }
}
