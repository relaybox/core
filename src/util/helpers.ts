import ConfigManager from '../lib/config-manager';

export function getNspRoomId(appPid: string, roomId: string): string {
  return `${appPid}:${roomId}`;
}

export function getNspEvent(nspRoomId: string, event: string): string {
  return `${nspRoomId}::${event}`;
}

export function getRoomBindingId(nspRoomId: string): string {
  const [appPid, namespace] = nspRoomId.split(':');
  return `${appPid}:${namespace}`;
}

export function getQueryParamRealValue(queryParam: string | undefined): string | undefined {
  if (!queryParam || queryParam === 'undefined') {
    return undefined;
  }

  return queryParam;
}

export function getHashedRoomBindingId(nspRoomId: string): string {
  const [appPid, namespace] = nspRoomId.split(':');
  const hashedNamespace = gethashedNamespace(namespace);

  return `${appPid}:${hashedNamespace}`;
}

export function gethashedNamespace(namespace: string): number {
  const queueCount = ConfigManager.getInt('RABBIT_MQ_QUEUE_COUNT');

  let hash = 0;
  let chr: number;

  for (let i = 0; i < namespace.length; i++) {
    chr = namespace.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }

  return ((hash % queueCount) + queueCount) % queueCount;
}
