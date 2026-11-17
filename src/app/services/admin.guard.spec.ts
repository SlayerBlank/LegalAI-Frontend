import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import {
  ActivatedRouteSnapshot,
  GuardResult,
  RouterStateSnapshot,
  Router,
  provideRouter,
} from '@angular/router';
import { Observable, of } from 'rxjs';
import { signal } from '@angular/core';
import { LoginService } from './login-service';
import { adminGuard } from './admin.guard';
import { routes } from '../app.routes';
import { authGuard } from './auth.guard';

describe('Administrative route authorization', () => {
  let http: HttpTestingController;
  let login: {
    ensureSession: ReturnType<typeof vi.fn>;
    state: ReturnType<typeof signal<string>>;
    currentUser: ReturnType<typeof signal<{ roleName: string; status: string } | null>>;
  };
  beforeEach(() => {
    login = {
      ensureSession: vi.fn(() => of(true)),
      state: signal('authenticated'),
      currentUser: signal<{ roleName: string; status: string } | null>(null),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LoginService, useValue: login },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function check(result: (value: GuardResult) => void) {
    (
      TestBed.runInInjectionContext(() =>
        adminGuard({} as ActivatedRouteSnapshot, { url: '/roles' } as RouterStateSnapshot),
      ) as Observable<GuardResult>
    ).subscribe(result);
  }
  it('keeps authGuard on the existing layout and adds adminGuard to both admin routes', () => {
    const layout = routes.find((r) => r.children?.some((c) => c.path === 'dashboard'))!;
    expect(layout.canActivate).toContain(authGuard);
    for (const path of ['roles', 'gestionusuarios'])
      expect(layout.children!.find((r) => r.path === path)?.canActivate).toContain(adminGuard);
  });
  it('accepts ADMIN only after checking the current API profile', () => {
    const result = vi.fn();
    check(result);
    http.expectOne('/api/users/me').flush({ roleName: 'ADMIN', status: 'ACTIVE' });
    expect(result).toHaveBeenCalledWith(true);
  });
  for (const role of ['USER', 'REVIEWER'])
    it(`denies ${role} without loading administrative data`, () => {
      let value: GuardResult = true;
      check((r) => (value = r));
      http.expectOne('/api/users/me').flush({ roleName: role, status: 'ACTIVE' });
      expect(TestBed.inject(Router).serializeUrl(value as never)).toBe('/dashboard');
      http.expectNone('/api/users');
      http.expectNone('/api/roles');
    });
  it('rejects inactive ADMIN', () => {
    let value: GuardResult = true;
    check((r) => (value = r));
    http.expectOne('/api/users/me').flush({ roleName: 'ADMIN', status: 'INACTIVE' });
    expect(value).not.toBe(true);
  });
  it('reuses the freshly restored profile instead of duplicating GET /me', () => {
    login.state.set('initializing');
    login.currentUser.set({ roleName: 'ADMIN', status: 'ACTIVE' });
    const result = vi.fn();
    check(result);
    expect(result).toHaveBeenCalledWith(true);
    http.expectNone('/api/users/me');
  });
  it('redirects an expired profile to login while preserving the destination', () => {
    let value: GuardResult = true;
    check((r) => (value = r));
    http
      .expectOne('/api/users/me')
      .flush({ message: 'Expired' }, { status: 401, statusText: 'Unauthorized' });
    expect(TestBed.inject(Router).serializeUrl(value as never)).toBe(
      '/usuarios/login?returnUrl=%2Froles',
    );
  });
  it('fails closed when profile verification is unavailable', () => {
    let value: GuardResult = true;
    check((r) => (value = r));
    http.expectOne('/api/users/me').error(new ProgressEvent('error'));
    expect(value).not.toBe(true);
  });
  it('redirects anonymous sessions to login without making a profile request', () => {
    login.ensureSession.mockReturnValue(of(false));
    let value: GuardResult = true;
    check((r) => (value = r));
    expect(TestBed.inject(Router).serializeUrl(value as never)).toBe(
      '/usuarios/login?returnUrl=%2Froles',
    );
    http.expectNone('/api/users/me');
  });
});
