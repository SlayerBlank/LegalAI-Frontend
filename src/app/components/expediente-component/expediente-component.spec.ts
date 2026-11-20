import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { ExpedienteComponent } from './expediente-component';
import { CaseResponse } from '../../models/expediente';
import { ClientResponse } from '../../models/management';
import { LoginService } from '../../services/login-service';
import { jwtInterceptor } from '../../services/jwt.interceptor';

const client: ClientResponse = {
  clientId: 3,
  clientType: 'PERSON',
  fullNameOrCompany: 'Ana Torres',
  documentNumber: null,
  email: null,
  phone: null,
  address: null,
  createdAt: '2026-10-01T09:00:00',
  updatedAt: '2026-10-01T09:00:00',
};
const open: CaseResponse = {
  caseId: 7,
  clientId: 3,
  title: 'Demanda laboral',
  description: 'Despido arbitrario',
  status: 'OPEN',
  openedAt: '2026-11-01',
  closedAt: null,
  createdAt: '2026-11-01T10:00:00',
  updatedAt: '2026-11-01T10:00:00',
};
const closed: CaseResponse = {
  ...open,
  caseId: 8,
  clientId: 4,
  title: 'Contrato de alquiler',
  description: null,
  status: 'CLOSED',
  closedAt: '2026-11-15',
};

