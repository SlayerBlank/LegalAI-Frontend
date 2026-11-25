import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DashboardQueriesComponent } from './dashboard-queries';
import { CaseSessionCountResponse } from '../../../models/expediente';
import { ClientDocumentCountResponse } from '../../../models/management';

const SESSIONS = '/api/cases/chat-session-count';
const DOCUMENTS = '/api/clients/document-count';

const sessions: CaseSessionCountResponse[] = [
  { caseId: 2, tituloExpediente: 'Contrato de alquiler', cantidadSesiones: 1 },
  { caseId: 1, tituloExpediente: 'Demanda laboral', cantidadSesiones: 4 },
  { caseId: 3, tituloExpediente: 'Sucesión intestada', cantidadSesiones: 0 },
];
const documents: ClientDocumentCountResponse[] = [
  { clientId: 7, nombreCliente: 'Ana Torres', cantidadDocumentos: 2 },
  { clientId: 8, nombreCliente: 'Inversiones Lima SAC', cantidadDocumentos: 15 },
];

describe('DashboardQueriesComponent (HU-61 y HU-62)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem('legalai-language');
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function mount() {
    const f = TestBed.createComponent(DashboardQueriesComponent);
    f.detectChanges();
    return f;
  }

  function text(f: ReturnType<typeof mount>, selector: string): string {
    return (f.nativeElement.querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  function rows(f: ReturnType<typeof mount>, tableIndex: number): string[][] {
    const table = f.nativeElement.querySelectorAll('table')[tableIndex] as HTMLTableElement;
    return Array.from(table.querySelectorAll('tbody tr')).map((tr) =>
      Array.from((tr as HTMLTableRowElement).cells).map((cell) => cell.textContent!.trim()),
    );
  }

  it('muestra el estado de carga mientras las consultas están pendientes', () => {
    const f = mount();
    expect(f.componentInstance.sessions.status()).toBe('loading');
    expect(f.componentInstance.documents.status()).toBe('loading');
    expect(f.nativeElement.querySelectorAll('[role="status"]').length).toBe(2);
    http.expectOne(SESSIONS).flush([]);
    http.expectOne(DOCUMENTS).flush([]);
  });

  it('HU-61 CA-01: lista título y sesiones por expediente, de mayor a menor, con total', async () => {
    const f = mount();
    http.expectOne(SESSIONS).flush(sessions);
    http.expectOne(DOCUMENTS).flush([]);
    f.detectChanges();
    await f.whenStable();
    expect(rows(f, 0)).toEqual([
      ['Demanda laboral', '4'],
      ['Contrato de alquiler', '1'],
      ['Sucesión intestada', '0'],
    ]);
    expect(f.componentInstance.sessions.total()).toBe(5);
    expect(text(f, 'table tfoot')).toContain('5');
    expect(text(f, 'table caption')).toContain('sesiones de chat');
    const link = f.nativeElement.querySelector('tbody a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/chat-ia?caseId=1');
  });

  it('HU-62 CA-01: lista cliente y documentos, de mayor a menor, con total', async () => {
    const f = mount();
    http.expectOne(SESSIONS).flush([]);
    http.expectOne(DOCUMENTS).flush(documents);
    f.detectChanges();
    await f.whenStable();
    expect(rows(f, 0)).toEqual([
      ['Inversiones Lima SAC', '15'],
      ['Ana Torres', '2'],
    ]);
    expect(f.componentInstance.documents.total()).toBe(17);
    expect(
      f.nativeElement.querySelector('a[href="/clientes"]')?.textContent,
    ).toContain('Ver clientes');
  });

  it('CA-02: con [] y 200 muestra estados vacíos, no errores', async () => {
    const f = mount();
    http.expectOne(SESSIONS).flush([]);
    http.expectOne(DOCUMENTS).flush([]);
    f.detectChanges();
    await f.whenStable();
    const c = f.componentInstance;
    expect(c.sessions.empty()).toBe(true);
    expect(c.documents.empty()).toBe(true);
    expect(f.nativeElement.querySelector('table')).toBeNull();
    expect(f.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(f.nativeElement.textContent).toContain('Aún no tienes expedientes');
    expect(f.nativeElement.textContent).toContain('Aún no tienes clientes');
  });

  it('muestra el error del servidor sin asumir cero y permite reintentar', async () => {
    const f = mount();
    http
      .expectOne(SESSIONS)
      .flush({ message: 'Fallo interno' }, { status: 500, statusText: 'Server Error' });
    http.expectOne(DOCUMENTS).error(new ProgressEvent('error'));
    f.detectChanges();
    await f.whenStable();
    const c = f.componentInstance;
    expect(c.sessions.status()).toBe('error');
    expect(c.sessions.error()).toBe('500: Fallo interno');
    expect(c.documents.error()).toContain('No fue posible conectar');
    expect(c.sessions.total()).toBe(0);
    expect(f.nativeElement.querySelectorAll('[role="alert"]').length).toBe(2);
    expect(f.nativeElement.querySelector('table')).toBeNull();

    (f.nativeElement.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    http.expectOne(SESSIONS).flush(sessions);
    f.detectChanges();
    expect(c.sessions.status()).toBe('ready');
    expect(c.sessions.rows()[0].caseId).toBe(1);
  });

  it('no duplica la petición si se reintenta mientras sigue cargando', () => {
    const c = mount().componentInstance;
    c.sessions.load();
    c.documents.load();
    http.expectOne(SESSIONS).flush([]);
    http.expectOne(DOCUMENTS).flush([]);
  });
});
