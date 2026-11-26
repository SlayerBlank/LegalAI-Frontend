// HU-101: contratos de SemanticSearchController (POST /api/documents/{id}/search y /api/cases/{id}/search).

/** Límites de SemanticSearchRequestDTO: query obligatoria y topK entre 1 y 20 (5 por defecto). */
export const SEARCH_TOP_K_MIN = 1;
export const SEARCH_TOP_K_MAX = 20;
export const SEARCH_TOP_K_DEFAULT = 5;
export const SEARCH_TOP_K_OPTIONS = [3, 5, 10, 20];

/** SemanticSearchRequestDTO */
export interface SemanticSearchRequest {
  query: string;
  topK: number;
}

/** SemanticSearchResultDTO: distance es la distancia coseno (menor = más relevante). */
export interface SemanticSearchResult {
  chunkId: number;
  documentId: number;
  chunkIndex: number;
  content: string;
  distance: number;
  documentName: string | null;
  charStart: number | null;
  charEnd: number | null;
}

/** Puntaje de relevancia mostrado al usuario: 1 - distancia coseno, acotado a [0, 1]. */
export function relevanceScore(distance: number): number {
  return Math.min(1, Math.max(0, 1 - distance));
}
