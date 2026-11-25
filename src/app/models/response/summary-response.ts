import { SummaryRequest } from '../request/summary-request';

export interface SummaryResponse extends SummaryRequest {
  summaryId: number;
  generatedByUserId: number;
  createdAt: string;
}

/** SummariesConsultaResponseDTO: GET /api/summaries/filter (HU-65). */
export interface SummaryFilterResponse {
  summaryId: number;
  documentId: number | null;
  summaryType: string;
  content: string;
  createdAt: string;
}
