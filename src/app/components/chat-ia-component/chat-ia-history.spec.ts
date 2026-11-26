import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { ChatIaComponent } from './chat-ia-component';
import { ChatMessage, ChatSession, ChatSource } from '../../models/chat-ia';
import { CaseResponse } from '../../models/expediente';
import { LoginService } from '../../services/login-service';
import { jwtInterceptor } from '../../services/jwt.interceptor';

const legalCase: CaseResponse = {
  caseId: 1,
  clientId: 3,
  title: 'Demanda laboral',
  description: null,
  status: 'OPEN',
  openedAt: '2026-11-01',
  closedAt: null,
  createdAt: '2026-11-01T10:00:00',
  updatedAt: '2026-11-01T10:00:00',
};
const otherCase: CaseResponse = { ...legalCase, caseId: 2, title: 'Arrendamiento' };
const session: ChatSession = {
  sessionId: 12,
  caseId: 1,
  documentId: null,
  documentScopeRequired: false,
  title: 'Análisis inicial',
  messageCount: 3,
  createdAt: '2026-11-20T09:00:00',
  updatedAt: '2026-11-20T09:05:00',
};
const source: ChatSource = {
  reference: 'S1',
  documentId: 5,
  documentName: 'contrato.pdf',
  chunkId: 40,
  chunkIndex: 2,
  excerpt: 'Cláusula tercera',
  distance: 0.1,
  charStart: 0,
  charEnd: 16,
};

function msg(
  id: number,
  role: 'USER' | 'ASSISTANT',
  sources: ChatSource[] | null = null,
): ChatMessage {
  return {
    messageId: id,
    role,
    content: `${role} ${id}`,
    createdAt: '2026-11-20T09:01:00',
    provider: role === 'ASSISTANT' ? 'gemini' : null,
    model: role === 'ASSISTANT' ? 'gemini-2.5-flash' : null,
    retrievedChunks: null,
    sourcesType: null,
    sources,
  };
}

describe('Chat IA: historial, fuentes y sesiones por expediente (HU-127, 128, 130)', () => {
  let http: HttpTestingController;
  let queryCaseId: string | null;

  beforeEach(() => {
    queryCaseId = null;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
        {
          provide: LoginService,
          useValue: {
            currentUser: signal(null),
            getAccessToken: vi.fn(() => 'unit-test-token'),
            clearSession: vi.fn(),
          },
        },
        {
          provide: ActivatedRoute,
          useFactory: () => ({
            snapshot: {
              queryParamMap: convertToParamMap(queryCaseId ? { caseId: queryCaseId } : {}),
            },
          }),
        },
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function mount(sessions: ChatSession[] = [session]) {
    const fixture = TestBed.createComponent(ChatIaComponent);
    fixture.detectChanges();
    http.expectOne('/api/cases').flush([legalCase, otherCase]);
    http.expectOne((r) => r.url === '/api/chat/sessions').flush(sessions);
    fixture.detectChanges();
    return fixture;
  }

  function open(fixture: ReturnType<typeof mount>, history: ChatMessage[], s = session) {
    fixture.componentInstance.select(s);
    http.expectOne((r) => r.url === `/api/chat/sessions/${s.sessionId}/messages`).flush(history);
    fixture.detectChanges();
  }

  // ---- HU-127 ------------------------------------------------------------------

  it('HU-127: muestra el historial en orden y diferencia al usuario de la IA', () => {
    const f = mount();
    open(f, [msg(1, 'USER'), msg(2, 'ASSISTANT', [source]), msg(3, 'USER')]);
    const bubbles = Array.from<HTMLElement>(f.nativeElement.querySelectorAll('.log .bubble'));
    expect(bubbles.map((b) => b.classList.contains('user'))).toEqual([true, false, true]);
    expect(bubbles[0].querySelector('.bubble-head strong')?.textContent).toBe('Tú');
    expect(bubbles[1].querySelector('.bubble-head strong')?.textContent).toBe('Asistente IA');
  });

  it('HU-127: con una sesión vacía invita a hacer la primera pregunta', () => {
    const f = mount([{ ...session, messageCount: 0 }]);
    open(f, [], { ...session, messageCount: 0 });
    expect(f.nativeElement.querySelector('.log .empty')?.textContent).toContain(
      'Escribe tu primera pregunta',
    );
  });

  it('HU-127: muestra el error del historial', () => {
    const f = mount();
    f.componentInstance.select(session);
    http
      .expectOne((r) => r.url === '/api/chat/sessions/12/messages')
      .flush({ message: 'Sesion no encontrada' }, { status: 404, statusText: 'Not Found' });
    expect(f.componentInstance.chatError()).toBe('404: Sesion no encontrada');
  });

  // ---- HU-128 ------------------------------------------------------------------

  it('HU-128: lista documento y fragmento de cada fuente con enlace al documento', () => {
    const f = mount();
    open(f, [msg(1, 'USER'), msg(2, 'ASSISTANT', [source])]);
    const sources = f.nativeElement.querySelector('.sources') as HTMLElement;
    expect(sources.textContent).toContain('contrato.pdf · fragmento 3');
    const link = sources.querySelector('a.source-link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/documentos?caseId=1&documentId=5');
    expect(link.getAttribute('aria-label')).toBe('Abrir el documento contrato.pdf');
  });

  it('HU-128: avisa cuando una respuesta no tiene fuentes', () => {
    const f = mount();
    open(f, [msg(2, 'ASSISTANT', []), msg(4, 'ASSISTANT', null), msg(5, 'USER')]);
    const notes = Array.from<HTMLElement>(f.nativeElement.querySelectorAll('.no-sources')).map(
      (n) => n.textContent?.trim(),
    );
    expect(notes).toEqual([
      'Esta respuesta no usó fragmentos de documentos.',
      'No se conservó la información de las fuentes de esta respuesta.',
    ]);
  });

  // ---- HU-130 ------------------------------------------------------------------

  it('HU-130: el selector de expediente filtra las sesiones con caseId', () => {
    const f = mount();
    f.componentInstance.setCaseFilter('2');
    const req = http.expectOne((r) => r.url === '/api/chat/sessions');
    expect(req.request.params.get('caseId')).toBe('2');
    req.flush([]);
    f.detectChanges();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { caseId: 2 } }),
    );
  });

  it('HU-130: un expediente sin sesiones ofrece crear una nueva en ese expediente', () => {
    queryCaseId = '2';
    const f = mount([]);
    const empty = f.nativeElement.querySelector('.session-list .empty') as HTMLElement;
    expect(empty.textContent).toContain('Este expediente aún no tiene conversaciones.');
    const button = empty.querySelector('button') as HTMLButtonElement;
    expect(button.textContent?.trim()).toBe('+ Nueva conversación en este expediente');
    button.click();
    http.expectOne('/api/cases/2/documents').flush([]);
    expect(f.componentInstance.creating()).toBe(true);
    expect(f.componentInstance.createForm.controls.caseId.value).toBe(2);
  });

  it('HU-130: abre la conversación elegida de la lista filtrada', () => {
    queryCaseId = '1';
    const f = mount();
    const button = f.nativeElement.querySelector('.session-main') as HTMLButtonElement;
    button.click();
    http.expectOne((r) => r.url === '/api/chat/sessions/12/messages').flush([msg(1, 'USER')]);
    f.detectChanges();
    expect(f.componentInstance.activeId()).toBe(12);
    expect(f.nativeElement.querySelector('#chat-active-title')?.textContent).toBe(
      'Análisis inicial',
    );
  });
});