describe('ExpedienteComponent - transporte HTTP aislado', () => {
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
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function mount(cases: CaseResponse[] = [open, closed]) {
    const fixture = TestBed.createComponent(ExpedienteComponent);
    fixture.detectChanges();
    const list = http.expectOne('/api/cases');
    expect(list.request.headers.get('Authorization')).toBe('Bearer unit-test-token');
    list.flush(cases);
    http.expectOne('/api/clients').flush([client]);
    http
      .expectOne('/api/cases/chat-session-count')
      .flush([{ caseId: 7, tituloExpediente: 'Demanda laboral', cantidadSesiones: 2 }]);
    fixture.detectChanges();
    return fixture;
  }

  it('carga expedientes, clientes y conteo de sesiones reales', () => {
    const f = mount();
    const c = f.componentInstance;
    expect(c.loaded()).toBe(true);
    expect(c.cases().length).toBe(2);
    expect(c.count('OPEN', 'IN_PROGRESS')).toBe(1);
    expect(c.clientName(3)).toBe('Ana Torres');
    expect(c.clientName(4)).toBe('Cliente #4');
    expect(c.sessionsOf(7)).toBe('2');
    expect(c.sessionsOf(8)).toBe('0');
    expect(f.nativeElement.textContent).toContain('Demanda laboral');
  });

  it('muestra el estado vacío sin datos ficticios', () => {
    const f = mount([]);
    expect(f.nativeElement.textContent).toContain('Todavía no tienes expedientes');
  });

  it('no asume cero sesiones si falla el conteo', () => {
    const fixture = TestBed.createComponent(ExpedienteComponent);
    fixture.detectChanges();
    http.expectOne('/api/cases').flush([open]);
    http.expectOne('/api/clients').flush([client]);
    http
      .expectOne('/api/cases/chat-session-count')
      .flush(null, { status: 500, statusText: 'Error' });
    expect(fixture.componentInstance.sessionsOf(7)).toBe('—');
  });

  it('busca y filtra por cliente localmente sobre la respuesta', () => {
    const c = mount().componentInstance;
    c.setQuery('ana torres');
    expect(c.filtered().map((x) => x.caseId)).toEqual([7]);
    c.setQuery('');
    c.setClientFilter('4');
    expect(c.filtered().map((x) => x.caseId)).toEqual([8]);
  });

  it('aplica los filtros soportados por el backend y valida el rango', () => {
    const c = mount().componentInstance;
    c.filterForm.setValue({ status: 'CLOSED', openedFrom: '2026-12-01', openedTo: '2026-01-01' });
    c.applyFilters();
    http.expectNone((r) => r.url === '/api/cases');
    expect(c.filterForm.hasError('range')).toBe(true);

    c.filterForm.setValue({ status: 'CLOSED', openedFrom: '2026-01-01', openedTo: '' });
    c.applyFilters();
    const req = http.expectOne((r) => r.url === '/api/cases');
    expect(req.request.params.get('status')).toBe('CLOSED');
    expect(req.request.params.get('openedFrom')).toBe('2026-01-01');
    expect(req.request.params.has('openedTo')).toBe(false);
    req.flush([closed]);
    expect(c.cases()).toEqual([closed]);
    expect(c.hasServerFilters()).toBe(true);

    c.clearFilters();
    const all = http.expectOne((r) => r.url === '/api/cases');
    expect(all.request.params.keys()).toEqual([]);
    all.flush([open, closed]);
  });

  it('crea con el cuerpo exacto del DTO y bloquea envíos duplicados', () => {
    const c = mount().componentInstance;
    c.openForm();
    c.save();
    http.expectNone('/api/cases');
    expect(c.form.invalid).toBe(true);

    c.form.patchValue({ clientId: 3, title: '  Nuevo caso  ', description: '   ' });
    c.save();
    c.save();
    const req = http.expectOne((r) => r.method === 'POST');
    expect(req.request.body).toEqual({
      clientId: 3,
      title: 'Nuevo caso',
      description: null,
      status: 'OPEN',
      openedAt: null,
      closedAt: null,
    });
    req.flush({ ...open, caseId: 9, title: 'Nuevo caso' });
    expect(c.cases()[0].caseId).toBe(9);
    expect(c.editing()).toBeNull();
    expect(c.notice()).toBe('Expediente guardado correctamente.');
  });

  it('solo habilita la fecha de cierre en CLOSED/ARCHIVED y valida el orden', () => {
    const c = mount().componentInstance;
    c.openForm();
    expect(c.form.controls.closedAt.disabled).toBe(true);
    c.form.patchValue({ clientId: 3, title: 'X', status: 'CLOSED', openedAt: '2026-11-10' });
    expect(c.form.controls.closedAt.enabled).toBe(true);
    c.form.controls.closedAt.setValue('2026-11-01');
    expect(c.form.hasError('closedBeforeOpened')).toBe(true);
    c.form.controls.status.setValue('IN_PROGRESS');
    expect(c.form.controls.closedAt.disabled).toBe(true);
    expect(c.form.valid).toBe(true);
  });

  it('edita consultando el detalle y actualiza con PUT', () => {
    const c = mount().componentInstance;
    c.openForm(closed);
    http.expectOne('/api/cases/8').flush(closed);
    expect(c.form.controls.closedAt.value).toBe('2026-11-15');
    c.form.patchValue({ title: 'Contrato renovado' });
    c.save();
    const req = http.expectOne((r) => r.method === 'PUT');
    expect(req.request.url).toBe('/api/cases/8');
    expect(req.request.body).toMatchObject({
      clientId: 4,
      title: 'Contrato renovado',
      status: 'CLOSED',
      closedAt: '2026-11-15',
    });
    req.flush({ ...closed, title: 'Contrato renovado' });
    expect(c.cases().find((x) => x.caseId === 8)?.title).toBe('Contrato renovado');
  });

  it('muestra el mensaje del servidor y mantiene el formulario abierto ante 400', () => {
    const c = mount().componentInstance;
    c.openForm();
    c.form.patchValue({ clientId: 3, title: 'Caso' });
    c.save();
    http
      .expectOne((r) => r.method === 'POST')
      .flush(
        { status: 400, message: 'Un expediente abierto no puede tener fecha de cierre' },
        { status: 400, statusText: 'Bad Request' },
      );
    expect(c.editing()).toBe('new');
    expect(c.error()).toBe('400: Un expediente abierto no puede tener fecha de cierre');
  });

  it('elimina tras confirmar y conserva el registro ante un 409', () => {
    const c = mount().componentInstance;
    c.confirmRemove(open);
    expect(c.pending()).toBe(open);
    c.remove();
    http
      .expectOne((r) => r.method === 'DELETE')
      .flush({ message: 'Conflicto de integridad' }, { status: 409, statusText: 'Conflict' });
    expect(c.cases().length).toBe(2);
    expect(c.error()).toBe('409: Conflicto de integridad');

    c.remove();
    http
      .expectOne((r) => r.method === 'DELETE')
      .flush(null, { status: 204, statusText: 'No Content' });
    expect(c.cases().map((x) => x.caseId)).toEqual([8]);
    expect(c.pending()).toBeNull();
  });

  it('abre Documentos y Chat IA con el expediente como parámetro', () => {
    const c = mount().componentInstance;
    const router = TestBed.inject(Router);
    c.openChat(open);
    expect(router.navigate).toHaveBeenCalledWith(['/chat-ia'], { queryParams: { caseId: 7 } });
    c.openDocuments(open);
    expect(router.navigate).toHaveBeenCalledWith(['/documentos'], { queryParams: { caseId: 7 } });
  });

  it('formatea fechas LocalDate sin desplazarlas por la zona horaria', () => {
    const c = mount().componentInstance;
    expect(c.day('2026-11-01')).toBe('01/11/2026');
    expect(c.day(null)).toBe('—');
  });
});
