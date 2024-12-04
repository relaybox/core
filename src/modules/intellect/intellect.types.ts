import { Session } from '@/types/session.types';

export interface IntellectPublishOptions {
  appPid: string;
  roomId: string;
  input: string;
  conversationId?: string;
  assetId?: string;
  llm?: string;
}

export interface IntellectPayloadOptions extends IntellectPublishOptions {
  appPid: string;
  roomId: string;
}
