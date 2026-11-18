import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { AuditoriaComponent, csvCell } from './auditoria-component';
import { AuditLogResponse } from '../../models/auditoria';
import { UserResponse } from '../../models/management';
import { LoginService } from '../../services/login-service';
import { jwtInterceptor } from '../../services/jwt.interceptor';

const log: AuditLogResponse = {
  logId: 900,
  userId: 72,
  action: 'UPLOAD_DOCUMENT',
  entityType: 'Documento',
  entityId: 31,
  details: 'caseId=5; fileName=contrato.pdf',
  createdAt: '2026-11-18T10:00:00',
};
const user: UserResponse = {
  userId: 72,
  roleId: 2,
  roleName: 'USER',
  fullName: 'Ana Torres',
  email: 'ana@example.com',
  status: 'ACTIVE',
  createdAt: '2026-11-01T10:00:00',
  updatedAt: '2026-11-01T10:00:00',
};

function page(
  content: AuditLogResponse[],
  number = 0,
  totalElements = content.length,
  totalPages = 1,
) {
  return { content, number, size: 20, totalElements, totalPages };
}

describe('AuditoriaComponent - transporte HTTP aislado', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
        {
          provide: LoginService,
          useValue: {
            currentUser: signal(null),
            getAccessToken: vi.fn(() => 'unit-test-token'),
            clearSession: vi.fn(),
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const logsRequest = () => http.expectOne((req) => req.url === '/api/audit-logs');

  function mount(rows: AuditLogResponse[] = [log], users: UserResponse[] = [user]) {
    const fixture = TestBed.createComponent(AuditoriaComponent);
    fixture.detectChanges();
    logsRequest().flush(page(rows));
    http.expectOne('/api/users').flush(users);
    return fixture;
  }

  it('consulta la primera página ordenada y con el token JWT', () => {
    const fixture = TestBed.createComponent(AuditoriaComponent);
    fixture.detectChanges();
    const req = logsRequest();
    expect(req.request.headers.get('Authorization')).toBe('Bearer unit-test-token');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('20');
    expect(req.request.params.getAll('sort')).toEqual(['createdAt,desc', 'logId,desc']);
    expect(req.request.params.has('userId')).toBe(false);
    req.flush(page([log]));
    http.expectOne('/api/users').flush([user]);
    const c = fixture.componentInstance;
    expect(c.result.content).toEqual([log]);
    expect(c.userLabel(log)).toBe('Ana Torres');
    expect(c.userEmail(log)).toBe('ana@example.com');
  });

  it('prefiere el nombre del DTO cuando el backend lo incluye', () => {
    const c = mount([], []).componentInstance;
    expect(c.userLabel({ ...log, userFullName: 'Desde DTO' })).toBe('Desde DTO');
    expect(c.userLabel(log)).toBe('Usuario #72');
  });

  it('sigue funcionando si la lista de usuarios falla', () => {
    const fixture = TestBed.createComponent(AuditoriaComponent);
    fixture.detectChanges();
    logsRequest().flush(page([log]));
    http.expectOne('/api/users').flush(null, { status: 500, statusText: 'Error' });
    const c = fixture.componentInstance;
    expect(c.error).toBe('');
    expect(c.usersAvailable).toBe(false);
    expect(c.result.content).toEqual([log]);
  });

  it('envía los filtros con el formato que espera el backend', () => {
    const c = mount().componentInstance;
    c.form = {
      userId: 72,
      action: ' upload_document ',
      entityType: 'Documento',
      from: '2026-11-01',
      to: '2026-11-18',
    };
    c.search();
    const req: TestRequest = logsRequest();
    const p = req.request.params;
    expect(p.get('userId')).toBe('72');
    expect(p.get('action')).toBe('UPLOAD_DOCUMENT');
    expect(p.get('entityType')).toBe('Documento');
    expect(p.get('from')).toBe('2026-11-01T00:00:00');
    expect(p.get('to')).toBe('2026-11-18T23:59:59');
    expect(p.get('page')).toBe('0');
    req.flush(page([log]));
    expect(c.activeFilters).toBe(5);
  });

  it('valida el rango de fechas sin llamar al servidor', () => {
    const c = mount().componentInstance;
    c.form = { ...c.form, from: '2026-11-18', to: '2026-11-01' };
    c.search();
    expect(c.formError).toContain('no puede ser posterior');
    http.expectNone((req) => req.url === '/api/audit-logs');
  });

  it('pagina en el servidor y no sale de los límites', () => {
    const fixture = TestBed.createComponent(AuditoriaComponent);
    fixture.detectChanges();
    logsRequest().flush(page([log], 0, 45, 3));
    http.expectOne('/api/users').flush([user]);
    const c = fixture.componentInstance;
    expect(c.firstRow).toBe(1);
    c.goTo(-1);
    http.expectNone((req) => req.url === '/api/audit-logs');
    c.goTo(1);
    const req = logsRequest();
    expect(req.request.params.get('page')).toBe('1');
    req.flush(page([{ ...log, logId: 880 }], 1, 45, 3));
    expect(c.result.number).toBe(1);
    expect(c.firstRow).toBe(21);
    c.goTo(3);
    http.expectNone((r) => r.url === '/api/audit-logs');
  });

  it('limpia los filtros y vuelve a la primera página', () => {
    const c = mount().componentInstance;
    c.form.entityType = 'Cliente';
    c.search();
    logsRequest().flush(page([]));
    c.clear();
    const req = logsRequest();
    expect(req.request.params.has('entityType')).toBe(false);
    req.flush(page([log]));
    expect(c.activeFilters).toBe(0);
  });

  it('abre el detalle desde el servidor y filtra por ese usuario', () => {
    const c = mount().componentInstance;
    c.showDetail(log);
    http.expectOne('/api/audit-logs/900').flush(log);
    expect(c.selected).toEqual(log);
    c.filterByUser(72);
    expect(c.selected).toBeNull();
    const req = logsRequest();
    expect(req.request.params.get('userId')).toBe('72');
    req.flush(page([log]));
  });

  it('muestra el error 403 del servidor sin datos inventados', async () => {
    const fixture = TestBed.createComponent(AuditoriaComponent);
    fixture.detectChanges();
    logsRequest().flush(
      { message: 'No tiene autorizacion para realizar esta operacion' },
      { status: 403, statusText: 'Forbidden' },
    );
    http.match('/api/users').forEach((r) => expect(r.cancelled).toBe(true));
    await fixture.whenStable();
    expect(fixture.componentInstance.error).toBe(
      '403: No tiene autorizacion para realizar esta operacion',
    );
    expect(fixture.componentInstance.result.content).toEqual([]);
  });

  it('renderiza un vacío real según haya filtros o no', async () => {
    const f = mount([]);
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('Todavía no hay registros de auditoría');
  });

  it('escapa celdas CSV y neutraliza fórmulas', () => {
    expect(csvCell('texto "citado"')).toBe('"texto ""citado"""');
    expect(csvCell('=SUMA(A1)')).toBe(`"'=SUMA(A1)"`);
    expect(csvCell('-5')).toBe(`"'-5"`);
    expect(csvCell(42)).toBe('"42"');
  });

  it('exporta la página visible a un archivo CSV', () => {
    const c = mount().componentInstance;
    const createUrl = vi.fn(() => 'blob:csv');
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: vi.fn() }),
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    c.exportCsv();
    expect(createUrl).toHaveBeenCalledTimes(1);
    const blob = (createUrl.mock.calls[0] as unknown[])[0] as Blob;
    expect(blob.type).toContain('text/csv');
    expect(click).toHaveBeenCalled();
    click.mockRestore();
    vi.unstubAllGlobals();
  });
});
