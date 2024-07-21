import { ServerEvent } from './event.types';

export enum SocketDisconnectReason {
  SERVER_NAMESPACE_DISCONNECT = 'server namespace disconnect',
  CLIENT_NAMESPACE_DISCONNECT = 'client namespace disconnect',
  SERVER_SHUTTING_DOWN = 'server shutting down',
  PING_TIMEOUT = 'ping timeout',
  TRANSPORT_CLOSE = 'transport close',
  TRANSPORT_ERROR = 'transport error',
  PARSE_ERROR = 'parse error',
  FORCED_CLOSE = 'forced close',
  FORCED_SERVER_CLOSE = 'forced server close'
}

export type SocketAckHandler = (...args: any[]) => void;

export enum SocketConnectionEventType {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect'
}

export interface SocketConnectionEvent {
  connectionEventType: SocketConnectionEventType;
  connectionEventTimestamp: Date;
}

export interface SocketUserData {
  token: string;
}

export interface SocketMessage {
  event: ServerEvent;
  data: any;
}

export enum SocketSubscriptionEvent {
  SUBSCRIPTION_CREATE = 'create-subscription',
  SUBSCRIPTION_DELETE = 'delete-subscription'
}
