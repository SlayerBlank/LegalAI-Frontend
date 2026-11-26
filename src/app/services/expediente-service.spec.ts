import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ExpedienteService } from './expediente-service';
import { CaseRequest, CaseResponse } from '../models/expediente';

const legalCase: CaseResponse = {
  caseId: 7,
  clientId: 3,
  title: 'Demanda laboral',
  description: null,
  status: 'OPEN',
  openedAt: '2026-11-01',
  closedAt: null,
  createdAt: '2026-11-01T10:00:00',
  updatedAt: '2026-11-01T10:00:00',
};
const request: CaseRequest = {
  clientId: 3,
  title: 'Demanda laboral',
  description: null,
  status: 'OPEN',
  openedAt: null,
  closedAt: null,
};

describe('ExpedienteService', () => {
  let service: ExpedienteService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ExpedienteService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lista los expedientes propios sin parámetros cuando no hay filtros', () => {
    service.list().subscribe((rows) => expect(rows).toEqual([legalCase]));
    const req = http.expectOne('/api/cases');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush([legalCase]);
  });

  it('envía solo los filtros informados (status, openedFrom, openedTo)', () => {
    service
      .list({ status: 'CLOSED', openedFrom: '2026-01-01', openedTo: null })
      .subscribe();
    const req = http.expectOne((r) => r.url === '/api/cases');
    expect(req.request.params.get('status')).toBe('CLOSED');
    expect(req.request.params.get('openedFrom')).toBe('2026-01-01');
    expect(req.request.params.has('openedTo')).toBe(false);
    req.flush([]);
  });

  it('obtiene, crea, actualiza y elimina con los verbos y cuerpos del contrato', () => {
    service.get(7).subscribe();
    const get = http.expectOne('/api/cases/7');
    expect(get.request.method).toBe('GET');
    get.flush(legalCase);

    service.create(request).subscribe();
    const post = http.expectOne('/api/cases');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual(request);
    post.flush(legalCase, { status: 201, statusText: 'Created' });

    service.update(7, { ...request, status: 'CLOSED', closedAt: '2026-11-10' }).subscribe();
    const put = http.expectOne('/api/cases/7');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body.closedAt).toBe('2026-11-10');
    put.flush({ ...legalCase, status: 'CLOSED' });

    service.remove(7).subscribe();
    const del = http.expectOne('/api/cases/7');
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('consulta el conteo de sesiones de chat por expediente', () => {
    service.sessionCounts().subscribe((rows) => expect(rows[0].cantidadSesiones).toBe(2));
    http
      .expectOne('/api/cases/chat-session-count')
      .flush([{ caseId: 7, tituloExpediente: 'Demanda laboral', cantidadSesiones: 2 }]);
  });

  it('HU-61 CA-02: devuelve [] cuando no hay expedientes', () => {
    let result: unknown;
    service.sessionCounts().subscribe((rows) => (result = rows));
    const req = http.expectOne('/api/cases/chat-session-count');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    expect(result).toEqual([]);
  });
});
