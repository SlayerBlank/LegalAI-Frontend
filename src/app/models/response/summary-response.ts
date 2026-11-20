import { SummaryRequest } from '../request/summary-request';

export interface SummaryResponse extends SummaryRequest {
  summaryId: number;
  generatedByUserId: number;
  createdAt: string;
}
