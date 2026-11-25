import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { OpenCaseWithLawyerResponse } from '../../../models/expediente';
import { CurrentUserResponse } from '../../../models/response/current-user-response';
import { ExpedientesAbiertosPorAbogadoComponent } from './expedientes-abiertos-por-abogado';

const URL = '/api/cases/open-with-lawyer';

function lawyer(userId: number, fullName: string): CurrentUserResponse {
  return {
    userId,
    roleId: 2,
    roleName: 'USER',
    fullName,
    email: `abogado${userId}@example.com`,
    status: 'ACTIVE',
    createdAt: '2026-01-01T10:00:00',
    updatedAt: '2026-01-01T10:00:00',
  };
}

function openCase(caseId: number, title: string, abogado: CurrentUserResponse | null) {
  return {
    caseId,
    title,
    description: null,
    status: 'OPEN',
    openedAt: '2026-10-0' + (caseId % 9 || 1),
    updatedAt: '2026-11-01T09:00:00',
    abogado,
  } satisfies OpenCaseWithLawyerResponse;
}

const ana = lawyer(5, 'Ana García');
const luis = lawyer(6, 'Luis Pérez');
const data = [
  openCase(1, 'Demanda laboral', ana),
  openCase(2, 'Contrato de alquiler', luis),
  openCase(3, 'Divorcio', ana),
];

describe('ExpedientesAbiertosPorAbogadoComponent (HU-126)', () => {
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
    const f = TestBed.createComponent(ExpedientesAbiertosPorAbogadoComponent);
    f.detectChanges();
    return f;
  }

  it('CA-01: agrupa los expedientes abiertos por abogado', async () => {
    const f = mount();
    http.expectOne(URL).flush(data);
    f.detectChanges();
    await f.whenStable();
    expect(f.componentInstance.rows().map((r) => [r.label, r.count])).toEqual([
      ['Ana García', 2],
      ['Luis Pérez', 1],
    ]);
    expect(f.nativeElement.querySelector('canvas')).not.toBeNull();
  });

  it('CA-02: tabla de detalle con título del expediente y nombre del abogado', async () => {
    const f = mount();
    http.expectOne(URL).flush([...data, openCase(4, 'Herencia', null)]);
    f.detectChanges();
    await f.whenStable();
    const detail = Array.from(
      f.nativeElement.querySelectorAll('table[aria-labelledby="r126-detail"] tbody tr'),
    ).map((tr) => Array.from((tr as HTMLTableRowElement).cells).map((c) => c.textContent!.trim()));
    expect(detail.map((r) => r.slice(0, 2))).toEqual([
      ['Demanda laboral', 'Ana García'],
      ['Divorcio', 'Ana García'],
      ['Contrato de alquiler', 'Luis Pérez'],
      ['Herencia', 'Sin abogado asignado'],
    ]);
  });

  it('CA-03: sin expedientes abiertos muestra que no hay datos', async () => {
    const f = mount();
    http.expectOne(URL).flush([]);
    f.detectChanges();
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('no tienes expedientes abiertos');
    expect(f.nativeElement.querySelector('table')).toBeNull();
  });

  it('muestra el error y reintenta', async () => {
    const f = mount();
    http.expectOne(URL).flush(null, { status: 404, statusText: 'Not Found' });
    f.detectChanges();
    await f.whenStable();
    expect(f.componentInstance.query.status()).toBe('error');
    (f.nativeElement.querySelector('.state.error button') as HTMLButtonElement).click();
    http.expectOne(URL).flush(data);
    expect(f.componentInstance.query.hasData()).toBe(true);
  });
});
