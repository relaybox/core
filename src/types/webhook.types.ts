import { AuthUser, Session } from './session.types';

export interface ReducedWebhookSessionData {
  appPid: string;
  keyId: string;
  clientId: string | null;
  connectionId: string;
  socketId: string;
  timestamp: string;
  user: AuthUser | null;
  exp: number;
}

export interface WebhookPayload {
  id: string;
  event: string;
  data: any;
  session: ReducedWebhookSessionData;
  timestamp: string;
  filterAttributes?: Record<string, unknown>;
}

export enum WebhookEvent {
  AUTH_SESSION_INITIALIZE = 'auth:session:initialize',
  ROOM_CREATE = 'room:create',
  ROOM_JOIN = 'room:join',
  ROOM_LEAVE = 'room:leave',
  ROOM_PUBLISH = 'room:publish',
  ROOM_PASSWORD_UPDATE = 'room:password:update',
  ROOM_MEMBER_ADD = 'room:member:add',
  PRESENCE_JOIN = 'presence:join',
  PRESENCE_LEAVE = 'presence:leave',
  PRESENCE_UPDATE = 'presence:update',
  USER_STATUS_UPDATE = 'user:status:update'
}
