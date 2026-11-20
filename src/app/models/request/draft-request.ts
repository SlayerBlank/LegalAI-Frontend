export interface DraftRequest {
  caseId: number;
  title: string;
  prompt: string | null;
  content: string;
  status: string;
}
