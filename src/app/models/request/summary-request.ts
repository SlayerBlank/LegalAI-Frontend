export interface SummaryRequest {
  caseId: number | null;
  documentId: number | null;
  summaryType: string;
  content: string;
}
