import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CurrentUserResponse } from '../models/response/current-user-response';
@Injectable({ providedIn: 'root' })
export class UsuarioService { private readonly http = inject(HttpClient); getCurrentUser(): Observable<CurrentUserResponse> { return this.http.get<CurrentUserResponse>(`${environment.apiBaseUrl}/users/me`); } }
