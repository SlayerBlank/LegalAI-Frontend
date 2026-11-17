import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/http/api.config';
import { ClientRequest, ClientResponse, ClientCaseResponse } from '../models/management';
@Injectable({ providedIn: 'root' })
export class ClienteService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_BASE_URL}/clients`;
  list(): Observable<ClientResponse[]> {
    return this.http.get<ClientResponse[]>(this.url);
  }
  get(id: number): Observable<ClientResponse> {
    return this.http.get<ClientResponse>(`${this.url}/${id}`);
  }
  create(body: ClientRequest): Observable<ClientResponse> {
    return this.http.post<ClientResponse>(this.url, body);
  }
  update(id: number, body: ClientRequest): Observable<ClientResponse> {
    return this.http.put<ClientResponse>(`${this.url}/${id}`, body);
  }
  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
  cases(id: number): Observable<ClientCaseResponse[]> {
    return this.http.get<ClientCaseResponse[]>(`${this.url}/${id}/cases`);
  }
}
