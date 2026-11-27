import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/http/api.config';
import { CurrentUserResponse } from '../models/response/current-user-response';
import { UserResponse, UserUpdateRequest } from '../models/management';
@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_BASE_URL}/users`;
  getCurrentUser(): Observable<CurrentUserResponse> {
    return this.http.get<CurrentUserResponse>(`${API_BASE_URL}/users/me`);
  }
  list(): Observable<UserResponse[]> {
    return this.http.get<UserResponse[]>(this.url);
  }
  get(id: number): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.url}/${id}`);
  }
  update(id: number, body: UserUpdateRequest): Observable<UserResponse> {
    return this.http.put<UserResponse>(`${this.url}/${id}`, body);
  }
  deactivate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
