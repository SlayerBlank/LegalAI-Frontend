import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { App } from '../../app';
import { routes } from '../../app.routes';
import { LoginService } from '../../services/login-service';
import { ThemeService } from '../../services/theme-service';
import { DashboardHomeComponent } from './dashboard-home';
import { DashboardMainComponent } from './dashboard-main';
import { NavbarComponent } from './navbar-component/navbar-component';
import { CurrentUserResponse } from '../../models/response/current-user-response';
const user: CurrentUserResponse = {
  userId: 70,
  roleId: 17,
  roleName: 'ADMIN',
  fullName: 'Ana Garcia',
  email: 'test-session@example.com',
  status: 'ACTIVE',
  createdAt: '2026-11-17',
  updatedAt: '2026-11-17',
};

describe('Private workspace: navigation, real metrics and drawer', () => {
  let http: HttpTestingController;
  let login: LoginService;
  let media: {
    matches: boolean;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };
  let resized: () => void;
  beforeEach(() => {
    localStorage.removeItem('legalai-theme');
    sessionStorage.removeItem('legalai-session');
    media = {
      matches: false,
      addEventListener: vi.fn((_event, listener) => (resized = listener)),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) =>
        query.includes('1100')
          ? media
          : { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() },
      ),
    );
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    login = TestBed.inject(LoginService);
    login.state.set('authenticated');
    login.currentUser.set({ ...user });
  });
  afterEach(() => {
    // Las consultas del panel se prueban en dashboard-queries.spec.ts.
    http
      .match('/api/cases/chat-session-count')
      .forEach((req) => req.cancelled || req.flush([]));
    http.verify();
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    sessionStorage.removeItem('legalai-session');
    localStorage.removeItem('legalai-theme');
    document.body.style.overflow = '';
  });
  async function dashboard() {
    const f = TestBed.createComponent(App);
    f.detectChanges();
    await TestBed.inject(Router).navigateByUrl('/dashboard');
    f.detectChanges();
    http.expectOne('/api/clients').flush([{ clientId: 10 }, { clientId: 20 }]);
    await f.whenStable();
    return f;
  }
  it('uses the full private shell once and derives only the available client count', async () => {
    const f = await dashboard();
    expect(f.nativeElement.querySelectorAll('app-sidebar')).toHaveLength(1);
    expect(f.nativeElement.querySelectorAll('app-navbar')).toHaveLength(1);
    expect(f.nativeElement.querySelectorAll('.shell router-outlet')).toHaveLength(1);
    expect(
      Array.from(f.nativeElement.querySelectorAll('.metric-value')).map((el: any) =>
        el.textContent.trim(),
      ),
    ).toEqual(['\u2014', '2', '\u2014', '\u2014']);
    expect(f.nativeElement.querySelector('#dashboard-title').textContent).toContain('Ana');
    expect(f.nativeElement.textContent).not.toContain('Vega & Asociados');
  });
  it('does not duplicate client reads while a request is pending', () => {
    const f = TestBed.createComponent(DashboardHomeComponent);
    f.detectChanges();
    f.componentInstance.loadClients();
    const req = http.expectOne('/api/clients');
    expect(req.request.method).toBe('GET');
    expect(f.componentInstance.clientCount).toBeNull();
    req.flush([]);
    expect(f.componentInstance.clientCount).toBe(0);
    expect(f.componentInstance.clientStatus).toBe('ready');
  });
  it('represents a failed count as unknown, never as zero, and supports retry', () => {
    const f = TestBed.createComponent(DashboardHomeComponent);
    f.detectChanges();
    http
      .expectOne('/api/clients')
      .flush({ message: 'Unavailable' }, { status: 500, statusText: 'Server Error' });
    expect(f.componentInstance.clientCount).toBeNull();
    expect(f.componentInstance.clientStatus).toBe('error');
    f.componentInstance.loadClients();
    http.expectOne('/api/clients').flush([{ clientId: 1 }]);
    expect(f.componentInstance.clientCount).toBe(1);
  });
  it('never enables a fictitious creation operation or fake notifications/help', async () => {
    const f = await dashboard();
    expect(f.nativeElement.querySelector('.new-case').disabled).toBe(true);
    expect(f.nativeElement.querySelector('.notifications').disabled).toBe(true);
    expect(f.nativeElement.querySelector('.help-card button').disabled).toBe(true);
  });
  it('changes the navbar path and selects exactly one navigation item', async () => {
    const f = await dashboard();
    await TestBed.inject(Router).navigateByUrl('/clientes?search=private-value#private-fragment');
    f.detectChanges();
    http.expectOne('/api/clients').flush([]);
    await f.whenStable();
    expect(f.nativeElement.querySelector('.current-path').textContent).toBe('/clientes');
    expect(f.nativeElement.querySelectorAll('nav a[aria-current="page"]')).toHaveLength(1);
    expect(f.nativeElement.querySelector('nav a[aria-current="page"]').textContent).toContain(
      'Clientes',
    );
    expect(f.nativeElement.querySelector('app-navbar').textContent).not.toContain('private-value');
  });
  it('shows the real profile and retains a working disclosure', async () => {
    const f = await dashboard();
    expect(f.nativeElement.querySelector('.user-name').textContent).toBe(user.fullName);
    expect(f.nativeElement.querySelector('.avatar').textContent).toBe('AG');
    f.nativeElement.querySelector('.profile-trigger').click();
    await f.whenStable();
    expect(f.nativeElement.querySelector('#workspace-profile').textContent).toContain(user.email);
    expect(f.nativeElement.querySelector('#workspace-profile').textContent).toContain('ADMIN');
  });
  it('does not offer administrative navigation to USER sessions', async () => {
    login.currentUser.set({ ...user, roleName: 'USER' });
    const f = await dashboard();
    expect(f.nativeElement.querySelector('app-sidebar a[href="/gestionusuarios"]')).toBeNull();
    expect(f.nativeElement.querySelector('app-sidebar a[href="/roles"]')).toBeNull();
    expect(f.nativeElement.querySelector('app-sidebar a[href="/auditoria"]')).toBeNull();
  });
  it('delegates logout to the existing service and returns to Login', async () => {
    const f = await dashboard();
    const logout = vi.spyOn(login, 'logout');
    f.nativeElement.querySelector('.user-meta button').click();
    await f.whenStable();
    expect(logout).toHaveBeenCalledTimes(1);
    expect(login.state()).toBe('anonymous');
    expect(login.currentUser()).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/usuarios/login');
  });
  it('shows selected System rather than confusing it with effective Light', async () => {
    const f = await dashboard();
    TestBed.inject(ThemeService).setPreference('system');
    await f.whenStable();
    expect(f.nativeElement.querySelector('.route-context').textContent).toContain('Sistema');
    expect(
      f.nativeElement.querySelector('[data-theme-option="system"]').getAttribute('aria-pressed'),
    ).toBe('true');
    expect(TestBed.inject(ThemeService).theme()).toBe('light');
  });
  it('only marks the session active when the original mechanism says authenticated', () => {
    login.state.set('initializing');
    const f = TestBed.createComponent(NavbarComponent);
    f.detectChanges();
    expect(f.nativeElement.querySelector('.session-state').textContent).not.toContain('activa');
    login.state.set('authenticated');
    f.detectChanges();
    expect(f.nativeElement.querySelector('.session-state').textContent).toContain('activa');
  });
  it('locks background scroll and focus while the mobile drawer is open, then closes on Escape', async () => {
    media.matches = true;
    const f = await dashboard();
    const trigger = f.nativeElement.querySelector('.menu-trigger');
    const restoreFocus = vi.spyOn(trigger, 'focus');
    trigger.click();
    await f.whenStable();
    expect(document.body.style.overflow).toBe('hidden');
    expect(f.nativeElement.querySelector('.content').hasAttribute('inert')).toBe(true);
    expect(f.nativeElement.querySelector('#workspace-sidebar').getAttribute('aria-modal')).toBe(
      'true',
    );
    expect(document.activeElement?.closest('#workspace-sidebar')).toBeTruthy();
    const focusable = Array.from(
      f.nativeElement.querySelectorAll('aside a[href],aside button:not(:disabled)'),
    ) as HTMLElement[];
    focusable.at(-1)!.focus();
    focusable
      .at(-1)!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(focusable[0]);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await f.whenStable();
    expect(document.body.style.overflow).toBe('');
    expect(f.nativeElement.querySelector('.content').hasAttribute('inert')).toBe(false);
    expect(f.nativeElement.querySelector('#workspace-sidebar').hasAttribute('inert')).toBe(true);
    expect(restoreFocus).toHaveBeenCalled();
  });
  it('closes the mobile drawer through the overlay', async () => {
    media.matches = true;
    const f = await dashboard();
    f.nativeElement.querySelector('.menu-trigger').click();
    await f.whenStable();
    f.nativeElement.querySelector('.backdrop').click();
    await f.whenStable();
    expect(f.nativeElement.querySelector('.menu-trigger').getAttribute('aria-expanded')).toBe(
      'false',
    );
    expect(document.body.style.overflow).toBe('');
  });
  it('closes and restores scroll when resized back to desktop', async () => {
    media.matches = true;
    const f = await dashboard();
    f.nativeElement.querySelector('.menu-trigger').click();
    await f.whenStable();
    media.matches = false;
    resized();
    await f.whenStable();
    expect(document.body.style.overflow).toBe('');
    expect(f.nativeElement.querySelector('#workspace-sidebar').classList.contains('open')).toBe(
      false,
    );
  });
  it('restores body scrolling when an open layout is destroyed', async () => {
    media.matches = true;
    const f = await dashboard();
    f.nativeElement.querySelector('.menu-trigger').click();
    await f.whenStable();
    f.destroy();
    expect(document.body.style.overflow).toBe('');
  });
  it('uses the browser date and refreshes across midnight', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 17, 23, 59));
    const f = TestBed.createComponent(NavbarComponent);
    f.detectChanges();
    expect(f.componentInstance.today).toContain('17 nov 2026');
    vi.advanceTimersByTime(60000);
    expect(f.componentInstance.today).toContain('18 nov 2026');
    f.destroy();
  });
});
