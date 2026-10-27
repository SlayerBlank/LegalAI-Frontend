import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { LoginService } from './login-service';
export const jwtInterceptor: HttpInterceptorFn = (request, next) => {
  const login = inject(LoginService); const router = inject(Router);
  const requestUrl = new URL(request.url, window.location.origin); const apiUrl = new URL(environment.apiBaseUrl, window.location.origin);
  const isLegalApi = requestUrl.origin === apiUrl.origin && requestUrl.pathname.startsWith(`${apiUrl.pathname}/`);
  const isPublicAuth = requestUrl.pathname === `${apiUrl.pathname}/auth/login` || requestUrl.pathname === `${apiUrl.pathname}/auth/register`;
  const token = login.getAccessToken();
  const authorizedRequest = isLegalApi && !isPublicAuth && token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;
  return next(authorizedRequest).pipe(catchError((error: unknown) => { if (error instanceof HttpErrorResponse && error.status === 401 && isLegalApi && !isPublicAuth) { login.clearSession(); if (!router.url.startsWith('/usuarios/login')) void router.navigate(['/usuarios/login'], { queryParams: { returnUrl: router.url } }); } return throwError(() => error); }));
};
