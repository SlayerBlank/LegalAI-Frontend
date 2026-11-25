import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuditLogResponse } from '../../../models/auditoria';
import { AuditoriaPorAccionComponent, activeCriteria } from './auditoria-por-accion';

const SEARCH = '/api/audit-logs/advanced-search';
const USERS = '/api/users';

function log(logId: number, action: string): AuditLogResponse {
  return {
    logId,
    userId: 3,
    action,
    entityType: 'Documento',
    entityId: logId,
    details: null,
    createdAt: '2026-11-01T10:00:00',
  };
}

const logs = [log(1, 'UPLOAD_DOCUMENT'), log(2, 'LOGIN'), log(3, 'UPLOAD_DOCUMENT'), log(4, 'CUSTOM')];

describe('AuditoriaPorAccionComponent (HU-133)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem('legalai-language');
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  function mount(usersFail = false) {
    const f = TestBed.createComponent(AuditoriaPorAccionComponent);
    f.detectChanges();
    const users = http.expectOne(USERS);
    if (usersFail) users.flush(null, { status: 500, statusText: 'Error' });
    else users.flush([{ userId: 3, fullName: 'Ana Garcia' }]);
    f.detectChanges();
    return f;
  }

  it('cuenta los criterios como el backend (from y to por separado)', () => {
    expect(activeCriteria({ userId: null, action: ' ', entityType: '', from: '', to: '' })).toBe(0);
    expect(activeCriteria({ userId: 3, action: '', entityType: '', from: '2026-01-01', to: '' })).toBe(2);
    expect(activeCriteria({ userId: null, action: '', entityType: '', from: '2026-01-01', to: '2026-02-01' })).toBe(2);
  });

  it('CA-01: con dos filtros consulta advanced-search y agrupa por acción', () => {
    const f = mount();
    const c = f.componentInstance;
    c.userId.set(3);
    c.entityType.set('Documento');
    c.apply();
    const req = http.expectOne((r) => r.url === SEARCH);
    expect(req.request.params.get('userId')).toBe('3');
    expect(req.request.params.get('entityType')).toBe('Documento');
    expect(req.request.params.get('page')).toBe('0');
    req.flush({ content: logs, number: 0, size: 500, totalElements: 4, totalPages: 1 });
    f.detectChanges();
    expect(c.rows().map((r) => [r.label, r.count])).toEqual([
      ['Subir documento', 2],
      ['CUSTOM', 1],
      ['Inicio de sesión', 1],
    ]);
    expect(f.nativeElement.querySelector('canvas')).not.toBeNull();
    expect(c.truncated()).toBe(false);
  });

  it('recorre todas las páginas del servidor (formato VIA_DTO)', () => {
    const f = mount();
    const c = f.componentInstance;
    c.from.set('2026-01-01');
    c.to.set('2026-12-31');
    c.apply();
    const first = http.expectOne((r) => r.url === SEARCH && r.params.get('page') === '0');
    expect(first.request.params.get('from')).toBe('2026-01-01');
    first.flush({ content: logs.slice(0, 2), page: { number: 0, size: 2, totalElements: 4, totalPages: 2 } });
    http
      .expectOne((r) => r.url === SEARCH && r.params.get('page') === '1')
      .flush({ content: logs.slice(2), page: { number: 1, size: 2, totalElements: 4, totalPages: 2 } });
    expect(c.query.data().length).toBe(4);
    expect(c.serverTotal()).toBe(4);
  });

  it('CA-02: con menos de dos filtros indica el error y no consulta', () => {
    const f = mount();
    const c = f.componentInstance;
    c.action.set('LOGIN');
    c.apply();
    f.detectChanges();
    http.expectNone((r) => r.url === SEARCH);
    expect(f.nativeElement.querySelector('.filter-error').textContent).toContain(
      'al menos dos criterios',
    );
    expect(f.nativeElement.textContent).toContain('Criterios activos: 1');
  });

  it('sin eventos para los filtros muestra el vacío; limpiar vuelve al inicio', () => {
    const f = mount();
    const c = f.componentInstance;
    c.action.set('LOGIN');
    c.entityType.set('Usuario');
    c.apply();
    http.expectOne((r) => r.url === SEARCH).flush({ content: [], totalElements: 0, totalPages: 0 });
    f.detectChanges();
    expect(c.query.empty()).toBe(true);
    expect(f.nativeElement.textContent).toContain('No hay datos para los filtros seleccionados');
    c.clear();
    expect(c.query.status()).toBe('idle');
  });

  it('si /users falla permite escribir el identificador', () => {
    const f = mount(true);
    expect(f.nativeElement.querySelector('input[name="userId"]')).not.toBeNull();
    f.componentInstance.setUserId('12');
    expect(f.componentInstance.userId()).toBe(12);
    f.componentInstance.setUserId('abc');
    expect(f.componentInstance.userId()).toBeNull();
  });
});
