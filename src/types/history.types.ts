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
