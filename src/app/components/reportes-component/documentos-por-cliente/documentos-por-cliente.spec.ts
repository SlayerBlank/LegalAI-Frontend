import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ClientDocumentCountResponse } from '../../../models/management';
import { DocumentosPorClienteComponent } from './documentos-por-cliente';

const URL = '/api/clients/document-count';
const data: ClientDocumentCountResponse[] = [
  { clientId: 7, nombreCliente: 'Ana Torres', cantidadDocumentos: 2 },
  { clientId: 8, nombreCliente: 'Inversiones Lima SAC', cantidadDocumentos: 15 },
];

describe('DocumentosPorClienteComponent (HU-125)', () => {
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
    const f = TestBed.createComponent(DocumentosPorClienteComponent);
    f.detectChanges();
    return f;
  }

  it('CA-01: nombre de cada cliente y su cantidad, de mayor a menor', async () => {
    const f = mount();
    http.expectOne(URL).flush(data);
    f.detectChanges();
    await f.whenStable();
    expect(f.componentInstance.rows().map((r) => [r.label, r.count])).toEqual([
      ['Inversiones Lima SAC', 15],
      ['Ana Torres', 2],
    ]);
    const firstRow = f.nativeElement.querySelector('app-report-table tbody tr');
    expect(firstRow.textContent).toContain('Inversiones Lima SAC');
    expect(f.nativeElement.querySelector('tfoot').textContent).toContain('17');
    expect(f.nativeElement.querySelector('canvas')).not.toBeNull();
  });

  it('CA-02: sin registros muestra el estado vacío', async () => {
    const f = mount();
    http.expectOne(URL).flush([]);
    f.detectChanges();
    await f.whenStable();
    expect(f.componentInstance.query.empty()).toBe(true);
    expect(f.nativeElement.querySelector('table')).toBeNull();
    expect(f.nativeElement.textContent).toContain('No hay datos');
  });

  it('CA-03: error sin conexión con opción de reintentar', async () => {
    const f = mount();
    http.expectOne(URL).error(new ProgressEvent('error'));
    f.detectChanges();
    await f.whenStable();
    expect(f.nativeElement.querySelector('.state.error').textContent).toContain(
      'No fue posible conectar',
    );
    f.componentInstance.query.retry();
    http.expectOne(URL).flush(data);
    expect(f.componentInstance.query.hasData()).toBe(true);
  });
});
