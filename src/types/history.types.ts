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

export interface Message {
  id: string;
  body: any;
  sender: MessageSender;
  timestamp: number;
  event: string;
}

export interface HistoryRequestParams {
  limit: number;
  start: number | null;
  end: number | null;
  order: QueryOrder;
}

export interface HistoryNextPageTokenData {
  start: number | null;
  end: number | null;
  order: QueryOrder;
  limit: number;
}
