import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { AuditoriaComponent } from './auditoria-component';
import { AuditLogResponse } from '../../models/auditoria';
import { UserResponse } from '../../models/management';
import { AuditoriaService } from '../../services/auditoria-service';
import { LoginService } from '../../services/login-service';
import { jwtInterceptor } from '../../services/jwt.interceptor';

/** HU-121: auditoría de un usuario con GET /api/audit-logs/usuario/{userId}. */
const older: AuditLogResponse = {
  logId: 10,
  userId: 72,
  action: 'LOGIN',
  entityType: 'Usuario',
  entityId: 72,
  details: null,
  createdAt: '2026-11-01T08:00:00',
};
const newer: AuditLogResponse = {
  ...older,
  logId: 11,
  action: 'UPLOAD_DOCUMENT',
  entityType: 'Documento',
  entityId: 31,
  details: 'fileName=contrato.pdf',
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
const emptyPage = { content: [], number: 0, size: 20, totalElements: 0, totalPages: 0 };

describe('Auditoría de un usuario (HU-121)', () => {
  let http: HttpTestingController;
  let queryUserId: string | null;

  beforeEach(() => {
    queryUserId = null;
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
        {
          provide: ActivatedRoute,
          useFactory: () => ({
            snapshot: {
              queryParamMap: convertToParamMap(queryUserId ? { userId: queryUserId } : {}),
            },
          }),
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function mount() {
    const fixture = TestBed.createComponent(AuditoriaComponent);
    fixture.detectChanges();
    http.expectOne((req) => req.url === '/api/audit-logs').flush(emptyPage);
    http.expectOne('/api/users').flush([user]);
    return fixture;
  }

  it('el servicio ordena los eventos del más reciente al más antiguo', () => {
    let result: AuditLogResponse[] = [];
    TestBed.inject(AuditoriaService)
      .byUser(72)
      .subscribe((logs) => (result = logs));
    const req = http.expectOne('/api/audit-logs/usuario/72');
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer unit-test-token');
    req.flush([older, newer]);
    expect(result.map((l) => l.logId)).toEqual([11, 10]);
  });

  it('abre la actividad desde el detalle de un evento y la muestra en una tabla', async () => {
    const f = mount();
    const c = f.componentInstance;
    c.showDetail(newer);
    http.expectOne('/api/audit-logs/11').flush(newer);
    c.showActivity(72);
    expect(c.selected).toBeNull();
    expect(c.activity).toEqual({ userId: 72, logs: null });
    http.expectOne('/api/audit-logs/usuario/72').flush([newer, older]);
    await f.whenStable();
    f.detectChanges();
    const dialog: HTMLElement = f.nativeElement.querySelector('.activity-dialog');
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.textContent).toContain('Actividad de Ana Torres');
    expect(dialog.textContent).toContain('2 eventos');
    expect(dialog.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(dialog.querySelector('tbody tr')?.textContent).toContain('Subir documento');
    c.close();
    expect(c.activity).toBeNull();
  });

  it('indica que no hay registros cuando el usuario no tiene eventos', async () => {
    const f = mount();
    f.componentInstance.showActivity(72);
    http.expectOne('/api/audit-logs/usuario/72').flush([]);
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.querySelector('.activity-dialog').textContent).toContain(
      'Este usuario no tiene eventos de auditoría.',
    );
  });

  it('muestra el error del servidor y permite reintentar', async () => {
    const f = mount();
    const c = f.componentInstance;
    c.showActivity(999);
    http
      .expectOne('/api/audit-logs/usuario/999')
      .flush({ message: 'Usuario no encontrado' }, { status: 404, statusText: 'Not Found' });
    await f.whenStable();
    f.detectChanges();
    expect(c.error).toBe('404: Usuario no encontrado');
    const alert: HTMLElement = f.nativeElement.querySelector('.activity-dialog [role="alert"]');
    expect(alert.textContent).toContain('Usuario no encontrado');
    alert.querySelector('button')!.click();
    http.expectOne('/api/audit-logs/usuario/999').flush([]);
    expect(c.error).toBe('');
    expect(c.activity?.logs).toEqual([]);
  });

  it('abre la actividad directamente con ?userId desde Gestión de usuarios', () => {
    queryUserId = '72';
    const fixture = TestBed.createComponent(AuditoriaComponent);
    fixture.detectChanges();
    http.expectOne((req) => req.url === '/api/audit-logs').flush(emptyPage);
    http.expectOne('/api/users').flush([user]);
    http.expectOne('/api/audit-logs/usuario/72').flush([older]);
    expect(fixture.componentInstance.activity).toEqual({ userId: 72, logs: [older] });
  });

  it('ignora un userId inválido en la URL', () => {
    queryUserId = 'abc';
    mount();
    http.expectNone((req) => req.url.startsWith('/api/audit-logs/usuario/'));
  });
});
