import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { SummaryResponse } from '../../../models/response/summary-response';
import { ResumenesPorTipoComponent } from './resumenes-por-tipo';

const LIST = '/api/summaries';
const FILTER = '/api/summaries/filter';
const CASES = '/api/cases';

function summary(summaryId: number, caseId: number, summaryType: string, createdAt: string) {
  return {
    summaryId,
    caseId,
    documentId: null,
    summaryType,
    content: 'Resumen',
    generatedByUserId: 1,
    createdAt,
  } satisfies SummaryResponse;
}

const summaries = [
  summary(1, 10, 'Ejecutivo', '2026-11-01T10:00:00'),
  summary(2, 10, 'Ejecutivo', '2026-11-03T10:00:00'),
  summary(3, 11, 'Técnico', '2026-11-20T10:00:00'),
];

describe('ResumenesPorTipoComponent (HU-128)', () => {
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

  async function mount(rows: SummaryResponse[] = summaries) {
    const f = TestBed.createComponent(ResumenesPorTipoComponent);
    f.detectChanges();
    http.expectOne(CASES).flush([]);
    http.expectOne(LIST).flush(rows);
    f.detectChanges();
    await f.whenStable();
    return f;
  }

  it('CA-01: cantidad de resúmenes por tipo, de mayor a menor', async () => {
    const f = await mount();
    expect(f.componentInstance.rows().map((r) => [r.label, r.count])).toEqual([
      ['Ejecutivo', 2],
      ['Técnico', 1],
    ]);
    expect(f.nativeElement.querySelector('canvas')).not.toBeNull();
  });

  it('CA-02: el filtro por fecha actualiza la agrupación', async () => {
    const f = await mount();
    const c = f.componentInstance;
    c.from.set('2026-11-10');
    c.apply();
    http.expectOne(LIST).flush(summaries);
    expect(c.rows().map((r) => [r.label, r.count])).toEqual([['Técnico', 1]]);
  });

  it('CA-02: con expediente y rango consulta /filter por cada tipo', async () => {
    const f = await mount();
    const c = f.componentInstance;
    c.caseId.set(10);
    c.from.set('2026-11-01');
    c.to.set('2026-11-30');
    c.apply();
    const calls = http.match((r) => r.url === FILTER);
    expect(calls.map((r) => r.request.params.get('summaryType')).sort()).toEqual([
      'Ejecutivo',
      'Técnico',
    ]);
    calls.forEach((call) =>
      call.flush(
        call.request.params.get('summaryType') === 'Ejecutivo'
          ? [
              { summaryId: 1, documentId: null, summaryType: 'Ejecutivo', content: '', createdAt: '' },
              { summaryId: 2, documentId: null, summaryType: 'Ejecutivo', content: '', createdAt: '' },
            ]
          : [],
      ),
    );
    expect(c.rows().map((r) => [r.label, r.count])).toEqual([['Ejecutivo', 2]]);
  });

  it('CA-03: sin resúmenes para los filtros muestra que no hay datos', async () => {
    const f = await mount();
    const c = f.componentInstance;
    c.from.set('2027-01-01');
    c.apply();
    http.expectOne(LIST).flush(summaries);
    f.detectChanges();
    expect(c.query.empty()).toBe(true);
    expect(f.nativeElement.textContent).toContain('No hay datos para los filtros seleccionados');
  });

  it('rango invertido: error sin llamar a la API', async () => {
    const f = await mount();
    const c = f.componentInstance;
    c.from.set('2026-12-01');
    c.to.set('2026-11-01');
    c.apply();
    http.expectNone(LIST);
    expect(c.filterError()).toBe('reports.errRange');
  });
});
