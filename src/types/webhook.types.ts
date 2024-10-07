import { Session } from './session.types';

export interface WebhookPayload {
  id: string;
  event: string;
  data: any;
  session: Session;
}

export enum WebhookEvent {
  ROOM_JOIN = 'room:join',
  ROOM_LEAVE = 'room:leave',
  ROOM_PUBLISH = 'room:publish'
}
