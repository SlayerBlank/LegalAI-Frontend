import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { CaseStatus } from '../../../models/expediente';
import { ClientCaseResponse } from '../../../models/management';
import { ExpedientesDeClienteComponent } from './expedientes-de-cliente';

const CLIENTS = '/api/clients';
const FILTER = '/api/clients/7/cases/filter';

function item(caseId: number, status: CaseStatus): ClientCaseResponse {
  return {
    caseId,
    clientId: 7,
    title: `Expediente ${caseId}`,
    description: null,
    status,
    openedAt: '2026-05-01',
    closedAt: null,
    createdAt: '2026-05-01T10:00:00',
    updatedAt: '2026-05-01T10:00:00',
  };
}

describe('ExpedientesDeClienteComponent (HU-131)', () => {
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

  function mount() {
    const f = TestBed.createComponent(ExpedientesDeClienteComponent);
    f.detectChanges();
    http.expectOne(CLIENTS).flush([{ clientId: 7, fullNameOrCompany: 'Ana Torres' }]);
    f.detectChanges();
    return f;
  }

  function consult(f: ReturnType<typeof mount>, byStatus: Partial<Record<CaseStatus, ClientCaseResponse[]>>) {
    const c = f.componentInstance;
    c.clientId.set(7);
    c.from.set('2026-01-01');
    c.to.set('2026-12-31');
    c.apply();
    const calls = http.match((r) => r.url === FILTER);
    expect(calls.map((r) => r.request.params.get('status'))).toEqual([
      'OPEN',
      'IN_PROGRESS',
      'CLOSED',
      'ARCHIVED',
    ]);
    calls.forEach((call) => {
      expect(call.request.params.get('openedFrom')).toBe('2026-01-01');
      expect(call.request.params.get('openedTo')).toBe('2026-12-31');
      call.flush(byStatus[call.request.params.get('status') as CaseStatus] ?? []);
    });
    f.detectChanges();
  }

  it('estado inicial: pide elegir cliente y rango, sin consultar', () => {
    const f = mount();
    expect(f.componentInstance.query.status()).toBe('idle');
    expect(f.nativeElement.textContent).toContain('Selecciona un cliente y un rango de fechas');
    expect(f.nativeElement.querySelector('option:nth-child(2)').textContent).toContain('Ana Torres');
  });

  it('CA-01: consulta una vez por estado y consolida el gráfico', () => {
    const f = mount();
    consult(f, { OPEN: [item(1, 'OPEN'), item(2, 'OPEN')], CLOSED: [item(3, 'CLOSED')] });
    expect(f.componentInstance.rows().map((r) => [r.label, r.count])).toEqual([
      ['Abierto', 2],
      ['En curso', 0],
      ['Cerrado', 1],
      ['Archivado', 0],
    ]);
    expect(f.nativeElement.querySelector('canvas')).not.toBeNull();
  });

  it('CA-02: sin cliente pide seleccionarlo y no llama a la API', () => {
    const f = mount();
    f.componentInstance.apply();
    f.detectChanges();
    http.expectNone((r) => r.url.includes('/cases/filter'));
    expect(f.nativeElement.querySelector('.filter-error').textContent).toContain(
      'Selecciona un cliente para consultar',
    );
    expect(f.nativeElement.querySelector('select').getAttribute('aria-invalid')).toBe('true');
  });

  it('CA-03: sin expedientes en el rango muestra que no hay datos', () => {
    const f = mount();
    consult(f, {});
    expect(f.componentInstance.query.empty()).toBe(true);
    expect(f.nativeElement.textContent).toContain('el cliente no tiene expedientes en ese rango');
  });

  it('rango invertido: error sin consultar', () => {
    const f = mount();
    const c = f.componentInstance;
    c.clientId.set(7);
    c.from.set('2026-12-31');
    c.to.set('2026-01-01');
    c.apply();
    http.expectNone((r) => r.url === FILTER);
    expect(c.filterError()).toBe('reports.errRange');
  });
});
