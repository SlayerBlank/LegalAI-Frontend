import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DraftResponse } from '../../../models/response/draft-response';
import { BorradoresPorEstadoComponent } from './borradores-por-estado';

const LIST = '/api/drafts';
const FILTER = '/api/drafts/filter';
const CASES = '/api/cases';

function draft(draftId: number, caseId: number, status: string, updatedAt: string): DraftResponse {
  return {
    draftId,
    caseId,
    title: `Borrador ${draftId}`,
    prompt: null,
    content: 'Texto',
    status,
    createdByUserId: 1,
    createdAt: updatedAt,
    updatedAt,
  };
}

const drafts = [
  draft(1, 10, 'Borrador', '2026-11-01T10:00:00'),
  draft(2, 10, 'Revisado', '2026-11-05T10:00:00'),
  draft(3, 11, 'Borrador', '2026-11-10T10:00:00'),
  draft(4, 10, 'Archivado', '2026-11-12T10:00:00'),
];

describe('BorradoresPorEstadoComponent (HU-137)', () => {
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

  async function mount(rows: DraftResponse[] = drafts) {
    const f = TestBed.createComponent(BorradoresPorEstadoComponent);
    f.detectChanges();
    http.expectOne(CASES).flush([{ caseId: 10, title: 'Demanda laboral' }]);
    http.expectOne(LIST).flush(rows);
    f.detectChanges();
    await f.whenStable();
    return f;
  }

  it('CA-01: gráfico circular con la cantidad de borradores por estado', async () => {
    const f = await mount();
    expect(f.componentInstance.rows().map((r) => [r.label, r.count])).toEqual([
      ['Borrador', 2],
      ['Archivado', 1],
      ['Revisado', 1],
    ]);
    expect(f.nativeElement.querySelector('canvas')).not.toBeNull();
    expect(f.nativeElement.querySelectorAll('app-report-table .swatch').length).toBe(3);
  });

  it('CA-02: con expediente y rango consulta /filter una vez por estado y consolida', async () => {
    const f = await mount();
    const c = f.componentInstance;
    c.caseId.set(10);
    c.from.set('2026-11-01');
    c.to.set('2026-11-30');
    c.apply();
    const calls = http.match((r) => r.url === FILTER);
    expect(calls.map((r) => r.request.params.get('status')).sort()).toEqual([
      'Archivado',
      'Borrador',
      'En revisión',
      'Revisado',
    ]);
    for (const call of calls) {
      expect(call.request.params.get('caseId')).toBe('10');
      expect(call.request.params.get('updatedFrom')).toBe('2026-11-01');
      expect(call.request.params.get('updatedTo')).toBe('2026-11-30');
      const status = call.request.params.get('status')!;
      call.flush(
        status === 'Borrador'
          ? [{ draftId: 1, title: 'a', status, updatedAt: '2026-11-01T10:00:00' }]
          : [],
      );
    }
    expect(c.rows().map((r) => [r.label, r.count])).toEqual([['Borrador', 1]]);
  });

  it('CA-02: con filtros parciales agrupa el listado filtrado en el navegador', async () => {
    const f = await mount();
    const c = f.componentInstance;
    c.caseId.set(10);
    c.apply();
    http.expectOne(LIST).flush(drafts);
    expect(c.rows().map((r) => [r.label, r.count])).toEqual([
      ['Archivado', 1],
      ['Borrador', 1],
      ['Revisado', 1],
    ]);
  });

  it('CA-03: rango invertido muestra el error sin llamar a la API', async () => {
    const f = await mount();
    const c = f.componentInstance;
    c.from.set('2026-12-01');
    c.to.set('2026-11-01');
    c.apply();
    f.detectChanges();
    http.expectNone((r) => r.url === FILTER || r.url === LIST);
    expect(f.nativeElement.querySelector('.filter-error').textContent).toContain(
      'no puede ser posterior',
    );
  });

  it('sin borradores muestra que no hay datos', async () => {
    const f = await mount([]);
    expect(f.componentInstance.query.empty()).toBe(true);
    expect(f.nativeElement.textContent).toContain('No hay datos');
  });
});
