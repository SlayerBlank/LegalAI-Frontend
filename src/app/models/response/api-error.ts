export interface ApiError {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
}

export function isApiError(value: unknown): value is ApiError {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ApiError>;
  return typeof candidate.status === 'number' && typeof candidate.message === 'string';
}
