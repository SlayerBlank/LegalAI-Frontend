import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { ChatIaComponent } from './chat-ia-component';
import { ChatMessage, ChatMessageResponse, ChatSession } from '../../models/chat-ia';
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
const session: ChatSession = {
  sessionId: 12,
  caseId: 1,
  documentId: null,
  documentScopeRequired: false,
  title: 'Análisis inicial',
  messageCount: 2,
  createdAt: '2026-11-20T09:00:00',
  updatedAt: '2026-11-20T09:05:00',
};
const other: ChatSession = { ...session, sessionId: 13, title: null, messageCount: 0 };

function message(id: number, role: 'USER' | 'ASSISTANT', content: string): ChatMessage {
  return {
    messageId: id,
    role,
    content,
    createdAt: '2026-11-20T09:01:00',
    provider: role === 'ASSISTANT' ? 'gemini' : null,
    model: role === 'ASSISTANT' ? 'gemini-2.5-flash' : null,
    retrievedChunks: role === 'ASSISTANT' ? 1 : null,
    sourcesType: role === 'ASSISTANT' ? 'CONSULTED_FRAGMENTS' : null,
    sources:
      role === 'ASSISTANT'
        ? [
            {
              reference: 'S1',
              documentId: 5,
              documentName: 'contrato.pdf',
              chunkId: 40,
              chunkIndex: 0,
              excerpt: 'Cláusula primera',
              distance: 0.12,
              charStart: 0,
              charEnd: 16,
            },
          ]
        : null,
  };
}

