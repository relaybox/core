export const DS_PERMISSIONS_WILDCARD = '*';

export enum DsPermission {
  SUBSCRIBE = 'subscribe',
  PUBLISH = 'publish',
  PRESENCE = 'presence',
  METRICS = 'metrics',
  HISTORY = 'history',
  INTELLECT = 'intellect',
  STORAGE = 'storage',
  PRIVACY = 'privacy'
}

export interface DsPermissions {
  [room: string]: string[] | string[];
}
