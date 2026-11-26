import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { DocumentoComponent } from './documento-component';
import {
  CaseResponse,
  DocumentPreparationResponse,
  DocumentResponse,
  preparationTone,
} from '../../models/documento';
import { SemanticSearchResult, relevanceScore } from '../../models/semantic-search';
import { SemanticSearchService } from '../../services/semantic-search-service';
import { LoginService } from '../../services/login-service';
import { jwtInterceptor } from '../../services/jwt.interceptor';

const legalCase: CaseResponse = {
  caseId: 5,
  clientId: 1,
  title: 'Caso de prueba',
  description: null,
  status: 'OPEN',
  openedAt: '2026-11-01',
  closedAt: null,
  createdAt: '2026-11-01T10:00:00',
  updatedAt: '2026-11-01T10:00:00',
};
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
  extractedTextLength: 120,
  hasExtractedText: true,
};
const failed: DocumentResponse = {
  ...doc,
  processingStatus: 'ERROR',
  hasExtractedText: false,
  extractedTextLength: 0,
};
const prep: DocumentPreparationResponse = {
  documentId: 31,
  processingStatus: 'PROCESSED',
  stage: 'CHUNKS_REQUIRED',
  readyForRag: false,
  chunks: 0,
  embeddedChunks: 0,
};
const ready: DocumentPreparationResponse = {
  ...prep,
  stage: 'READY',
  readyForRag: true,
  chunks: 3,
  embeddedChunks: 3,
};
const results: SemanticSearchResult[] = [
  {
    chunkId: 41,
    documentId: 31,
    chunkIndex: 4,
    content: 'Penalidad por incumplimiento',
    distance: 0.31,
    documentName: 'contrato.pdf',
    charStart: 10,
    charEnd: 40,
  },
  {
    chunkId: 40,
    documentId: 31,
    chunkIndex: 0,
    content: 'Cláusula de penalidad',
    distance: 0.12,
    documentName: 'contrato.pdf',
    charStart: 0,
    charEnd: 20,
  },
];