describe('ChatIaComponent - transporte HTTP aislado', () => {
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

  function mount(sessions: ChatSession[] = [session, other]) {
    const fixture = TestBed.createComponent(ChatIaComponent);
    fixture.detectChanges();
    http.expectOne('/api/cases').flush([legalCase]);
    const list = http.expectOne((r) => r.url === '/api/chat/sessions');
    expect(list.request.headers.get('Authorization')).toBe('Bearer unit-test-token');
    list.flush(sessions);
    fixture.detectChanges();
    return fixture;
  }

  function open(c: ChatIaComponent, s = session, history: ChatMessage[] = []) {
    c.select(s);
    http.expectOne((r) => r.url === `/api/chat/sessions/${s.sessionId}/messages`).flush(history);
  }

  it('carga expedientes y sesiones reales con página y tamaño máximo', () => {
    const fixture = TestBed.createComponent(ChatIaComponent);
    fixture.detectChanges();
    http.expectOne('/api/cases').flush([legalCase]);
    const list = http.expectOne((r) => r.url === '/api/chat/sessions');
    expect(list.request.params.get('page')).toBe('0');
    expect(list.request.params.get('size')).toBe('100');
    expect(list.request.params.has('caseId')).toBe(false);
    list.flush([session, other]);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    expect(c.sessions().length).toBe(2);
    expect(c.sessionTitle(other)).toBe('Conversación sin título');
    expect(c.caseTitle(1)).toBe('Demanda laboral');
    expect(fixture.nativeElement.textContent).toContain('Análisis inicial');
  });

  it('filtra por el expediente recibido en la URL', () => {
    queryCaseId = '1';
    const fixture = TestBed.createComponent(ChatIaComponent);
    fixture.detectChanges();
    http.expectOne('/api/cases').flush([legalCase]);
    const list = http.expectOne((r) => r.url === '/api/chat/sessions');
    expect(list.request.params.get('caseId')).toBe('1');
    list.flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Este expediente aún no tiene conversaciones.',
    );
  });

  it('abre la última página del historial y carga mensajes anteriores', () => {
    const c = mount([{ ...session, messageCount: 150 }]).componentInstance;
    c.select(c.sessions()[0]);
    const last = http.expectOne((r) => r.url === '/api/chat/sessions/12/messages');
    expect(last.request.params.get('page')).toBe('1');
    last.flush([message(201, 'USER', 'Pregunta reciente')]);
    expect(c.hasOlder()).toBe(true);
    c.loadOlder();
    const older = http.expectOne((r) => r.url === '/api/chat/sessions/12/messages');
    expect(older.request.params.get('page')).toBe('0');
    older.flush([message(1, 'USER', 'Pregunta antigua')]);
    expect(c.messages().map((m) => m.messageId)).toEqual([1, 201]);
    expect(c.hasOlder()).toBe(false);
  });

  it('envía la pregunta con clientMessageId y muestra la respuesta y sus fuentes', () => {
    const f = mount();
    const c = f.componentInstance;
    open(c);
    c.composer.setValue('  ¿Cuáles son las obligaciones?  ');
    c.send();
    c.send();
    const req = http.expectOne((r) => r.method === 'POST');
    expect(req.request.url).toBe('/api/chat/sessions/12/messages');
    expect(req.request.body.content).toBe('¿Cuáles son las obligaciones?');
    expect(req.request.body.clientMessageId).toMatch(/^[A-Za-z0-9._:-]{1,64}$/);
    expect(Object.keys(req.request.body).sort()).toEqual(['clientMessageId', 'content']);
    const response: ChatMessageResponse = {
      sessionId: 12,
      userMessage: message(301, 'USER', '¿Cuáles son las obligaciones?'),
      assistantMessage: message(302, 'ASSISTANT', 'Pagar la renta.'),
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      retrievedChunks: 1,
      sourcesType: 'CONSULTED_FRAGMENTS',
      sources: null,
    };
    req.flush(response);
    f.detectChanges();
    expect(c.messages().map((m) => m.messageId)).toEqual([301, 302]);
    expect(c.composer.value).toBe('');
    expect(c.sessions()[0].messageCount).toBe(4);
    expect(f.nativeElement.textContent).toContain('Fragmentos consultados (1)');
  });

  it('no envía mensajes vacíos ni de más de 2000 caracteres', () => {
    const c = mount().componentInstance;
    open(c);
    c.composer.setValue('   ');
    c.send();
    c.composer.setValue('x'.repeat(2001));
    c.send();
    http.expectNone((r) => r.method === 'POST');
  });

  it('reintenta con el mismo clientMessageId cuando la IA no responde (503)', () => {
    const c = mount().componentInstance;
    open(c);
    c.composer.setValue('Resume el contrato');
    c.send();
    const first = http.expectOne((r) => r.method === 'POST');
    const id = first.request.body.clientMessageId;
    first.flush(
      { message: 'El servicio de IA no está disponible' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    expect(c.chatError()).toContain('503');
    expect(c.composer.value).toBe('Resume el contrato');
    expect(c.pendingTurn()?.clientMessageId).toBe(id);

    c.send();
    const retry = http.expectOne((r) => r.method === 'POST');
    expect(retry.request.body.clientMessageId).toBe(id);
    retry.flush({
      sessionId: 12,
      userMessage: message(5, 'USER', 'Resume el contrato'),
      assistantMessage: message(6, 'ASSISTANT', 'Resumen'),
      provider: null,
      model: null,
      retrievedChunks: null,
      sourcesType: null,
      sources: null,
    });
    expect(c.pendingTurn()).toBeNull();
    expect(c.chatError()).toBe('');
  });

  it('bloquea el envío si el documento de alcance ya no existe', () => {
    const orphan = { ...session, documentScopeRequired: true, documentId: null };
    const c = mount([orphan]).componentInstance;
    open(c, orphan);
    expect(c.scopeMissing()).toBe(true);
    c.composer.setValue('Hola');
    c.send();
    http.expectNone((r) => r.method === 'POST');
  });

  it('crea una sesión omitiendo documentId y title vacíos', () => {
    const c = mount().componentInstance;
    c.openCreate();
    c.create();
    http.expectNone((r) => r.method === 'POST');

    c.createForm.controls.caseId.setValue(1);
    http.expectOne('/api/cases/1/documents').flush([]);
    c.create();
    const req = http.expectOne((r) => r.method === 'POST');
    expect(req.request.body).toEqual({ caseId: 1 });
    req.flush({ ...session, sessionId: 20, title: 'Nueva conversacion', messageCount: 0 });
    expect(c.creating()).toBe(false);
    expect(c.activeId()).toBe(20);
    expect(c.sessions()[0].sessionId).toBe(20);
  });

  it('crea una sesión acotada a un documento con título', () => {
    const c = mount().componentInstance;
    c.openCreate();
    c.createForm.controls.caseId.setValue(1);
    http.expectOne('/api/cases/1/documents').flush([{ documentId: 5, fileName: 'contrato.pdf' }]);
    expect(c.documents().length).toBe(1);
    c.createForm.patchValue({ documentId: 5, title: '  Contrato  ' });
    c.create();
    const req = http.expectOne((r) => r.method === 'POST');
    expect(req.request.body).toEqual({ caseId: 1, documentId: 5, title: 'Contrato' });
    req.flush({ ...session, sessionId: 21, documentId: 5, documentScopeRequired: true });
  });

  it('renombra con PATCH y valida el título obligatorio', () => {
    const c = mount().componentInstance;
    c.openRename(session);
    c.renameForm.controls.title.setValue('   ');
    c.rename();
    http.expectNone((r) => r.method === 'PATCH');
    c.renameForm.controls.title.setValue(' Contrato de arrendamiento ');
    c.rename();
    const req = http.expectOne((r) => r.method === 'PATCH');
    expect(req.request.url).toBe('/api/chat/sessions/12');
    expect(req.request.body).toEqual({ title: 'Contrato de arrendamiento' });
    req.flush({ ...session, title: 'Contrato de arrendamiento' });
    expect(c.sessions()[0].title).toBe('Contrato de arrendamiento');
    expect(c.renaming()).toBeNull();
  });

  it('elimina tras confirmar y limpia la conversación activa', () => {
    const c = mount().componentInstance;
    open(c);
    c.confirmDelete(session);
    c.remove();
    http
      .expectOne((r) => r.method === 'DELETE')
      .flush({ message: 'Sesion de chat no encontrada' }, { status: 404, statusText: 'Not Found' });
    expect(c.error()).toBe('404: Sesion de chat no encontrada');
    expect(c.sessions().length).toBe(2);

    c.remove();
    http
      .expectOne((r) => r.method === 'DELETE')
      .flush(null, { status: 204, statusText: 'No Content' });
    expect(c.sessions().map((s) => s.sessionId)).toEqual([13]);
    expect(c.activeId()).toBeNull();
    expect(c.deleting()).toBeNull();
  });
});
