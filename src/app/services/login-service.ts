import { HttpBackend, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, map, Observable, of, shareReplay, tap } from 'rxjs';
import { API_BASE_URL } from '../core/http/api.config';
import { LoginRequest } from '../models/request/login-request';
import { RegisterRequest } from '../models/request/register-request';
import { AuthResponse } from '../models/response/auth-response';
import { CurrentUserResponse } from '../models/response/current-user-response';
import { translate } from './i18n.service';

export type SessionState = 'initializing' | 'authenticated' | 'anonymous';

@Injectable({ providedIn: 'root' })
export class LoginService {
  private readonly router = inject(Router);
  private readonly rawHttp: HttpClient;
  private readonly storageKey = 'legalai-session';
  private restoreRequest?: Observable<boolean>;
  readonly state = signal<SessionState>('initializing');
  readonly currentUser = signal<CurrentUserResponse | null>(null);

  constructor(httpBackend: HttpBackend) {
    this.rawHttp = new HttpClient(httpBackend);
    if (!this.getAccessToken()) this.state.set('anonymous');
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.rawHttp.post<AuthResponse>(`${API_BASE_URL}/auth/login`, request).pipe(tap((response) => this.saveSession(response)));
  }

  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.rawHttp.post<AuthResponse>(`${API_BASE_URL}/auth/register`, request).pipe(tap((response) => this.saveSession(response)));
  }

  getAccessToken(): string | null {
    const raw = sessionStorage.getItem(this.storageKey);
    if (!raw) return null;
    try {
      const session = JSON.parse(raw) as { accessToken?: unknown };
      return typeof session.accessToken === 'string' ? session.accessToken : null;
    } catch { sessionStorage.removeItem(this.storageKey); return null; }
  }

  ensureSession(): Observable<boolean> {
    if (this.state() === 'authenticated') return of(true);
    if (this.state() === 'anonymous') return of(false);
    if (this.restoreRequest) return this.restoreRequest;
    const token = this.getAccessToken();
    if (!token) { this.state.set('anonymous'); return of(false); }
    this.restoreRequest = this.rawHttp.get<CurrentUserResponse>(`${API_BASE_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } }).pipe(
      tap((user) => { this.currentUser.set(user); this.state.set('authenticated'); }),
      map(() => true),
      catchError(() => { this.clearSession(); return of(false); }),
      finalize(() => { this.restoreRequest = undefined; }),
      shareReplay(1),
    );
    return this.restoreRequest;
  }

  clearSession(): void { sessionStorage.removeItem(this.storageKey); this.currentUser.set(null); this.state.set('anonymous'); }
  logout(): void { this.clearSession(); void this.router.navigate(['/usuarios/login']); }

  errorMessage(error: unknown, fallback: string): string {
    const backendMessage = this.backendMessage(error);
    if (error instanceof HttpErrorResponse) {
      if (error.status === 409) return translate('errors.conflict', { message: backendMessage ?? fallback });
      if (error.status === 0) return translate('errors.serverDown');
      if (error.status === 401) return backendMessage ?? translate('errors.badCredentials');
      if (error.status === 403) return backendMessage ?? translate('errors.forbidden');
      if (error.status >= 500) return backendMessage ?? translate('errors.500');
      if (error.status === 400) return backendMessage ?? translate('errors.400');
    }
    if (error instanceof Error && error.message) return error.message;
    return backendMessage ?? fallback;
  }

  private backendMessage(error: unknown): string | null {
    const response = error as { error?: { message?: unknown } } | null;
    return typeof response?.error?.message === 'string' && response.error.message.trim()
      ? response.error.message
      : null;
  }

  private saveSession(response: AuthResponse): void {
    if (response.tokenType !== 'Bearer' || !response.accessToken || !response.user) throw new Error('La respuesta de autenticación no tiene el formato esperado.');
    sessionStorage.setItem(this.storageKey, JSON.stringify({ tokenType: response.tokenType, accessToken: response.accessToken }));
    this.currentUser.set(response.user); this.state.set('authenticated');
  }
}
