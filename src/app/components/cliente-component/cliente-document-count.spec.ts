import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ClienteComponent } from './cliente-component';
import { ClienteService } from '../../services/cliente-service';
import { ClientResponse } from '../../models/management';

const client: ClientResponse = {
  clientId: 7,
  clientType: 'PERSON',
  fullNameOrCompany: 'Ana Torres',
  documentNumber: null,
  email: null,
  phone: null,
  address: null,
  createdAt: '2026-10-01T09:00:00',
  updatedAt: '2026-10-01T09:00:00',
};
const other: ClientResponse = { ...client, clientId: 8, fullNameOrCompany: 'Inversiones Lima SAC' };

describe('HU-62: ClienteService.getDocumentCount', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('consulta GET /api/clients/document-count con los campos del DTO', () => {
    let result: unknown;
    TestBed.inject(ClienteService)
      .getDocumentCount()
      .subscribe((rows) => (result = rows));
    const req = http.expectOne('/api/clients/document-count');
    expect(req.request.method).toBe('GET');
    req.flush([{ clientId: 7, nombreCliente: 'Ana Torres', cantidadDocumentos: 3 }]);
    expect(result).toEqual([{ clientId: 7, nombreCliente: 'Ana Torres', cantidadDocumentos: 3 }]);
  });

  it('devuelve [] cuando no hay registros', () => {
    let result: unknown;
    TestBed.inject(ClienteService)
      .getDocumentCount()
      .subscribe((rows) => (result = rows));
    http.expectOne('/api/clients/document-count').flush([]);
    expect(result).toEqual([]);
  });
});

describe('HU-62: columna Documentos en Clientes', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function mount() {
    const f = TestBed.createComponent(ClienteComponent);
    f.detectChanges();
    http.expectOne('/api/clients').flush([client, other]);
    return f;
  }

  function documentCells(f: ReturnType<typeof mount>): string[] {
    f.detectChanges();
    const header = Array.from(f.nativeElement.querySelectorAll('thead th')).map((th) =>
      (th as HTMLElement).textContent!.trim(),
    );
    const col = header.indexOf('Documentos');
    expect(col).toBeGreaterThan(-1);
    return Array.from(f.nativeElement.querySelectorAll('tbody tr')).map((tr) =>
      (tr as HTMLTableRowElement).cells[col].textContent!.trim(),
    );
  }

  it('muestra la cantidad de documentos de cada cliente', () => {
    const f = mount();
    http.expectOne('/api/clients/document-count').flush([
      { clientId: 8, nombreCliente: 'Inversiones Lima SAC', cantidadDocumentos: 15 },
      { clientId: 7, nombreCliente: 'Ana Torres', cantidadDocumentos: 2 },
    ]);
    expect(documentCells(f)).toEqual(['2', '15']);
  });

  it('muestra "—" si la consulta falla; no asume 0', () => {
    const f = mount();
    http
      .expectOne('/api/clients/document-count')
      .flush({ message: 'Fallo' }, { status: 500, statusText: 'Server Error' });
    expect(documentCells(f)).toEqual(['—', '—']);
    expect(f.componentInstance.error).toBe('');
  });

  it('muestra "—" mientras el conteo sigue pendiente', () => {
    const f = mount();
    expect(documentCells(f)).toEqual(['—', '—']);
    http.expectOne('/api/clients/document-count').flush([]);
  });
});
