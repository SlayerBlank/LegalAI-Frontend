import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ChatSession } from '../../../models/chat-ia';
import { ActividadChatComponent, fillDays, sessionsPerDay } from './actividad-chat';

const SESSIONS = '/api/chat/sessions';
const CASES = '/api/cases';

function session(sessionId: number, caseId: number, updatedAt: string | null, createdAt = '2026-11-01T08:00:00'): ChatSession {
  return {
    sessionId,
    caseId,
    documentId: null,
    documentScopeRequired: false,
    title: `Sesión ${sessionId}`,
    messageCount: 2,
    createdAt,
    updatedAt,
  };
}

const sessions = [
  session(1, 10, '2026-11-03T22:15:00'),
  session(2, 10, '2026-11-03T09:00:00'),
  session(3, 11, '2026-11-01T10:00:00'),
  session(4, 11, null, '2026-11-05T10:00:00'),
];

describe('ActividadChatComponent (HU-132)', () => {
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
    const f = TestBed.createComponent(ActividadChatComponent);
    f.detectChanges();
    http.expectOne(CASES).flush([{ caseId: 10, title: 'Demanda laboral' }]);
    return f;
  }

  it('agrupa por día de última actividad y completa los días sin sesiones', () => {
    const counts = sessionsPerDay(sessions);
    expect([...counts].sort()).toEqual([
      ['2026-11-01', 1],
      ['2026-11-03', 2],
      ['2026-11-05', 1],
    ]);
    expect(fillDays(counts)).toEqual([
      ['2026-11-01', 1],
      ['2026-11-02', 0],
      ['2026-11-03', 2],
      ['2026-11-04', 0],
      ['2026-11-05', 1],
    ]);
  });

  it('CA-01: gráfico de líneas con sesiones por día; la tabla lista solo días activos', async () => {
    const f = mount();
    const req = http.expectOne((r) => r.url === SESSIONS);
    expect(req.request.params.get('size')).toBe('100');
    expect(req.request.params.has('caseId')).toBe(false);
    req.flush(sessions);
    f.detectChanges();
    await f.whenStable();
    const c = f.componentInstance;
    expect(c.series().map((r) => r.count)).toEqual([1, 0, 2, 0, 1]);
    expect(c.activeDays().map((r) => r.key)).toEqual(['2026-11-05', '2026-11-03', '2026-11-01']);
    expect(f.nativeElement.querySelectorAll('app-report-table tbody tr').length).toBe(3);
    expect(f.nativeElement.querySelector('tfoot').textContent).toContain('4');
  });

  it('recorre las páginas mientras lleguen completas', () => {
    const f = mount();
    const full = Array.from({ length: 100 }, (_, i) => session(i + 1, 10, '2026-11-02T10:00:00'));
    http.expectOne((r) => r.url === SESSIONS && r.params.get('page') === '0').flush(full);
    http.expectOne((r) => r.url === SESSIONS && r.params.get('page') === '1').flush([sessions[0]]);
    expect(f.componentInstance.query.data().length).toBe(101);
  });

  it('CA-02: el filtro por expediente envía caseId', () => {
    const f = mount();
    http.expectOne((r) => r.url === SESSIONS).flush(sessions);
    const c = f.componentInstance;
    c.caseId.set(10);
    c.apply();
    const req = http.expectOne((r) => r.url === SESSIONS);
    expect(req.request.params.get('caseId')).toBe('10');
    req.flush(sessions.slice(0, 2));
    expect(c.series().map((r) => r.count)).toEqual([2]);
  });

  it('CA-03: sin sesiones muestra que no hay datos', async () => {
    const f = mount();
    http.expectOne((r) => r.url === SESSIONS).flush([]);
    f.detectChanges();
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('todavía no tienes sesiones de chat');
    expect(f.nativeElement.querySelector('canvas')).toBeNull();
  });
});
