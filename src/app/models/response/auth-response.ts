import { CurrentUserResponse } from './current-user-response';

export interface AuthResponse {
  tokenType: 'Bearer';
  accessToken: string;
  user: CurrentUserResponse;
}