describe('Documentos: fragmentos, estado, reintento y búsqueda (HU-122, 124, 125, 101)', () => {
  let http: HttpTestingController;
  let query: Record<string, string>;

  beforeEach(() => {
    query = {};
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
          useFactory: () => ({ snapshot: { queryParamMap: convertToParamMap(query) } }),
        },
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function mount(docs: DocumentResponse[] = [doc]) {
    const fixture = TestBed.createComponent(DocumentoComponent);
    fixture.detectChanges();
    http.expectOne('/api/cases').flush([legalCase]);
    http.expectOne('/api/cases/5/documents').flush(docs);
    fixture.detectChanges();
    return fixture;
  }

  function openDetail(
    c: DocumentoComponent,
    d: DocumentResponse = doc,
    p: DocumentPreparationResponse = prep,
  ) {
    c.showDetail(d);
    http.expectOne(`/api/documents/${d.documentId}`).flush(d);
    http.expectOne(`/api/documents/${d.documentId}/preparation`).flush(p);
  }

  const buttons = (root: HTMLElement, selector: string) =>
    Array.from<HTMLButtonElement>(root.querySelectorAll(selector));

  // ---- HU-122 ------------------------------------------------------------------

  it('HU-122: genera los fragmentos desde el detalle y muestra cuántos se crearon', () => {
    const f = mount();
    const c = f.componentInstance;
    openDetail(c);
    f.detectChanges();
    const button = buttons(f.nativeElement, '.dialog .actions button').find(
      (b) => b.textContent?.trim() === 'Generar fragmentos',
    );
    expect(button).toBeDefined();
    button!.click();
    const req = http.expectOne('/api/documents/31/chunks');
    expect(req.request.method).toBe('POST');
    req.flush({ documentId: 31, chunksCreated: 7, chunkSize: 1000, overlap: 150 });
    http
      .expectOne('/api/documents/31/preparation')
      .flush({ ...prep, stage: 'EMBEDDINGS_REQUIRED', chunks: 7 });
    expect(c.notice).toContain('Se generaron 7 fragmentos');
    expect(c.preparation?.chunks).toBe(7);
  });

  it('HU-122: sin texto extraído avisa que primero hay que procesarlo y no llama a la API', () => {
    const uploaded: DocumentResponse = { ...failed, processingStatus: 'UPLOADED' };
    const c = mount([uploaded]).componentInstance;
    openDetail(c, uploaded, {
      ...prep,
      processingStatus: 'UPLOADED',
      stage: 'EXTRACTION_REQUIRED',
    });
    c.generateChunks();
    http.expectNone('/api/documents/31/chunks');
    expect(c.error).toBe(
      'El documento no tiene texto extraído. Primero procésalo y luego genera sus fragmentos.',
    );
  });

  it('HU-122: muestra el error de la API al generar fragmentos', () => {
    const c = mount().componentInstance;
    openDetail(c);
    c.generateChunks();
    http
      .expectOne('/api/documents/31/chunks')
      .flush(
        { message: 'El documento no tiene texto util para generar chunks' },
        { status: 400, statusText: 'Bad Request' },
      );
    http.expectOne('/api/documents/31').flush(doc);
    http.expectOne('/api/documents/31/preparation').flush(prep);
    expect(c.error).toBe('400: El documento no tiene texto util para generar chunks');
  });

  // ---- HU-124 ------------------------------------------------------------------

  it('HU-124: asigna un color a cada etapa y explica el motivo', () => {
    expect(preparationTone('READY')).toBe('ready');
    expect(preparationTone('PROCESSING')).toBe('pending');
    expect(preparationTone('EMBEDDINGS_REQUIRED')).toBe('pending');
    expect(preparationTone('EXTRACTION_ERROR')).toBe('error');
    expect(preparationTone('EMBEDDINGS_UNAVAILABLE')).toBe('error');
    const c = mount().componentInstance;
    expect(c.stageReason('READY')).toBe('');
    expect(c.stageReason('EXTRACTION_ERROR')).toContain('PDF escaneados');
  });

  it('HU-124: la tabla muestra el estado con color y el motivo del error', () => {
    const f = mount([failed]);
    const badge = f.nativeElement.querySelector('td .badge.status') as HTMLElement;
    expect(badge.dataset['status']).toBe('ERROR');
    expect(badge.textContent?.trim()).toBe('Error');
    expect(f.nativeElement.querySelector('.status-reason')?.textContent).toContain(
      'No se pudo extraer el texto',
    );
  });

  it('HU-124: indica "aún no listo" mientras procesa y permite actualizar el estado', () => {
    const processing: DocumentResponse = { ...doc, processingStatus: 'PROCESSING' };
    const f = mount([processing]);
    const c = f.componentInstance;
    openDetail(c, processing, { ...prep, processingStatus: 'PROCESSING', stage: 'PROCESSING' });
    f.detectChanges();
    const box = f.nativeElement.querySelector('.prep') as HTMLElement;
    expect(box.dataset['tone']).toBe('pending');
    expect(box.textContent).toContain('Aún no está listo: se está procesando.');
    c.refreshPreparation();
    http.expectOne('/api/documents/31').flush(doc);
    http.expectOne('/api/documents/31/preparation').flush(ready);
    expect(c.preparation?.stage).toBe('READY');
    expect(c.documents[0].processingStatus).toBe('PROCESSED');
  });

  // ---- HU-125 ------------------------------------------------------------------

  it('HU-125: "Reintentar" solo aparece para documentos en ERROR', () => {
    const f = mount([doc, { ...failed, documentId: 32, fileName: 'escaneado.pdf' }]);
    const retries = buttons(f.nativeElement, '.row-actions button').filter(
      (b) => b.textContent?.trim() === 'Reintentar',
    );
    expect(retries.length).toBe(1);
    expect(retries[0].getAttribute('aria-label')).toBe(
      'Reintentar la preparación de escaneado.pdf',
    );
    const c = f.componentInstance;
    c.retry(doc);
    http.expectNone('/api/documents/31/prepare');
  });

  it('HU-125: reintenta con POST /prepare y refresca el estado en la tabla', () => {
    const c = mount([failed]).componentInstance;
    c.retry(c.documents[0]);
    const req = http.expectOne('/api/documents/31/prepare');
    expect(req.request.method).toBe('POST');
    req.flush(ready);
    http.expectOne('/api/documents/31').flush(doc);
    expect(c.documents[0].processingStatus).toBe('PROCESSED');
    expect(c.notice).toBe('Preparación reintentada. Estado: Listo para la IA.');
  });

  it('HU-125: si vuelve a fallar muestra el error y conserva el estado ERROR', () => {
    const c = mount([failed]).componentInstance;
    openDetail(c, failed, { ...prep, processingStatus: 'ERROR', stage: 'EXTRACTION_ERROR' });
    c.retry(failed);
    http
      .expectOne('/api/documents/31/prepare')
      .flush(
        { message: 'No se pudo extraer texto del PDF' },
        { status: 400, statusText: 'Bad Request' },
      );
    http.expectOne('/api/documents/31').flush(failed);
    http
      .expectOne('/api/documents/31/preparation')
      .flush({ ...prep, processingStatus: 'ERROR', stage: 'EXTRACTION_ERROR' });
    expect(c.error).toBe('400: No se pudo extraer texto del PDF');
    expect(c.selected?.processingStatus).toBe('ERROR');
    expect(c.preparation?.stage).toBe('EXTRACTION_ERROR');
  });

  // ---- HU-128: enlace desde una fuente del chat ---------------------------------

  it('HU-128: abre el detalle del documento recibido en ?documentId', async () => {
    query = { caseId: '5', documentId: '31' };
    const f = mount();
    await new Promise((r) => setTimeout(r));
    http.expectOne('/api/documents/31').flush(doc);
    http.expectOne('/api/documents/31/preparation').flush(ready);
    expect(f.componentInstance.selected?.documentId).toBe(31);
  });

  // ---- HU-101: búsqueda semántica ----------------------------------------------

  it('HU-101 CA-01: busca en el documento y ordena por relevancia con su puntaje', () => {
    const f = mount();
    const c = f.componentInstance;
    openDetail(c, doc, ready);
    c.searchQuery = '  penalidad  ';
    c.searchTopK = 10;
    c.search();
    const req = http.expectOne('/api/documents/31/search');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ query: 'penalidad', topK: 10 });
    expect(req.request.headers.get('Authorization')).toBe('Bearer unit-test-token');
    req.flush(results);
    f.detectChanges();
    expect(c.searchResults?.map((r) => r.chunkId)).toEqual([40, 41]);
    expect(c.score(c.searchResults![0])).toBeCloseTo(0.88, 5);
    const items = f.nativeElement.querySelectorAll('.semantic-results li');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toMatch(/Relevancia 0[.,]88/);
    expect(items[0].textContent).toContain('Cláusula de penalidad');
  });

  it('HU-101 CA-02: con la consulta vacía pide un texto sin llamar a la API', () => {
    const c = mount().componentInstance;
    openDetail(c, doc, ready);
    c.searchQuery = '   ';
    c.search();
    http.expectNone('/api/documents/31/search');
    expect(c.searchError).toBe('Escribe un texto para buscar.');
  });

  it('HU-101 CA-03: muestra el error del servicio de búsqueda', () => {
    const c = mount().componentInstance;
    openDetail(c, doc, ready);
    c.searchQuery = 'penalidad';
    c.search();
    http
      .expectOne('/api/documents/31/search')
      .flush(
        { message: 'Servicio de embeddings no disponible' },
        { status: 503, statusText: 'Unavailable' },
      );
    expect(c.searchError).toBe('503: Servicio de embeddings no disponible');
    expect(c.searchResults).toBeNull();
  });

  it('HU-101 CA-03: avisa si el documento no está preparado y no hay resultados', () => {
    const f = mount();
    const c = f.componentInstance;
    openDetail(c, doc, { ...prep, stage: 'EMBEDDINGS_REQUIRED', chunks: 3 });
    c.searchQuery = 'penalidad';
    c.search();
    http.expectOne('/api/documents/31/search').flush([]);
    f.detectChanges();
    const text = f.nativeElement.querySelector('.semantic')?.textContent ?? '';
    expect(text).toContain('El documento aún no está listo para la IA');
    expect(text).toContain('No se encontraron fragmentos');
  });

  it('HU-101: el servicio también busca en un expediente y acota el puntaje', () => {
    const api = TestBed.inject(SemanticSearchService);
    let rows: SemanticSearchResult[] = [];
    api.searchCase(5, ' arriendo ', 3).subscribe((r) => (rows = r));
    const req = http.expectOne('/api/cases/5/search');
    expect(req.request.body).toEqual({ query: 'arriendo', topK: 3 });
    req.flush(results);
    expect(rows.map((r) => r.distance)).toEqual([0.12, 0.31]);
    expect(relevanceScore(1.4)).toBe(0);
    expect(relevanceScore(-0.1)).toBe(1);
  });
});
