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
} from '../../models/documento';
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
const otherCase: CaseResponse = { ...legalCase, caseId: 9, title: 'Otro caso' };
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
const prep: DocumentPreparationResponse = {
  documentId: 31,
  processingStatus: 'PROCESSED',
  stage: 'EMBEDDINGS_REQUIRED',
  readyForRag: false,
  chunks: 3,
  embeddedChunks: 0,
};

function pdf(name = 'demanda.pdf', type = 'application/pdf', size = 10): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('DocumentoComponent - transporte HTTP aislado', () => {
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

  function mount(cases: CaseResponse[] = [legalCase, otherCase], docs: DocumentResponse[] = [doc]) {
    const fixture = TestBed.createComponent(DocumentoComponent);
    fixture.detectChanges();
    http.expectOne('/api/cases').flush(cases);
    if (cases.length)
      http.expectOne((req) => /^\/api\/cases\/\d+\/documents$/.test(req.url)).flush(docs);
    return fixture;
  }

  it('carga los expedientes y los documentos del primero con el token JWT', () => {
    const fixture = TestBed.createComponent(DocumentoComponent);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    const cases = http.expectOne('/api/cases');
    expect(cases.request.headers.get('Authorization')).toBe('Bearer unit-test-token');
    cases.flush([legalCase, otherCase]);
    expect(c.loading).toBe(true);
    http.expectOne('/api/cases/5/documents').flush([doc]);
    expect(c.caseId).toBe(5);
    expect(c.documents).toEqual([doc]);
    expect(c.loading).toBe(false);
    expect(c.loaded).toBe(true);
  });

  it('respeta el expediente pedido en la URL si es propio', () => {
    queryCaseId = '9';
    const c = mount().componentInstance;
    expect(c.caseId).toBe(9);
  });

  it('ignora un expediente de la URL que no pertenece al usuario', () => {
    queryCaseId = '777';
    const c = mount().componentInstance;
    expect(c.caseId).toBe(5);
  });

  it('muestra un estado vacío real cuando no hay expedientes', async () => {
    const f = mount([]);
    await f.whenStable();
    expect(f.componentInstance.caseId).toBeNull();
    expect(f.nativeElement.textContent).toContain('Aún no tienes expedientes');
  });

  it('cambia de expediente y vuelve a pedir sus documentos', () => {
    const c = mount().componentInstance;
    c.selectCase(9);
    http.expectOne('/api/cases/9/documents').flush([]);
    expect(c.caseId).toBe(9);
    expect(c.documents).toEqual([]);
    expect(TestBed.inject(Router).navigate).toHaveBeenCalled();
  });

  it('filtra por estado y texto solo sobre la respuesta recibida', () => {
    const c = mount(
      [legalCase],
      [
        doc,
        {
          ...doc,
          documentId: 32,
          fileName: 'demanda.pdf',
          category: null,
          processingStatus: 'ERROR',
        },
      ],
    ).componentInstance;
    c.filter = 'ERROR';
    expect(c.filtered.map((d) => d.documentId)).toEqual([32]);
    c.filter = '';
    c.query = 'contrato';
    expect(c.filtered.map((d) => d.documentId)).toEqual([31]);
    expect(c.count('PROCESSED')).toBe(1);
    expect(c.count('ERROR')).toBe(1);
  });

  it('valida el PDF en el navegador con las reglas del backend', () => {
    const c = mount().componentInstance;
    expect(c.validateFile(pdf())).toBe('');
    expect(c.validateFile(pdf('foto.png', 'image/png'))).toContain('Solo se permiten archivos PDF');
    expect(c.validateFile(pdf('a.pdf', 'application/pdf', 0))).toContain('vacío');
    expect(c.validateFile(pdf('a.pdf', 'application/pdf', 10 * 1024 * 1024 + 1))).toContain(
      'máximo',
    );
    expect(c.validateFile(pdf('a<b.pdf'))).toContain('no es válido');
  });

  it('sube el PDF como multipart, consulta la preparación y bloquea envíos duplicados', () => {
    const c = mount().componentInstance;
    c.openUpload();
    c.uploadFile = pdf();
    c.uploadCategory = '  Demanda  ';
    c.upload();
    c.upload();
    const req = http.expectOne('/api/cases/5/documents/upload');
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect((body.get('file') as File).name).toBe('demanda.pdf');
    expect(body.get('category')).toBe('Demanda');
    const uploaded = { ...doc, documentId: 40, fileName: 'demanda.pdf' };
    req.flush(uploaded);
    http
      .expectOne('/api/documents/40/preparation')
      .flush({ ...prep, documentId: 40, stage: 'READY', readyForRag: true });
    expect(c.documents[0].documentId).toBe(40);
    expect(c.uploadOpen).toBe(false);
    expect(c.notice).toContain('Listo para la IA');
  });

  it('conserva el documento subido aunque falle la consulta de preparación', () => {
    const c = mount().componentInstance;
    c.openUpload();
    c.uploadFile = pdf();
    c.upload();
    http.expectOne('/api/cases/5/documents/upload').flush({ ...doc, documentId: 41 });
    http
      .expectOne('/api/documents/41/preparation')
      .flush(null, { status: 500, statusText: 'Error' });
    expect(c.documents.some((d) => d.documentId === 41)).toBe(true);
    expect(c.error).toBe('');
    expect(c.notice).toBe('Documento subido correctamente.');
  });

  it('no envía la categoría cuando está vacía y muestra el error del servidor', () => {
    const c = mount().componentInstance;
    c.openUpload();
    c.uploadFile = pdf();
    c.upload();
    const req = http.expectOne('/api/cases/5/documents/upload');
    expect((req.request.body as FormData).has('category')).toBe(false);
    req.flush(
      { message: 'El contenido del archivo no tiene una cabecera PDF valida' },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(c.uploadOpen).toBe(true);
    expect(c.error).toBe('400: El contenido del archivo no tiene una cabecera PDF valida');
  });

  it('abre el detalle con la preparación y prepara el documento para la IA', () => {
    const c = mount().componentInstance;
    c.showDetail(doc);
    http.expectOne('/api/documents/31').flush(doc);
    http.expectOne('/api/documents/31/preparation').flush(prep);
    expect(c.selected?.documentId).toBe(31);
    expect(c.preparation?.stage).toBe('EMBEDDINGS_REQUIRED');
    c.prepare();
    const req = http.expectOne('/api/documents/31/prepare');
    expect(req.request.method).toBe('POST');
    req.flush({ ...prep, stage: 'READY', readyForRag: true, embeddedChunks: 3 });
    http.expectOne('/api/documents/31').flush(doc);
    expect(c.preparation?.readyForRag).toBe(true);
    expect(c.notice).toContain('Listo para la IA');
  });

  it('si la preparación falla muestra el error y refresca el estado real', () => {
    const c = mount().componentInstance;
    c.showDetail(doc);
    http.expectOne('/api/documents/31').flush(doc);
    http.expectOne('/api/documents/31/preparation').flush(prep);
    c.prepare();
    http
      .expectOne('/api/documents/31/prepare')
      .flush(
        { message: 'Servicio de embeddings no disponible' },
        { status: 503, statusText: 'Unavailable' },
      );
    http.expectOne('/api/documents/31').flush(doc);
    http
      .expectOne('/api/documents/31/preparation')
      .flush({ ...prep, stage: 'EMBEDDINGS_UNAVAILABLE' });
    expect(c.error).toContain('Servicio de embeddings no disponible');
    expect(c.preparation?.stage).toBe('EMBEDDINGS_UNAVAILABLE');
  });

  it('carga el texto extraído bajo demanda', () => {
    const c = mount().componentInstance;
    c.showDetail(doc);
    http.expectOne('/api/documents/31').flush(doc);
    http.expectOne('/api/documents/31/preparation').flush(prep);
    c.loadText();
    http.expectOne('/api/documents/31/text').flush({ documentId: 31, text: 'Cláusula primera' });
    expect(c.text).toBe('Cláusula primera');
  });

  it('descarga el PDF como Blob autenticado', () => {
    const c = mount().componentInstance;
    const createUrl = vi.fn(() => 'blob:legalai');
    const revokeUrl = vi.fn();
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: revokeUrl }),
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    c.download(doc);
    const req = http.expectOne('/api/documents/31/download');
    expect(req.request.responseType).toBe('blob');
    expect(req.request.headers.get('Authorization')).toBe('Bearer unit-test-token');
    req.flush(new Blob(['%PDF-1.7'], { type: 'application/pdf' }));
    expect(createUrl).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    click.mockRestore();
    vi.unstubAllGlobals();
  });

  it('elimina solo tras confirmar y la respuesta 204', () => {
    const c = mount().componentInstance;
    c.confirmRemove(doc);
    expect(c.pending).toEqual(doc);
    c.remove();
    expect(c.documents).toHaveLength(1);
    const req = http.expectOne('/api/documents/31');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(c.documents).toHaveLength(0);
    expect(c.pending).toBeNull();
    expect(c.notice).toBe('Documento eliminado correctamente.');
  });

  it('navega a los fragmentos del documento y cierra el detalle', () => {
    const c = mount().componentInstance;
    c.showDetail(doc);
    http.expectOne('/api/documents/31').flush(doc);
    http.expectOne('/api/documents/31/preparation').flush(prep);
    c.openChunks(doc);
    expect(c.selected).toBeNull();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/documentos', 31, 'fragmentos']);
  });

  it('muestra la pantalla en inglés con fechas en formato en-US', async () => {
    localStorage.setItem('legalai-language', 'en');
    try {
      const f = mount();
      await f.whenStable();
      f.detectChanges();
      const text: string = f.nativeElement.textContent;
      expect(text).toContain('Documents');
      expect(text).toContain('Processed');
      expect(text).toContain('11/02/2026');
      expect(f.componentInstance.validateFile(pdf('foto.png', 'image/png'))).toBe(
        'Only PDF files are allowed.',
      );
    } finally {
      localStorage.removeItem('legalai-language');
    }
  });

  it('acepta un PDF soltado en la zona de carga y valida los que no lo son', () => {
    const c = mount().componentInstance;
    c.openUpload();
    const drop = (file: File) =>
      ({ preventDefault: vi.fn(), dataTransfer: { files: [file] } }) as unknown as DragEvent;
    c.onDragOver({ preventDefault: vi.fn() } as unknown as DragEvent);
    expect(c.dragging).toBe(true);
    c.onDrop(drop(pdf('foto.png', 'image/png')));
    expect(c.dragging).toBe(false);
    expect(c.uploadError).toContain('Solo se permiten archivos PDF');
    c.onDrop(drop(pdf('demanda.pdf')));
    expect(c.uploadFile?.name).toBe('demanda.pdf');
    expect(c.uploadError).toBe('');
  });
});
