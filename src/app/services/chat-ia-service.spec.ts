import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChatIaService } from './chat-ia-service';
import { ChatSession } from '../models/chat-ia';

const session: ChatSession = {
  sessionId: 12,
  caseId: 1,
  documentId: null,
  documentScopeRequired: false,
  title: 'Nueva conversacion',
  messageCount: 0,
  createdAt: '2026-11-20T09:00:00',
  updatedAt: '2026-11-20T09:00:00',
};

describe('ChatIaService', () => {
  let service: ChatIaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ChatIaService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lista sesiones sin parámetros o con caseId, page y size', () => {
    service.listSessions().subscribe();
    const all = http.expectOne('/api/chat/sessions');
    expect(all.request.params.keys()).toEqual([]);
    all.flush([session]);

    service.listSessions(1, { page: 2, size: 100 }).subscribe();
    const byCase = http.expectOne((r) => r.url === '/api/chat/sessions');
    expect(byCase.request.params.get('caseId')).toBe('1');
    expect(byCase.request.params.get('page')).toBe('2');
    expect(byCase.request.params.get('size')).toBe('100');
    byCase.flush([]);
  });

  it('crea, obtiene, renombra con PATCH y elimina sesiones', () => {
    service.createSession({ caseId: 1, title: 'Análisis' }).subscribe();
    const post = http.expectOne('/api/chat/sessions');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ caseId: 1, title: 'Análisis' });
    post.flush(session, { status: 201, statusText: 'Created' });

    service.getSession(12).subscribe();
    http.expectOne('/api/chat/sessions/12').flush(session);

    service.renameSession(12, { title: 'Contrato' }).subscribe();
    const patch = http.expectOne('/api/chat/sessions/12');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ title: 'Contrato' });
    patch.flush({ ...session, title: 'Contrato' });

    service.deleteSession(12).subscribe();
    const del = http.expectOne('/api/chat/sessions/12');
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('consulta el historial paginado y envía mensajes', () => {
    service.history(12, { page: 0, size: 100 }).subscribe();
    const hist = http.expectOne((r) => r.url === '/api/chat/sessions/12/messages');
    expect(hist.request.method).toBe('GET');
    expect(hist.request.params.get('size')).toBe('100');
    hist.flush([]);

    service.send(12, { content: 'Hola', clientMessageId: 'web-1' }).subscribe();
    const send = http.expectOne('/api/chat/sessions/12/messages');
    expect(send.request.method).toBe('POST');
    expect(send.request.body).toEqual({ content: 'Hola', clientMessageId: 'web-1' });
    send.flush({});
  });
});
