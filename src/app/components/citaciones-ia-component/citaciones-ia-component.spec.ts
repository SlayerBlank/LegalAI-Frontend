import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { CitacionesIaComponent } from './citaciones-ia-component';
import { CitacionIAResponseDTO } from '../../models/management';
import { DocumentChunkResponse, DocumentResponse } from '../../models/documento';
import { CitacionesIaService, CitedFragment } from '../../services/citaciones-ia-service';
import { LoginService } from '../../services/login-service';
import { jwtInterceptor } from '../../services/jwt.interceptor';

const citation: CitacionIAResponseDTO = {
  citationId: 7,
  messageId: 302,
  documentId: 31,
  chunkId: 102,
  relevanceScore: 0.873,
};
const doc: DocumentResponse = {
  documentId: 31,
  caseId: 5,
  fileName: 'contrato.pdf',
  fileType: 'application/pdf',
  storageUrl: 'abc.pdf',
  category: null,
  sizeBytes: 2048,
  processingStatus: 'PROCESSED',
  createdAt: '2026-11-02T10:00:00',
  updatedAt: '2026-11-02T10:00:00',
  extractedTextLength: 900,
  hasExtractedText: true,
};
const chunks: DocumentChunkResponse[] = [
  { chunkId: 101, documentId: 31, chunkIndex: 0, content: 'Primera', charStart: 0, charEnd: 7 },
  {
    chunkId: 102,
    documentId: 31,
    chunkIndex: 1,
    content: 'Penalidad por incumplimiento.',
    charStart: 7,
    charEnd: 36,
  },
];

describe('Citaciones IA: fragmento citado (HU-129)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
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
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function resolve(c: CitacionIAResponseDTO): CitedFragment | null {
    let out: CitedFragment | null = null;
    TestBed.inject(CitacionesIaService)
      .citedFragment(c)
      .subscribe((r) => (out = r));
    return out;
  }

  it('resuelve el documento y el fragmento citados', () => {
    let out: CitedFragment | null = null;
    TestBed.inject(CitacionesIaService)
      .citedFragment(citation)
      .subscribe((r) => (out = r));
    const docReq = http.expectOne('/api/documents/31');
    expect(docReq.request.headers.get('Authorization')).toBe('Bearer unit-test-token');
    docReq.flush(doc);
    http.expectOne('/api/documents/31/chunks').flush(chunks);
    expect(out!.document?.fileName).toBe('contrato.pdf');
    expect(out!.chunk?.content).toBe('Penalidad por incumplimiento.');
    expect(out!.documentMissing).toBe(false);
    expect(out!.chunkMissing).toBe(false);
  });

  it('indica que el documento ya no existe sin llamar a la API si documentId es null', () => {
    const out = resolve({ ...citation, documentId: null });
    http.expectNone(() => true);
    expect(out!.documentMissing).toBe(true);
  });

  it('indica que el documento ya no existe cuando el backend responde 404', () => {
    let out: CitedFragment | null = null;
    TestBed.inject(CitacionesIaService)
      .citedFragment(citation)
      .subscribe((r) => (out = r));
    http
      .expectOne('/api/documents/31')
      .flush({ message: 'Documento no encontrado' }, { status: 404, statusText: 'Not Found' });
    expect(out!.documentMissing).toBe(true);
    expect(out!.document).toBeNull();
  });

  it('indica que el fragmento ya no existe si el documento se volvió a fragmentar', () => {
    let out: CitedFragment | null = null;
    TestBed.inject(CitacionesIaService)
      .citedFragment({ ...citation, chunkId: 999 })
      .subscribe((r) => (out = r));
    http.expectOne('/api/documents/31').flush(doc);
    http.expectOne('/api/documents/31/chunks').flush(chunks);
    expect(out!.documentMissing).toBe(false);
    expect(out!.chunkMissing).toBe(true);
  });

  it('muestra en un diálogo el documento, el contenido y el puntaje', () => {
    const fixture = TestBed.createComponent(CitacionesIaComponent);
    fixture.detectChanges();
    http.expectOne('/api/chat/sessions').flush([]);
    const c = fixture.componentInstance;
    c.inspect(citation);
    http.expectOne('/api/documents/31').flush(doc);
    http.expectOne('/api/documents/31/chunks').flush(chunks);
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.textContent).toContain('contrato.pdf');
    expect(dialog.textContent).toContain('Penalidad por incumplimiento.');
    expect(dialog.textContent).toMatch(/0[.,]873/);
    expect(dialog.querySelector('a')?.getAttribute('href')).toBe('/documentos/31/fragmentos');
  });

  it('muestra el aviso de fragmento inexistente y el error con reintento', () => {
    const fixture = TestBed.createComponent(CitacionesIaComponent);
    fixture.detectChanges();
    http.expectOne('/api/chat/sessions').flush([]);
    const c = fixture.componentInstance;
    c.inspect({ ...citation, chunkId: 999 });
    http.expectOne('/api/documents/31').flush(doc);
    http.expectOne('/api/documents/31/chunks').flush(chunks);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('El fragmento citado ya no existe');
    c.inspect(citation);
    http
      .expectOne('/api/documents/31')
      .flush({ message: 'Error interno' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(c.fragmentError).toBe('500: Error interno');
    expect(fixture.nativeElement.textContent).toContain('Reintentar');
    c.closeFragment();
    expect(c.inspecting).toBeNull();
  });
});
