import { CurrentUserResponse } from './response/current-user-response';

export type ClientType = 'PERSON' | 'COMPANY';
export interface ClientRequest {
  clientType: ClientType;
  fullNameOrCompany: string;
  documentNumber: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}
export interface ClientResponse extends ClientRequest {
  clientId: number;
  createdAt: string;
  updatedAt: string;
}
export interface ClientCaseResponse {
  caseId: number;
  clientId: number;
  title: string;
  description: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED' | 'ARCHIVED';
  openedAt: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
/** ClienteCantidadDocumentosResponseDTO: GET /api/clients/document-count (incluye clientes con 0). */
export interface ClientDocumentCountResponse {
  clientId: number;
  nombreCliente: string;
  cantidadDocumentos: number;
}
export type UserResponse = CurrentUserResponse;
export interface UserUpdateRequest {
  fullName: string;
  email: string;
}
export interface RoleRequest {
  name: string;
  description: string | null;
}
export interface RoleResponse extends RoleRequest {
  roleId: number;
}

export interface ChatSessionResponseDTO {
  sessionId: number;
  caseId: number;
  documentId: number | null;
  documentScopeRequired: boolean;
  title: string | null;
  messageCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChatMessageDTO {
  messageId: number;
  sessionId: number;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  createdAt: string;
}

export interface CitacionIAResponseDTO {
  citationId: number;
  messageId: number;
  documentId: number | null;
  chunkId: number | null;
  relevanceScore: number | null;
}
