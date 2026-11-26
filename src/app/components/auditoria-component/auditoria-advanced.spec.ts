import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { AuditoriaComponent } from './auditoria-component';
import { AuditLogResponse } from '../../models/auditoria';
import { LoginService } from '../../services/login-service';
import { jwtInterceptor } from '../../services/jwt.interceptor';

const log: AuditLogResponse = {
  logId: 900,
  userId: 72,
  action: 'UPLOAD_DOCUMENT',
  entityType: 'Documento',
  entityId: 31,
  details: null,
  createdAt: '2026-11-18T10:00:00',
};

function page(content: AuditLogResponse[], number = 0, totalElements = 1, totalPages = 1) {
  return { content, number, size: 20, totalElements, totalPages };
}

describe('Auditoría: búsqueda avanzada con filtros combinados (HU-131)', () => {
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

  const advanced = () => http.expectOne((r) => r.url === '/api/audit-logs/advanced-search');

  function mount() {
    const fixture = TestBed.createComponent(AuditoriaComponent);
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/audit-logs').flush(page([log]));
    http.expectOne('/api/users').flush([]);
    fixture.detectChanges();
    return fixture;
  }

  it('cuenta los criterios como el backend: from y to por separado', () => {
    const c = mount().componentInstance;
    const empty = { userId: null, action: '', entityType: '', from: '', to: '' };
    expect(c.criteriaCount(empty)).toBe(0);
    expect(c.criteriaCount({ ...empty, action: '   ' })).toBe(0);
    expect(c.criteriaCount({ ...empty, from: '2026-11-01', to: '2026-11-30' })).toBe(2);
    expect(c.criteriaCount({ ...empty, userId: 72, entityType: 'Documento' })).toBe(2);
  });

  it('exige al menos dos criterios sin llamar a la API', () => {
    const c = mount().componentInstance;
    c.setAdvanced(true);
    c.form = { ...c.form, action: 'LOGIN' };
    c.search();
    http.expectNone((r) => r.url.startsWith('/api/audit-logs'));
    expect(c.formError).toBe('La búsqueda avanzada necesita al menos dos criterios (tienes 1).');
  });

  it('valida el rango de fechas sin llamar a la API', () => {
    const c = mount().componentInstance;
    c.setAdvanced(true);
    c.form = { ...c.form, from: '2026-11-30', to: '2026-11-01' };
    c.search();
    http.expectNone((r) => r.url.startsWith('/api/audit-logs'));
    expect(c.formError).toBe('La fecha “desde” no puede ser posterior a la fecha “hasta”.');
  });

  it('envía los filtros combinados con fechas LocalDate y pagina en el servidor', () => {
    const f = mount();
    const c = f.componentInstance;
    c.setAdvanced(true);
    c.form = {
      userId: 72,
      action: ' upload_document ',
      entityType: '',
      from: '2026-11-01',
      to: '2026-11-30',
    };
    c.search();
    const req = advanced();
    expect(req.request.headers.get('Authorization')).toBe('Bearer unit-test-token');
    expect(req.request.params.get('userId')).toBe('72');
    expect(req.request.params.get('action')).toBe('UPLOAD_DOCUMENT');
    expect(req.request.params.has('entityType')).toBe(false);
    expect(req.request.params.get('from')).toBe('2026-11-01');
    expect(req.request.params.get('to')).toBe('2026-11-30');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('20');
    req.flush({ content: [log], page: { number: 0, size: 20, totalElements: 45, totalPages: 3 } });
    f.detectChanges();
    expect(c.result.totalElements).toBe(45);
    expect(f.nativeElement.textContent).toContain('Mostrando resultados de la búsqueda avanzada.');
    c.goTo(1);
    const next = advanced();
    expect(next.request.params.get('page')).toBe('1');
    next.flush(page([log], 1, 45, 3));
    expect(c.result.number).toBe(1);
  });

  it('muestra el error 400 del backend', () => {
    const c = mount().componentInstance;
    c.setAdvanced(true);
    c.form = { ...c.form, userId: 72, entityType: 'Documento' };
    c.search();
    advanced().flush(
      { message: 'Proporcione al menos dos filtros entre userId, action, entityType, from y to' },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(c.error).toContain('400: Proporcione al menos dos filtros');
  });

  it('al salir del modo avanzado vuelve a la búsqueda normal', () => {
    const c = mount().componentInstance;
    c.setAdvanced(true);
    c.form = { ...c.form, userId: 72, entityType: 'Documento' };
    c.search();
    advanced().flush(page([log]));
    c.setAdvanced(false);
    const normal = http.expectOne((r) => r.url === '/api/audit-logs');
    expect(normal.request.params.get('userId')).toBe('72');
    normal.flush(page([log]));
    expect(c.appliedAdvanced).toBe(false);
  });
});
