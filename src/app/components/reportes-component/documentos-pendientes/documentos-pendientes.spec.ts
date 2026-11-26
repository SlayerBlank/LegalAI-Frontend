import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { PendingDocumentResponse, ProcessingStatus } from '../../../models/documento';
import { LoginService } from '../../../services/login-service';
import { DocumentosPendientesComponent } from './documentos-pendientes';

const PENDING = '/api/documents/pending-review/70';

function doc(
  documentId: number,
  caseId: number,
  status: ProcessingStatus,
  caseTitle: string | null = caseId === 10 ? 'Demanda laboral' : null,
): PendingDocumentResponse {
  return {
    documentId,
    caseId,
    caseTitle,
    fileName: `doc-${documentId}.pdf`,
    fileType: 'application/pdf',
    storageUrl: null,
    category: null,
    sizeBytes: 1000,
    processingStatus: status,
    createdAt: '2026-11-01T10:00:00',
    updatedAt: '2026-11-01T10:00:00',
    extractedTextLength: 0,
    hasExtractedText: false,
  };
}

const docs = [doc(1, 10, 'UPLOADED'), doc(2, 10, 'ERROR'), doc(3, 11, 'UPLOADED')];

describe('DocumentosPendientesComponent (HU-140)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem('legalai-language');
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(LoginService).currentUser.set({
      userId: 70,
      roleId: 2,
      roleName: 'USER',
      fullName: 'Ana Garcia',
      email: 'ana@example.com',
      status: 'ACTIVE',
      createdAt: '2026-11-17',
      updatedAt: '2026-11-17',
    });
  });
  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  async function mount(rows: PendingDocumentResponse[]) {
    const f = TestBed.createComponent(DocumentosPendientesComponent);
    f.detectChanges();
    http.expectOne(PENDING).flush(rows);
    // CA-02: el título del expediente llega en la misma respuesta; no se pide /api/cases.
    http.expectNone('/api/cases');
    f.detectChanges();
    await f.whenStable();
    return f;
  }

  it('CA-01: usa el id del usuario actual y agrupa por estado de procesamiento', async () => {
    const f = await mount(docs);
    expect(f.componentInstance.rows().map((r) => [r.label, r.count])).toEqual([
      ['Subido', 2],
      ['Procesando', 0],
      ['Error', 1],
    ]);
    expect(f.nativeElement.querySelector('canvas')).not.toBeNull();
  });

  it('CA-02: detalle de documentos con su expediente', async () => {
    const f = await mount(docs);
    const detail = Array.from(
      f.nativeElement.querySelectorAll('table[aria-labelledby="r140-detail"] tbody tr'),
    ).map((tr) => Array.from((tr as HTMLTableRowElement).cells).map((c) => c.textContent!.trim()));
    expect(detail.map((r) => r.slice(0, 3))).toEqual([
      ['doc-1.pdf', 'Demanda laboral', 'Subido'],
      ['doc-2.pdf', 'Demanda laboral', 'Error'],
      ['doc-3.pdf', 'Expediente #11', 'Subido'],
    ]);
  });

  it('si el backend no envía el título del expediente, muestra su número', async () => {
    const f = await mount([doc(4, 12, 'PROCESSING', null)]);
    expect(f.componentInstance.query.hasData()).toBe(true);
    expect(f.nativeElement.textContent).toContain('Expediente #12');
  });

  it('CA-03: sin pendientes muestra el mensaje', async () => {
    const f = await mount([]);
    expect(f.nativeElement.textContent).toContain('No tienes documentos pendientes de revisión');
    expect(f.nativeElement.querySelector('table')).toBeNull();
  });
});
