import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { CaseSessionCountResponse } from '../../../models/expediente';
import { SesionesPorExpedienteComponent } from './sesiones-por-expediente';

const URL = '/api/cases/chat-session-count';
const data: CaseSessionCountResponse[] = [
  { caseId: 2, tituloExpediente: 'Contrato de alquiler', cantidadSesiones: 1 },
  { caseId: 1, tituloExpediente: 'Demanda laboral', cantidadSesiones: 4 },
  { caseId: 3, tituloExpediente: 'Sucesión intestada', cantidadSesiones: 0 },
];

describe('SesionesPorExpedienteComponent (HU-124)', () => {
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
    const f = TestBed.createComponent(SesionesPorExpedienteComponent);
    f.detectChanges();
    return f;
  }

  function rows(el: HTMLElement): string[][] {
    return Array.from(el.querySelectorAll('app-report-table tbody tr')).map((tr) =>
      Array.from((tr as HTMLTableRowElement).cells).map((c) => c.textContent!.trim()),
    );
  }

  it('muestra la carga y el título con el prefijo "Visualizar"', () => {
    const f = mount();
    expect(f.nativeElement.querySelector('[role="status"]')).not.toBeNull();
    expect(f.nativeElement.querySelector('h1').textContent).toContain(
      'Visualizar reporte de sesiones de chat por expediente',
    );
    http.expectOne(URL).flush([]);
  });

  it('CA-01: gráfico de barras y tabla ordenada de mayor a menor con total', async () => {
    const f = mount();
    http.expectOne(URL).flush(data);
    f.detectChanges();
    await f.whenStable();
    const c = f.componentInstance;
    expect(c.rows().map((r) => [r.label, r.count])).toEqual([
      ['Demanda laboral', 4],
      ['Contrato de alquiler', 1],
      ['Sucesión intestada', 0],
    ]);
    expect(f.nativeElement.querySelector('app-report-chart canvas')).not.toBeNull();
    expect(rows(f.nativeElement).map((r) => r.slice(0, 2))).toEqual([
      ['Demanda laboral', '4'],
      ['Contrato de alquiler', '1'],
      ['Sucesión intestada', '0'],
    ]);
    expect(f.nativeElement.querySelector('tfoot').textContent).toContain('5');
    const label = f.nativeElement.querySelector('canvas').getAttribute('aria-label');
    expect(label).toContain('Demanda laboral: 4');
  });

  it('CA-02: sin registros (o todo en cero) muestra que no hay datos', async () => {
    const f = mount();
    http.expectOne(URL).flush([data[2]]);
    f.detectChanges();
    await f.whenStable();
    expect(f.componentInstance.query.empty()).toBe(true);
    expect(f.nativeElement.querySelector('app-report-chart')).toBeNull();
    expect(f.nativeElement.textContent).toContain('No hay datos');
  });

  it('CA-03: error de la API con reintento', async () => {
    const f = mount();
    http.expectOne(URL).flush({ message: 'Fallo' }, { status: 500, statusText: 'Error' });
    f.detectChanges();
    await f.whenStable();
    const alert = f.nativeElement.querySelector('.state.error');
    expect(alert.textContent).toContain('500: Fallo');
    (alert.querySelector('button') as HTMLButtonElement).click();
    http.expectOne(URL).flush(data);
    f.detectChanges();
    expect(f.componentInstance.query.status()).toBe('ready');
  });
});
