import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { routes } from './app.routes';
import { LoginService } from './services/login-service';

describe('Application navigation regressions', () => {
  beforeEach(() => {
    // jsdom no implementa matchMedia; solo se completa el entorno de pruebas.
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    );
  });
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    }),
  );
  afterEach(() => {
    const http = TestBed.inject(HttpTestingController);
    // Las consultas del panel se prueban en dashboard-queries.spec.ts.
    http
      .match(
        (req) =>
          req.url === '/api/cases/chat-session-count' || req.url === '/api/clients/document-count',
      )
      .forEach((req) => req.cancelled || req.flush([]));
    http.verify();
    vi.unstubAllGlobals();
  });
  it('creates the application', () => {
    expect(TestBed.createComponent(App).componentInstance).toBeTruthy();
  });
  it('continues to render the public login form through the existing routes', async () => {
    const f = TestBed.createComponent(App);
    f.detectChanges();
    await TestBed.inject(Router).navigateByUrl('/usuarios/login');
    await f.whenStable();
    expect(f.nativeElement.querySelector('input[formControlName="email"]')).toBeTruthy();
    expect(f.nativeElement.querySelector('input[formControlName="password"]')).toBeTruthy();
    expect(f.nativeElement.querySelector('app-sidebar')).toBeNull();
  });
  it('continues to render registration without entering the protected layout', async () => {
    const f = TestBed.createComponent(App);
    f.detectChanges();
    await TestBed.inject(Router).navigateByUrl('/usuarios/registrar');
    await f.whenStable();
    expect(f.nativeElement.querySelector('input[formControlName="fullName"]')).toBeTruthy();
    expect(f.nativeElement.querySelector('input[formControlName="confirmPassword"]')).toBeTruthy();
    expect(f.nativeElement.querySelector('app-sidebar')).toBeNull();
  });
  it('redirects anonymous clients navigation through the existing authGuard', async () => {
    const f = TestBed.createComponent(App);
    f.detectChanges();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/clientes');
    await f.whenStable();
    expect(router.url).toContain('/usuarios/login');
    expect(f.nativeElement.querySelector('app-cliente')).toBeNull();
  });
  it('keeps the dashboard, navbar and sidebar together for an authenticated session', async () => {
    const login = TestBed.inject(LoginService);
    login.state.set('authenticated');
    login.currentUser.set({
      userId: 1,
      roleId: 9,
      roleName: 'USER',
      fullName: 'Test session',
      email: 'session@example.com',
      status: 'ACTIVE',
      createdAt: '2026-11-01',
      updatedAt: '2026-11-01',
    });
    const f = TestBed.createComponent(App);
    f.detectChanges();
    await TestBed.inject(Router).navigateByUrl('/dashboard');
    f.detectChanges();
    TestBed.inject(HttpTestingController).expectOne('/api/clients').flush([]);
    await f.whenStable();
    expect(f.nativeElement.querySelector('app-navbar')).toBeTruthy();
    expect(f.nativeElement.querySelector('app-sidebar')).toBeTruthy();
    expect(f.nativeElement.querySelector('h1')).toBeTruthy();
  });
});
