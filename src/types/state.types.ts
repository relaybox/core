export enum KeyPrefix {
  USER = 'user',
  APPLICATION = 'application',
  PRESENCE = 'presence',
  METRICS = 'metrics',
  SESSION = 'session',
  CONNECTION = 'connection',
  HEARTBEAT = 'heartbeat',
  HISTORY = 'history'
}

export enum KeySuffix {
  SESSION = 'session',
  ROOMS = 'rooms',
  SECRET = 'secret',
  PENDING = 'pending',
  INDEX = 'index',
  MEMBERS = 'members',
  ACTIVE = 'active',
  KEEP_ALIVE = 'keepalive'
}

export enum KeyNamespace {
  SUBSCRIPTIONS = 'subscriptions',
  PRESENCE = 'presence',
  METRICS = 'metrics'
}
