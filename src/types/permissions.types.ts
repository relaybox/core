export const DS_PERMISSIONS_WILDCARD = '*';

export enum DsPermission {
  SUBSCRIBE = 'subscribe',
  PUBLISH = 'publish',
  PRESENCE = 'presence',
  METRICS = 'metrics'
}

export interface DsPermissions {
  [room: string]: string[];
}
