import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { UsuarioLoginComponent } from '../../components/usuario-component/usuario-login/usuario-login';
import { UsuarioInsertComponent } from '../../components/usuario-component/usuario-insert/usuario-insert';
import { NotFoundComponent } from '../../components/errors/not-found/not-found';
import { LoginService } from '../../services/login-service';
import { routes } from '../../app.routes';

// Fixtures exclusively for HttpTestingController, never sent to a running API.
const credentials = { email: 'test@example.com', password: 'unit-test-only-value' };
const profile = {
  userId: 10,
  roleId: 2,
  roleName: 'USER',
  fullName: 'Test user',
  email: credentials.email,
  status: 'ACTIVE',
  createdAt: '2026-11-17',
  updatedAt: '2026-11-17',
};
const authResponse = { tokenType: 'Bearer', accessToken: 'unit-test-only-token', user: profile };

describe('Public authentication design: integration regressions', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    sessionStorage.removeItem('legalai-session');
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    sessionStorage.removeItem('legalai-session');
    vi.unstubAllGlobals();
  });
  function loginForm() {
    const f = TestBed.createComponent(UsuarioLoginComponent);
    f.detectChanges();
    return f;
  }
  function registerForm() {
    const f = TestBed.createComponent(UsuarioInsertComponent);
    f.detectChanges();
    return f;
  }
  function noNavigation() {
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    return router;
  }
  it('starts empty, masked and incomplete without making an HTTP request', () => {
    const f = loginForm();
    expect(f.componentInstance.form.getRawValue()).toEqual({ email: '', password: '' });
    expect(f.nativeElement.querySelector('#login-password').type).toBe('password');
    expect(f.nativeElement.querySelector('.status-panel').textContent).toContain('incompleto');
    http.expectNone('/api/auth/login');
  });
  it('does not send invalid credentials and exposes accessible errors', async () => {
    const f = loginForm();
    f.componentInstance.submit();
    f.changeDetectorRef.markForCheck();
    await f.whenStable();
    expect(f.nativeElement.querySelector('#login-email').getAttribute('aria-invalid')).toBe('true');
    expect(f.nativeElement.querySelector('#login-password-note').textContent).toContain(
      'obligatoria',
    );
    http.expectNone('/api/auth/login');
  });
  it('preserves the existing login password validator instead of imposing registration restrictions', () => {
    const c = loginForm().componentInstance;
    c.form.setValue({ email: credentials.email, password: 'x' });
    expect(c.form.valid).toBe(true);
    c.form.controls.password.setValue('x'.repeat(120));
    expect(c.form.valid).toBe(true);
  });
  it('posts login once, uses the existing JWT storage and enters Dashboard after success', () => {
    const router = noNavigation();
    const c = loginForm().componentInstance;
    c.form.setValue(credentials);
    c.submit();
    c.submit();
    const req = http.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(credentials);
    expect(c.loading).toBe(true);
    expect(sessionStorage.getItem('legalai-session')).toBeNull();
    req.flush(authResponse);
    expect(c.loading).toBe(false);
    expect(TestBed.inject(LoginService).getAccessToken()).toBe(authResponse.accessToken);
    expect(TestBed.inject(LoginService).currentUser()).toEqual(profile);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });
  it('announces authentication errors and permits retry without inventing success', async () => {
    noNavigation();
    const f = loginForm();
    const c = f.componentInstance;
    c.form.setValue(credentials);
    c.submit();
    http
      .expectOne('/api/auth/login')
      .flush({ message: 'Invalid test credentials' }, { status: 401, statusText: 'Unauthorized' });
    await f.whenStable();
    expect(c.loading).toBe(false);
    expect(f.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Invalid test credentials',
    );
    expect(sessionStorage.getItem('legalai-session')).toBeNull();
    c.submit();
    http.expectOne('/api/auth/login').flush(authResponse);
  });
  for (const returnUrl of ['/clientes', '/roles?view=all'])
    it(`honors known internal returnUrl ${returnUrl}`, () => {
      TestBed.inject(ActivatedRoute).snapshot.queryParams = { returnUrl };
      const router = noNavigation();
      const c = loginForm().componentInstance;
      c.form.setValue(credentials);
      c.submit();
      http.expectOne('/api/auth/login').flush(authResponse);
      expect(router.navigateByUrl).toHaveBeenCalledWith(returnUrl);
    });
  for (const returnUrl of [
    'https://example.com',
    '//example.com',
    '/usuarios/login',
    '/unknown',
    '/dashboard(extra:secret)',
  ])
    it(`rejects an unsafe or unknown returnUrl ${returnUrl}`, () => {
      TestBed.inject(ActivatedRoute).snapshot.queryParams = { returnUrl };
      const router = noNavigation();
      const c = loginForm().componentInstance;
      c.form.setValue(credentials);
      c.submit();
      http.expectOne('/api/auth/login').flush(authResponse);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
    });
  it('shows and hides login password using an accessible non-submit button', async () => {
    const f = loginForm();
    const button = f.nativeElement.querySelector('.password-toggle');
    expect(button.type).toBe('button');
    button.click();
    await f.whenStable();
    expect(f.nativeElement.querySelector('#login-password').type).toBe('text');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    button.click();
    await f.whenStable();
    expect(f.nativeElement.querySelector('#login-password').type).toBe('password');
    http.expectNone('/api/auth/login');
  });
  it('preserves confirmation and the UTF-8 byte validation on registration', () => {
    const c = registerForm().componentInstance;
    c.form.setValue({
      fullName: 'Test user',
      email: credentials.email,
      password: 'x'.repeat(8),
      confirmPassword: 'different',
    });
    expect(c.form.hasError('mismatch')).toBe(true);
    const multibyte = '\u00e9'.repeat(37);
    c.form.patchValue({ password: multibyte, confirmPassword: multibyte });
    expect(c.passwordBytes).toBe(74);
    expect(c.form.controls.password.hasError('maxBytes')).toBe(true);
    expect(c.form.invalid).toBe(true);
    c.form.patchValue({ password: 'x'.repeat(8), confirmPassword: 'x'.repeat(8) });
    expect(c.form.valid).toBe(true);
  });
  it('posts exactly the register DTO once and does not perform a second login', () => {
    const router = noNavigation();
    const c = registerForm().componentInstance;
    c.form.setValue({
      fullName: 'Test user',
      ...credentials,
      confirmPassword: credentials.password,
    });
    c.submit();
    c.submit();
    const req = http.expectOne('/api/auth/register');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ fullName: 'Test user', ...credentials });
    expect(req.request.body.confirmPassword).toBeUndefined();
    expect(sessionStorage.getItem('legalai-session')).toBeNull();
    req.flush(authResponse);
    expect(TestBed.inject(LoginService).getAccessToken()).toBe(authResponse.accessToken);
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    http.expectNone('/api/auth/login');
  });
  it('keeps registration errors accessible and restores the loading state', async () => {
    noNavigation();
    const f = registerForm();
    const c = f.componentInstance;
    c.form.setValue({
      fullName: 'Test user',
      ...credentials,
      confirmPassword: credentials.password,
    });
    c.submit();
    http
      .expectOne('/api/auth/register')
      .flush({ message: 'Test email already registered' }, { status: 409, statusText: 'Conflict' });
    await f.whenStable();
    expect(c.loading).toBe(false);
    expect(f.nativeElement.querySelector('[role="alert"]').textContent).toContain('409');
    expect(sessionStorage.getItem('legalai-session')).toBeNull();
  });
  it('never labels invalid registration data as ready', async () => {
    const f = registerForm();
    f.componentInstance.form.patchValue({ email: 'invalid' });
    f.changeDetectorRef.markForCheck();
    await f.whenStable();
    expect(f.nativeElement.querySelector('.status-panel').textContent).toContain('incompleto');
    expect(f.nativeElement.querySelector('.status-panel').textContent).not.toContain(
      'Datos listos',
    );
  });
  it('retains logout through the original service and clears its existing session key', () => {
    const router = noNavigation();
    const login = TestBed.inject(LoginService);
    sessionStorage.setItem(
      'legalai-session',
      JSON.stringify({ tokenType: 'Bearer', accessToken: authResponse.accessToken }),
    );
    login.currentUser.set(profile);
    login.state.set('authenticated');
    login.logout();
    expect(sessionStorage.getItem('legalai-session')).toBeNull();
    expect(login.currentUser()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/usuarios/login']);
  });
  it('renders unknown Angular routes as 404 without reflecting URL secrets', async () => {
    const harness = await RouterTestingHarness.create(
      '/missing-private-value?token=do-not-render#fragment-secret',
    );
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Este asunto');
    expect(harness.routeNativeElement?.textContent).not.toContain('missing-private-value');
    expect(harness.routeNativeElement?.textContent).not.toContain('do-not-render');
    expect(harness.routeNativeElement?.textContent).not.toContain('fragment-secret');
    expect(sessionStorage.getItem('legalai-session')).toBeNull();
  });
  it('preserves an existing session on 404 and offers Dashboard without restoring or clearing it', () => {
    const raw = JSON.stringify({ tokenType: 'Bearer', accessToken: authResponse.accessToken });
    sessionStorage.setItem('legalai-session', raw);
    const login = TestBed.inject(LoginService);
    const ensure = vi.spyOn(login, 'ensureSession');
    const clear = vi.spyOn(login, 'clearSession');
    const f = TestBed.createComponent(NotFoundComponent);
    f.detectChanges();
    expect(f.componentInstance.hasSession).toBe(true);
    expect(f.nativeElement.querySelector('.error-actions a.secondary').getAttribute('href')).toBe(
      '/dashboard',
    );
    expect(ensure).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('legalai-session')).toBe(raw);
  });
  it('offers Login and valid public recovery links on anonymous 404', () => {
    const f = TestBed.createComponent(NotFoundComponent);
    f.detectChanges();
    expect(f.componentInstance.hasSession).toBe(false);
    expect(f.nativeElement.querySelector('.error-actions a.secondary').getAttribute('href')).toBe(
      '/usuarios/login',
    );
    expect(
      Array.from(f.nativeElement.querySelectorAll('.recovery-links a')).map((a: any) =>
        a.getAttribute('href'),
      ),
    ).toEqual(['/landing', '/usuarios/login', '/usuarios/registrar']);
  });
});
