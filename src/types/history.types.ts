import { QueryOrder } from '@/util/pg-query';
import { AuthUser } from './session.types';

export enum HistoryOrder {
  DESC = 'desc',
  ASC = 'asc'
}

export interface HistoryResponse {
  messages: any[];
  nextPageToken?: string | null;
  itemsRemaining?: number;
}

export interface MessageSender {
  clientId: string;
  connectionId: string;
  user?: AuthUser;
}

export interface MessageMetadata {
  humanMessage?: boolean;
  llmModel?: string;
}

export interface Message {
  id: string;
  body: any;
  sender: MessageSender;
  timestamp: number;
  event: string;
  metadata?: MessageMetadata;
}

export interface HistoryRequestParams {
  lastItemId: string | null;
  event: string | null;
  limit: number;
  start: number | null;
  end: number | null;
  order: QueryOrder;
}

export interface HistoryNextPageTokenData {
  lastItemId: string;
  event: string;
  start: number | null;
  end: number | null;
  order: QueryOrder;
  limit: number;
}
