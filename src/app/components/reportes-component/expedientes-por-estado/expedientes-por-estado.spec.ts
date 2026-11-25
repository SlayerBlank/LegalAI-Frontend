import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { CaseResponse, CaseStatus } from '../../../models/expediente';
import { I18nService } from '../../../services/i18n.service';
import { ExpedientesPorEstadoComponent } from './expedientes-por-estado';

const URL = '/api/cases';

function item(caseId: number, status: CaseStatus): CaseResponse {
  return {
    caseId,
    clientId: 1,
    title: `Expediente ${caseId}`,
    description: null,
    status,
    openedAt: '2026-10-01',
    closedAt: null,
    createdAt: '2026-10-01T10:00:00',
    updatedAt: '2026-10-01T10:00:00',
  };
}

const cases = [item(1, 'OPEN'), item(2, 'OPEN'), item(3, 'CLOSED'), item(4, 'IN_PROGRESS')];

describe('ExpedientesPorEstadoComponent (HU-129)', () => {
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
    const f = TestBed.createComponent(ExpedientesPorEstadoComponent);
    f.detectChanges();
    return f;
  }

  it('CA-01: agrupa por estado en el orden del enum, incluidos los ceros', async () => {
    const f = mount();
    const req = http.expectOne((r) => r.url === URL);
    expect(req.request.params.keys()).toEqual([]);
    req.flush(cases);
    f.detectChanges();
    await f.whenStable();
    expect(f.componentInstance.rows().map((r) => [r.label, r.count])).toEqual([
      ['Abierto', 2],
      ['En curso', 1],
      ['Cerrado', 1],
      ['Archivado', 0],
    ]);
    expect(f.nativeElement.querySelector('canvas')).not.toBeNull();
    expect(f.nativeElement.querySelector('tfoot').textContent).toContain('4');
  });

  it('CA-02: el rango de apertura se envía como openedFrom/openedTo', async () => {
    const f = mount();
    http.expectOne(URL).flush(cases);
    const c = f.componentInstance;
    c.from.set('2026-01-01');
    c.to.set('2026-06-30');
    c.apply();
    const req = http.expectOne((r) => r.url === URL);
    expect(req.request.params.get('openedFrom')).toBe('2026-01-01');
    expect(req.request.params.get('openedTo')).toBe('2026-06-30');
    req.flush([item(9, 'ARCHIVED')]);
    expect(c.rows().find((r) => r.key === 'ARCHIVED')?.count).toBe(1);
  });

  it('CA-03: rango inválido indica el error sin consultar', async () => {
    const f = mount();
    http.expectOne(URL).flush(cases);
    const c = f.componentInstance;
    c.from.set('2026-06-30');
    c.to.set('2026-01-01');
    c.apply();
    f.detectChanges();
    http.expectNone(URL);
    expect(f.nativeElement.querySelector('.filter-error').textContent).toContain(
      'no puede ser posterior',
    );
    expect(f.nativeElement.querySelector('input[name="from"]').getAttribute('aria-invalid')).toBe(
      'true',
    );
  });

  it('vacío y textos en inglés', async () => {
    TestBed.inject(I18nService).setLanguage('en');
    const f = mount();
    http.expectOne(URL).flush([]);
    f.detectChanges();
    await f.whenStable();
    expect(f.nativeElement.querySelector('h1').textContent).toContain('View cases by status report');
    expect(f.nativeElement.textContent).toContain('There is no data for the selected filters.');
    localStorage.removeItem('legalai-language');
  });
});
