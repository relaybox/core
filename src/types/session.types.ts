import { DsPermissions } from './permissions.types';

export interface AuthUser {
  id: string;
  clientId: string;
  createdAt: string;
  updatedAt: string;
  username: string;
  orgId: string;
  isOnline: boolean;
  lastOnline: string;
  appId: string;
  blockedAt: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export interface Session {
  uid: string;
  appId: string;
  appPid: string;
  keyId: string;
  clientId: string;
  exp: number;
  timestamp: string;
  permissions: DsPermissions;
  connectionId: string;
  socketId: string;
  user?: AuthUser;
  subscriptions?: Map<string, number>;
}

export interface ReducedSession {
  appPid: string;
  keyId: string;
  uid: string;
  clientId: string;
  connectionId: string | null;
  socketId: string | null;
  instanceId?: string | number;
  user?: AuthUser;
}
