// Contratos reales del backend (DocumentoController, ExpedienteController y DTOs de documentos).

export type ProcessingStatus = 'UPLOADED' | 'PROCESSING' | 'PROCESSED' | 'ERROR';

export type CaseStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED' | 'ARCHIVED';

/** ExpedienteResponseDTO: GET /api/cases */
export interface CaseResponse {
  caseId: number;
  clientId: number;
  title: string;
  description: string | null;
  status: CaseStatus;
  openedAt: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** DocumentoResponseDTO */
export interface DocumentResponse {
  documentId: number;
  caseId: number;
  fileName: string;
  fileType: string | null;
  storageUrl: string | null;
  category: string | null;
  sizeBytes: number | null;
  processingStatus: ProcessingStatus;
  createdAt: string;
  updatedAt: string;
  extractedTextLength: number;
  hasExtractedText: boolean;
}

/** HU-67/HU-140: DocumentoPendienteResponseDTO, que es el documento más el título de su expediente. */
export interface PendingDocumentResponse extends DocumentResponse {
  caseTitle: string | null;
}

/** Etapas calculadas por DocumentoPreparationServiceImpl.readState */
export type PreparationStage =
  | 'PROCESSING'
  | 'EXTRACTION_ERROR'
  | 'EXTRACTION_REQUIRED'
  | 'CHUNKS_REQUIRED'
  | 'EMBEDDINGS_REQUIRED'
  | 'EMBEDDINGS_UNAVAILABLE'
  | 'READY';

/** HU-124: color con el que se muestra cada etapa (listo, en curso o con error). */
export type PreparationTone = 'ready' | 'pending' | 'error';

export function preparationTone(stage: PreparationStage): PreparationTone {
  if (stage === 'READY') return 'ready';
  if (stage === 'EXTRACTION_ERROR' || stage === 'EMBEDDINGS_UNAVAILABLE') return 'error';
  return 'pending';
}

/** HU-124 y HU-125: DocumentoPreparationResponseDTO de GET/POST /api/documents/{id}/preparation|prepare */
export interface DocumentPreparationResponse {
  documentId: number;
  processingStatus: ProcessingStatus;
  stage: PreparationStage;
  readyForRag: boolean;
  chunks: number;
  embeddedChunks: number;
}

/** DocumentoTextResponseDTO: GET /api/documents/{id}/text */
export interface DocumentTextResponse {
  documentId: number;
  text: string | null;
}

/** Límites del backend: legalai.documents.max-file-size (10MB por defecto) y categoría <= 80. */
export const DOCUMENT_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_CATEGORY_MAX = 80;
export const DOCUMENT_FILE_NAME_MAX = 255;

/**
 * HU-123: DocumentChunkResponseDTO de GET /api/documents/{id}/chunks. Los offsets son sobre el
 * texto normalizado; el backend no guarda números de página.
 */
export interface DocumentChunkResponse {
  chunkId: number;
  documentId: number;
  chunkIndex: number;
  content: string;
  charStart: number;
  charEnd: number;
}

/** HU-122: ChunkGenerationResponseDTO de POST /api/documents/{id}/chunks */
export interface ChunkGenerationResponse {
  documentId: number;
  chunksCreated: number;
  chunkSize: number;
  overlap: number;
}

/** HU-126: EmbeddingGenerationResponseDTO de POST /api/documents/{id}/embeddings */
export interface EmbeddingGenerationResponse {
  documentId: number;
  chunksProcessed: number;
  embeddingsGenerated: number;
}
