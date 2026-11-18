import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { DocumentoChunkComponent } from './documento-chunk-component';
import {
  DocumentChunkResponse,
  DocumentPreparationResponse,
  DocumentResponse,
} from '../../models/documento';
import { LoginService } from '../../services/login-service';
import { jwtInterceptor } from '../../services/jwt.interceptor';

const doc: DocumentResponse = {
  documentId: 31,
  caseId: 5,
  fileName: 'contrato.pdf',
  fileType: 'application/pdf',
  storageUrl: 'abc.pdf',
  category: 'Contrato',
  sizeBytes: 2048,
  processingStatus: 'PROCESSED',
  createdAt: '2026-11-02T10:00:00',
  updatedAt: '2026-11-02T10:00:00',
  extractedTextLength: 900,
  hasExtractedText: true,
};
const prep: DocumentPreparationResponse = {
  documentId: 31,
  processingStatus: 'PROCESSED',
  stage: 'READY',
  readyForRag: true,
  chunks: 2,
  embeddedChunks: 2,
};
const longText = 'Cláusula primera. '.repeat(30);
const chunks: DocumentChunkResponse[] = [
  { chunkId: 101, documentId: 31, chunkIndex: 0, content: longText, charStart: 0, charEnd: 540 },
  {
    chunkId: 102,
    documentId: 31,
    chunkIndex: 1,
    content: 'Penalidad por incumplimiento del arrendatario.',
    charStart: 500,
    charEnd: 546,
  },
];

describe('DocumentoChunkComponent - transporte HTTP aislado', () => {
  let http: HttpTestingController;
  let routeId: string;

  beforeEach(() => {
    routeId = '31';
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
              paramMap: convertToParamMap({ documentId: routeId }),
              queryParamMap: convertToParamMap({}),
            },
          }),
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function mount(
    rows: DocumentChunkResponse[] = chunks,
    document: DocumentResponse = doc,
    preparation: DocumentPreparationResponse = prep,
  ) {
    const fixture = TestBed.createComponent(DocumentoChunkComponent);
    fixture.detectChanges();
    http.expectOne('/api/documents/31').flush(document);
    http.expectOne('/api/documents/31/chunks').flush(rows);
    http.expectOne('/api/documents/31/preparation').flush(preparation);
    return fixture;
  }

  it('carga documento, fragmentos y preparación con el token JWT', () => {
    const fixture = TestBed.createComponent(DocumentoChunkComponent);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    const req = http.expectOne('/api/documents/31/chunks');
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer unit-test-token');
    http.expectOne('/api/documents/31').flush(doc);
    req.flush(chunks);
    http.expectOne('/api/documents/31/preparation').flush(prep);
    expect(c.chunks).toEqual(chunks);
    expect(c.document?.fileName).toBe('contrato.pdf');
    expect(c.loaded).toBe(true);
  });

  it('no llama al servidor si el id de la ruta no es válido', () => {
    routeId = 'abc';
    const fixture = TestBed.createComponent(DocumentoChunkComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.error).toContain('no es válido');
    http.expectNone(() => true);
  });

  it('calcula estadísticas sobre los fragmentos recibidos', () => {
    const c = mount().componentInstance;
    expect(c.averageLength).toBe(Math.round((longText.length + chunks[1].content.length) / 2));
    expect(c.canRegenerate).toBe(true);
  });

  it('busca dentro del contenido y resalta sin usar HTML', () => {
    const c = mount().componentInstance;
    c.query = 'PENALIDAD';
    expect(c.filtered.map((x) => x.chunkId)).toEqual([102]);
    const parts = c.highlight(chunks[1].content);
    expect(parts[0]).toEqual({ text: 'Penalidad', match: true });
    expect(parts.map((p) => p.text).join('')).toBe(chunks[1].content);
    expect(c.highlight('<b>x</b>')).toEqual([{ text: '<b>x</b>', match: false }]);
  });

  it('muestra una vista previa y expande el fragmento completo', () => {
    const c = mount().componentInstance;
    expect(c.isLong(chunks[0])).toBe(true);
    expect(c.visibleText(chunks[0]).endsWith('…')).toBe(true);
    c.toggle(chunks[0]);
    expect(c.visibleText(chunks[0])).toBe(longText);
    c.toggle(chunks[0]);
    expect(c.visibleText(chunks[0])).not.toBe(longText);
  });

  it('muestra un vacío real y no permite regenerar si no hay texto procesado', async () => {
    const f = mount(
      [],
      { ...doc, processingStatus: 'ERROR', hasExtractedText: false, extractedTextLength: 0 },
      {
        ...prep,
        stage: 'EXTRACTION_ERROR',
        readyForRag: false,
        chunks: 0,
        embeddedChunks: 0,
      },
    );
    await f.whenStable();
    const c = f.componentInstance;
    expect(c.canRegenerate).toBe(false);
    c.askRegenerate();
    expect(c.confirmRegenerate).toBe(false);
    expect(f.nativeElement.textContent).toContain('aún no tiene fragmentos');
  });

  it('regenera solo tras confirmar, recarga y bloquea envíos duplicados', () => {
    const c = mount().componentInstance;
    c.askRegenerate();
    expect(c.confirmRegenerate).toBe(true);
    c.regenerate();
    c.regenerate();
    const req = http.expectOne('/api/documents/31/chunks');
    expect(req.request.method).toBe('POST');
    req.flush({ documentId: 31, chunksCreated: 1, chunkSize: 2500, overlap: 300 });
    http.expectOne('/api/documents/31/chunks').flush([chunks[1]]);
    http
      .expectOne('/api/documents/31/preparation')
      .flush({
        ...prep,
        stage: 'EMBEDDINGS_REQUIRED',
        readyForRag: false,
        chunks: 1,
        embeddedChunks: 0,
      });
    expect(c.chunks).toEqual([chunks[1]]);
    expect(c.preparation?.embeddedChunks).toBe(0);
    expect(c.confirmRegenerate).toBe(false);
    expect(c.notice).toContain('Se generaron 1 fragmentos');
  });

  it('mantiene el diálogo abierto con el error del servidor', () => {
    const c = mount().componentInstance;
    c.askRegenerate();
    c.regenerate();
    http
      .expectOne('/api/documents/31/chunks')
      .flush(
        { message: 'El documento debe estar PROCESSED antes de generar chunks' },
        { status: 400, statusText: 'Bad Request' },
      );
    expect(c.confirmRegenerate).toBe(true);
    expect(c.error).toBe('400: El documento debe estar PROCESSED antes de generar chunks');
    expect(c.chunks).toEqual(chunks);
  });

  it('muestra 404 cuando el documento no es propio', () => {
    const fixture = TestBed.createComponent(DocumentoChunkComponent);
    fixture.detectChanges();
    http
      .expectOne('/api/documents/31')
      .flush({ message: 'Documento no encontrado' }, { status: 404, statusText: 'Not Found' });
    http.match('/api/documents/31/chunks').forEach((r) => expect(r.cancelled).toBe(true));
    http.match('/api/documents/31/preparation').forEach((r) => expect(r.cancelled).toBe(true));
    expect(fixture.componentInstance.error).toBe('404: Documento no encontrado');
  });
});
