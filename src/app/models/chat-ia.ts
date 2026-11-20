// Contratos reales de ChatController (/api/chat) y sus DTOs.

/** Límites de ChatCreateSessionRequestDTO, ChatUpdateSessionRequestDTO y ChatSendMessageRequestDTO. */
export const CHAT_TITLE_MAX = 150;
export const CHAT_MESSAGE_MAX = 2000;
/** legalai.chat.max-page-size: el backend recorta size a este valor. */
export const CHAT_PAGE_SIZE_MAX = 100;
/** normalizarClientMessageId: hasta 64 caracteres de [A-Za-z0-9._:-]. */
export const CHAT_CLIENT_MESSAGE_ID = /^[A-Za-z0-9._:-]{1,64}$/;

/** ChatSessionResponseDTO */
export interface ChatSession {
  sessionId: number;
  caseId: number;
  /** Documento que acota la sesión; null si usa el expediente completo. */
  documentId: number | null;
  /** true si la sesión se limitó a un documento (aunque ese documento ya no exista). */
  documentScopeRequired: boolean;
  title: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string | null;
}

/**
 * ChatCreateSessionRequestDTO: POST /api/chat/sessions.
 * El backend rechaza campos desconocidos y documentId: null, por eso los opcionales se omiten.
 */
export interface ChatCreateSessionRequest {
  caseId: number;
  documentId?: number;
  title?: string;
}

/** ChatUpdateSessionRequestDTO: PATCH /api/chat/sessions/{id} */
export interface ChatUpdateSessionRequest {
  title: string;
}

/** ChatSendMessageRequestDTO: POST /api/chat/sessions/{id}/messages (clientMessageId nunca null). */
export interface ChatSendMessageRequest {
  content: string;
  clientMessageId?: string;
}

/** RAGSourceDTO: fragmento enviado al modelo; no es una cita verificada. */
export interface ChatSource {
  reference: string;
  documentId: number;
  documentName: string;
  chunkId: number;
  chunkIndex: number;
  excerpt: string;
  distance: number;
  charStart: number | null;
  charEnd: number | null;
}

export type ChatRole = 'USER' | 'ASSISTANT';

/** ChatMessageDTO: GET /api/chat/sessions/{id}/messages. Los metadatos son null en mensajes USER. */
export interface ChatMessage {
  messageId: number;
  role: ChatRole;
  content: string;
  createdAt: string;
  provider: string | null;
  model: string | null;
  retrievedChunks: number | null;
  sourcesType: string | null;
  sources: ChatSource[] | null;
}

/** ChatMessageResponseDTO: turno completo devuelto al enviar un mensaje. */
export interface ChatMessageResponse {
  sessionId: number;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  provider: string | null;
  model: string | null;
  retrievedChunks: number | null;
  sourcesType: string | null;
  sources: ChatSource[] | null;
}

/** Parámetros opcionales de paginación (page desde 0). */
export interface ChatPage {
  page?: number;
  size?: number;
}
