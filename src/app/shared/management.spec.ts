import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { ClienteComponent } from '../components/cliente-component/cliente-component';
import { GestionUsuariosComponent } from '../components/gestion-usuarios/gestion-usuarios';
import { RolComponent } from '../components/rol-component/rol-component';
import { ClientResponse, RoleResponse, UserResponse } from '../models/management';
import { LoginService } from '../services/login-service';
import { jwtInterceptor } from '../services/jwt.interceptor';

const client: ClientResponse = {
  clientId: 42,
  clientType: 'PERSON',
  fullNameOrCompany: 'Client example',
  documentNumber: null,
  email: null,
  phone: null,
  address: null,
  createdAt: '2026-11-01T10:00:00',
  updatedAt: '2026-11-01T10:00:00',
};
const role: RoleResponse = { roleId: 17, name: 'ADMIN', description: 'Administrator' };
const otherRole: RoleResponse = { roleId: 38, name: 'REVIEWER', description: null };
const user: UserResponse = {
  userId: 72,
  roleId: 38,
  roleName: 'REVIEWER',
  fullName: 'Example user',
  email: 'test@example.com',
  status: 'ACTIVE',
  createdAt: '2026-11-01T10:00:00',
  updatedAt: '2026-11-01T10:00:00',
};

describe('Management integration - isolated HTTP transport', () => {
  let http: HttpTestingController;
  let login: {
    currentUser: ReturnType<typeof signal<UserResponse | null>>;
    getAccessToken: ReturnType<typeof vi.fn>;
    clearSession: ReturnType<typeof vi.fn>;
  };
  beforeEach(() => {
    login = {
      currentUser: signal({ ...user, userId: 1, roleId: 17, roleName: 'ADMIN' }),
      getAccessToken: vi.fn(() => 'unit-test-token'),
      clearSession: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
        { provide: LoginService, useValue: login },
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    // La columna Documentos de Clientes se prueba en cliente-document-count.spec.ts.
    http
      .match('/api/clients/document-count')
      .forEach((req) => req.cancelled || req.flush([]));
    http.verify();
  });
  function clients(rows: ClientResponse[] = [client]) {
    const fixture = TestBed.createComponent(ClienteComponent);
    fixture.detectChanges();
    http.expectOne('/api/clients').flush(rows);
    return fixture;
  }
  function users(rows: UserResponse[] = [user]) {
    const fixture = TestBed.createComponent(GestionUsuariosComponent);
    fixture.detectChanges();
    http.expectOne('/api/users').flush(rows);
    http.expectOne('/api/roles').flush([role, otherRole]);
    return fixture;
  }
  function roles(rows: RoleResponse[] = [role, otherRole], people: UserResponse[] = [user]) {
    const fixture = TestBed.createComponent(RolComponent);
    fixture.detectChanges();
    http.expectOne('/api/roles').flush(rows);
    http.expectOne('/api/users').flush(people);
    return fixture;
  }
  it('loads clients once using the existing JWT interceptor', () => {
    const fixture = TestBed.createComponent(ClienteComponent);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    expect(c.loading).toBe(true);
    c.load();
    const req = http.expectOne('/api/clients');
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer unit-test-token');
    req.flush([client]);
    expect(c.clients).toEqual([client]);
    expect(c.loading).toBe(false);
    expect(c.loaded).toBe(true);
  });
  it('filters and paginates only the authorized response', () => {
    const c = clients(
      Array.from({ length: 12 }, (_, i) => ({
        ...client,
        clientId: i + 1,
        fullNameOrCompany: `Client ${i + 1}`,
        clientType: i % 2 ? 'COMPANY' : 'PERSON',
      })),
    ).componentInstance;
    expect(c.paginate(c.filtered)).toHaveLength(5);
    c.page = 3;
    expect(c.paginate(c.filtered)).toHaveLength(2);
    c.filter = 'COMPANY';
    c.resetPage();
    expect(c.filtered).toHaveLength(6);
    c.query = 'Client 2';
    expect(c.filtered).toHaveLength(1);
    http.expectNone((req) => req.url.includes('filter'));
  });
  it('renders an actual empty response without demonstration rows', async () => {
    const f = clients([]);
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('No se encontraron clientes');
    expect(f.nativeElement.textContent).not.toContain('example.com');
  });
  it('creates clients with exactly the request DTO and blocks duplicate submissions', () => {
    const c = clients([]).componentInstance;
    c.openForm();
    c.editing!.fullNameOrCompany = 'New client';
    c.save();
    c.save();
    expect(c.clients).toHaveLength(0);
    expect(c.notice).toBe('');
    const req = http.expectOne('/api/clients');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      clientType: 'PERSON',
      fullNameOrCompany: 'New client',
      documentNumber: null,
      email: null,
      phone: null,
      address: null,
    });
    req.flush({ ...client, fullNameOrCompany: 'New client' });
    expect(c.clients[0].clientId).toBe(42);
    expect(c.editing).toBeNull();
    expect(c.notice).not.toBe('');
  });
  it('fetches the selected client before PUT and excludes response-only fields', () => {
    const c = clients().componentInstance;
    c.openForm(client);
    http.expectOne('/api/clients/42').flush(client);
    c.editing!.fullNameOrCompany = 'Updated';
    c.save();
    const req = http.expectOne('/api/clients/42');
    expect(req.request.method).toBe('PUT');
    expect(Object.keys(req.request.body).sort()).toEqual([
      'address',
      'clientType',
      'documentNumber',
      'email',
      'fullNameOrCompany',
      'phone',
    ]);
    req.flush({ ...client, fullNameOrCompany: 'Updated' });
    expect(c.clients[0].fullNameOrCompany).toBe('Updated');
  });
  it('loads client details and associated cases without fabricating any case', () => {
    const c = clients().componentInstance;
    c.showDetail(client);
    http.expectOne('/api/clients/42').flush(client);
    http
      .expectOne('/api/clients/42/cases')
      .flush([{ caseId: 91, clientId: 42, title: 'Real case response', status: 'OPEN' }]);
    expect(c.selected?.clientId).toBe(42);
    expect(c.clientCases[0].caseId).toBe(91);
    expect(c.busy).toBe(false);
  });
  it('does not show a detail as empty when the cases request fails', () => {
    const c = clients().componentInstance;
    c.showDetail(client);
    http.expectOne('/api/clients/42').flush(client);
    http
      .expectOne('/api/clients/42/cases')
      .flush({ message: 'Cases unavailable' }, { status: 500, statusText: 'Server Error' });
    expect(c.selected).toBeNull();
    expect(c.error).toContain('Cases unavailable');
    expect(c.busy).toBe(false);
  });
  it('keeps the client and confirmation when deletion returns an integrity conflict', () => {
    const c = clients().componentInstance;
    c.confirmRemove(client);
    http.expectNone('/api/clients/42');
    c.remove();
    const req = http.expectOne('/api/clients/42');
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'Client is in use' }, { status: 409, statusText: 'Conflict' });
    expect(c.clients).toHaveLength(1);
    expect(c.pending).not.toBeNull();
    expect(c.notice).toBe('');
    expect(c.error).toContain('Client is in use');
  });
  it('removes clients only after a successful DELETE', () => {
    const c = clients().componentInstance;
    c.confirmRemove(client);
    c.remove();
    expect(c.clients).toHaveLength(1);
    http.expectOne('/api/clients/42').flush(null, { status: 204, statusText: 'No Content' });
    expect(c.clients).toHaveLength(0);
    expect(c.pending).toBeNull();
  });
  it('preserves the client form after failed POST, then allows retry', () => {
    const c = clients([]).componentInstance;
    c.openForm();
    c.editing!.fullNameOrCompany = 'Retry';
    c.save();
    http
      .expectOne('/api/clients')
      .flush({ message: 'Invalid input' }, { status: 400, statusText: 'Bad Request' });
    expect(c.editing?.fullNameOrCompany).toBe('Retry');
    expect(c.busy).toBe(false);
    expect(c.notice).toBe('');
    c.save();
    http.expectOne('/api/clients').flush(client);
    expect(c.clients).toHaveLength(1);
  });
  for (const status of [400, 401, 403, 404, 409, 500]) {
    it(`shows HTTP ${status} without mock fallback and resets loading`, () => {
      const f = TestBed.createComponent(ClienteComponent);
      f.detectChanges();
      http
        .expectOne('/api/clients')
        .flush(
          {
            timestamp: '2026-11-17',
            status,
            error: 'Error',
            message: 'Backend message',
            path: '/api/clients',
          },
          { status, statusText: 'Error' },
        );
      expect(f.componentInstance.error).toContain(`${status}: Backend message`);
      expect(f.componentInstance.clients).toHaveLength(0);
      expect(f.componentInstance.loading).toBe(false);
      expect(f.componentInstance.loaded).toBe(false);
      if (status === 401) expect(login.clearSession).toHaveBeenCalled();
    });
  }
  it('handles connection failures and retries the real source', () => {
    const f = TestBed.createComponent(ClienteComponent);
    f.detectChanges();
    http.expectOne('/api/clients').error(new ProgressEvent('error'));
    expect(f.componentInstance.error).not.toBe('');
    expect(f.componentInstance.loading).toBe(false);
    f.componentInstance.load();
    http.expectOne('/api/clients').flush([]);
    expect(f.componentInstance.error).toBe('');
  });
  it('combines user filters with actual role identifiers', () => {
    const c = users([
      user,
      { ...user, userId: 73, roleId: 17, roleName: 'ADMIN', status: 'INACTIVE' },
    ]).componentInstance;
    expect(c.activeCount).toBe(1);
    expect(c.inactiveCount).toBe(1);
    c.secondaryFilter = '38';
    c.filter = 'ACTIVE';
    c.query = 'example';
    expect(c.filtered).toEqual([user]);
  });
  it('edits only the user name and preserves the identity email', async () => {
    const f = users();
    const c = f.componentInstance;
    c.openForm(user);
    http.expectOne('/api/users/72').flush(user);
    await f.whenStable();
    const email = f.nativeElement.querySelector('input[name="email"]');
    expect(email.readOnly).toBe(true);
    expect(f.nativeElement.querySelector('select[name="roleId"]')).toBeNull();
    expect(f.nativeElement.querySelector('select[name="status"]')).toBeNull();
    c.editing!.fullName = 'Updated name';
    c.save();
    const req = http.expectOne('/api/users/72');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ fullName: 'Updated name', email: 'test@example.com' });
    req.flush({ ...user, fullName: 'Updated name' });
    expect(c.users[0].fullName).toBe('Updated name');
  });
  it('fetches real user detail', () => {
    const c = users().componentInstance;
    c.showDetail(user);
    http.expectOne('/api/users/72').flush(user);
    expect(c.selected).toEqual(user);
  });
  it('blocks deactivation of ADMIN, self and inactive accounts', () => {
    const c = users().componentInstance;
    for (const value of [
      { ...user, roleName: 'ADMIN' },
      { ...user, userId: 1 },
      { ...user, status: 'INACTIVE' },
    ]) {
      expect(c.canDeactivate(value)).toBe(false);
      c.confirmDeactivate(value);
      expect(c.pending).toBeNull();
    }
    http.expectNone('/api/users/72');
  });
  it('requires confirmation and reloads after logical user deactivation', () => {
    const c = users().componentInstance;
    c.confirmDeactivate(user);
    http.expectNone('/api/users/72');
    c.deactivate();
    const req = http.expectOne('/api/users/72');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    http
      .expectOne('/api/users')
      .flush([{ ...user, status: 'INACTIVE', updatedAt: '2026-11-17T09:00:00' }]);
    expect(c.users[0].status).toBe('INACTIVE');
    expect(c.notice).not.toBe('');
    expect(c.pending).toBeNull();
  });
  it('does not turn failed administrative loads into empty success', () => {
    const f = TestBed.createComponent(GestionUsuariosComponent);
    f.detectChanges();
    http.expectOne('/api/roles').flush([role]);
    http
      .expectOne('/api/users')
      .flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    expect(f.componentInstance.loaded).toBe(false);
    expect(f.componentInstance.error).toContain('403');
  });
  it('counts actual users including inactive users per role', () => {
    const c = roles(
      [role, otherRole],
      [user, { ...user, userId: 74, status: 'INACTIVE' }],
    ).componentInstance;
    expect(c.count(otherRole)).toBe(2);
    expect(c.count(role)).toBe(0);
    expect(c.lockedName(otherRole)).toBe(true);
    expect(c.canRemove(otherRole)).toBe(false);
    expect(c.canRemove(role)).toBe(false);
  });
  it('does not invent zero role counts when users cannot be loaded', () => {
    const f = TestBed.createComponent(RolComponent);
    f.detectChanges();
    http.expectOne('/api/roles').flush([otherRole]);
    http
      .expectOne('/api/users')
      .flush({ message: 'Unavailable' }, { status: 500, statusText: 'Server Error' });
    const c = f.componentInstance;
    expect(c.roles).toHaveLength(1);
    expect(c.count(otherRole)).toBeNull();
    expect(c.lockedName(otherRole)).toBe(true);
    expect(c.canRemove(otherRole)).toBe(false);
  });
  it('creates roles with only name and description, using the returned ID', () => {
    const c = roles().componentInstance;
    c.openForm();
    c.editing!.name = 'READER';
    c.editing!.description = 'Review';
    c.save();
    const req = http.expectOne('/api/roles');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'READER', description: 'Review' });
    req.flush({ roleId: 91, name: 'READER', description: 'Review' });
    expect(c.selected?.roleId).toBe(91);
    expect(c.editing).toBeNull();
  });
  it('loads role detail and persists description edits', () => {
    const c = roles().componentInstance;
    c.showDetail(role);
    http.expectOne('/api/roles/17').flush(role);
    expect(c.detail).toBe(true);
    c.openForm(role);
    http.expectOne('/api/roles/17').flush(role);
    expect(c.lockedName(c.editing!)).toBe(true);
    c.editing!.description = 'New description';
    c.save();
    const req = http.expectOne('/api/roles/17');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ name: 'ADMIN', description: 'New description' });
    req.flush({ ...role, description: 'New description' });
    expect(c.selected?.description).toBe('New description');
  });
  it('preserves a role and its form when backend rejects a duplicate', () => {
    const c = roles().componentInstance;
    c.openForm();
    c.editing!.name = 'ADMIN';
    c.save();
    http
      .expectOne('/api/roles')
      .flush({ message: 'Reserved role' }, { status: 409, statusText: 'Conflict' });
    expect(c.roles).toHaveLength(2);
    expect(c.editing).not.toBeNull();
    expect(c.notice).toBe('');
  });
  it('allows deleting only unassigned non-fundamental roles after confirmation', () => {
    const c = roles([role, otherRole], []).componentInstance;
    c.confirmRemove(role);
    expect(c.pending).toBeNull();
    c.confirmRemove(otherRole);
    http.expectNone('/api/roles/38');
    c.remove();
    const req = http.expectOne('/api/roles/38');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(c.roles).toEqual([role]);
  });
  it('retains an unassigned role if a concurrent assignment causes DELETE 409', () => {
    const c = roles([otherRole], []).componentInstance;
    c.confirmRemove(otherRole);
    c.remove();
    http
      .expectOne('/api/roles/38')
      .flush({ message: 'Role is now assigned' }, { status: 409, statusText: 'Conflict' });
    expect(c.roles).toHaveLength(1);
    expect(c.pending).not.toBeNull();
    expect(c.notice).toBe('');
  });
  it('cancels in-flight loads on component destruction', () => {
    const f = TestBed.createComponent(ClienteComponent);
    f.detectChanges();
    const req = http.expectOne('/api/clients');
    f.destroy();
    expect(req.cancelled).toBe(true);
  });
  it('opens and closes the client modal through actual DOM events', async () => {
    const f = clients();
    await f.whenStable();
    f.nativeElement.querySelector('header button').click();
    await f.whenStable();
    expect(f.nativeElement.querySelector('[role="dialog"]')).toBeTruthy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await f.whenStable();
    expect(f.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });
  it('renders static verified permission requirements with no permission controls', async () => {
    const f = roles();
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('ROLE_ADMIN');
    expect(f.nativeElement.querySelector('input[type="checkbox"]')).toBeNull();
    expect(f.nativeElement.textContent).not.toContain('Datos de demostraci');
  });
});
