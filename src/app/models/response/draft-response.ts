import { DraftRequest } from '../request/draft-request';

export interface DraftResponse extends DraftRequest {
  draftId: number;
  createdByUserId: number;
  createdAt: string;
  updatedAt: string;
}

/** DraftsConsultaResponseDTO: GET /api/drafts/filter (HU-64). */
export interface DraftFilterResponse {
  draftId: number;
  title: string;
  status: string;
  updatedAt: string;
}
