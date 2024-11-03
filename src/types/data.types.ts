import { LatencyLog } from './request.types';
import { ReducedSession } from './session.types';

export interface Message {
  event: string;
  data: any;
  nspRoomId: string;
  session: ReducedSession;
  requestId: string;
  latencyLog: LatencyLog;
  global?: boolean;
}

export interface PersistedMessage {
  roomId: string;
  event: string;
  message?: Message;
}
