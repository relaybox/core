export const DS_PERMISSIONS_WILDCARD = '*';

export enum DsPermission {
  SUBSCRIBE = 'subscribe',
  PUBLISH = 'publish',
  PRESENCE = 'presence',
  METRICS = 'metrics',
  HISTORY = 'history'
}

export interface DsPermissions {
  [room: string]: string[];
}
