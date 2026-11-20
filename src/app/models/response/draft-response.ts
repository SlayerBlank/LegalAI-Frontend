import { DraftRequest } from '../request/draft-request';

export interface DraftResponse extends DraftRequest {
  draftId: number;
  createdByUserId: number;
  createdAt: string;
  updatedAt: string;
}
