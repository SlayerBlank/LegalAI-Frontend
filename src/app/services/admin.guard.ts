import { inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { LoginService } from './login-service';
import { UsuarioService } from './usuario-service';

// Complementa authGuard con el perfil actual de la API; Spring Security es la autoridad final.
export const adminGuard: CanActivateFn = (_route, state) => {
  const login = inject(LoginService);
  const users = inject(UsuarioService);
  const router = inject(Router);
  const restoring = login.state() === 'initializing';
  return login.ensureSession().pipe(
    switchMap((authenticated) => {
      if (!authenticated)
        return of(
          router.createUrlTree(['/usuarios/login'], { queryParams: { returnUrl: state.url } }),
        );
      // ensureSession ya consulta /me al restaurar; reutilizar esa respuesta evita duplicarla.
      const profile = restoring ? of(login.currentUser()) : users.getCurrentUser();
      return profile.pipe(
        map((user) =>
          user?.status === 'ACTIVE' && user.roleName === 'ADMIN'
            ? true
            : router.createUrlTree(['/dashboard']),
        ),
        catchError((error: unknown) =>
          of(
            error instanceof HttpErrorResponse && error.status === 401
              ? router.createUrlTree(['/usuarios/login'], { queryParams: { returnUrl: state.url } })
              : router.createUrlTree(['/dashboard']),
          ),
        ),
      );
    }),
  );
};
