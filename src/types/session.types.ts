import { DsPermissions } from './permissions.types';

export interface Session {
  uid: string;
  appPid: string;
  keyId: string;
  clientId: string;
  exp: number;
  timestamp: string;
  permissions: DsPermissions;
  anonymous: boolean;
  connectionId: string;
  socketId: string;
}

export interface ReducedSession {
  appPid: string;
  keyId: string;
  uid: string;
  clientId: string;
  connectionId: string;
  socketId: string;
  instanceId?: string | number;
}
