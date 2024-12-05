import { ReducedSession, Session } from '@/types/session.types';

export interface IntellectPublishOptions {
  appPid: string;
  roomId: string;
  input: string;
  conversationId?: string;
  assetId?: string;
  llm?: string;
}

export interface IntellectPayloadOptions extends IntellectPublishOptions {
  id: string;
  timestamp: string;
  appPid: string;
  roomId: string;
  session: ReducedSession;
}
