import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/http/api.config';
import { RoleRequest, RoleResponse } from '../models/management';
@Injectable({ providedIn: 'root' })
export class RolService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_BASE_URL}/roles`;
  list(): Observable<RoleResponse[]> {
    return this.http.get<RoleResponse[]>(this.url);
  }
  get(id: number): Observable<RoleResponse> {
    return this.http.get<RoleResponse>(`${this.url}/${id}`);
  }
  create(body: RoleRequest): Observable<RoleResponse> {
    return this.http.post<RoleResponse>(this.url, body);
  }
  update(id: number, body: RoleRequest): Observable<RoleResponse> {
    return this.http.put<RoleResponse>(`${this.url}/${id}`, body);
  }
  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
