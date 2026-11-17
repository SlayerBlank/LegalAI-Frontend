import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CurrentUserResponse } from '../models/response/current-user-response';
import { UserResponse, UserUpdateRequest } from '../models/management';
@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/users`;
  getCurrentUser(): Observable<CurrentUserResponse> {
    return this.http.get<CurrentUserResponse>(`${environment.apiBaseUrl}/users/me`);
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
