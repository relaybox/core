// INTERIM FUNCTIONS

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

export function isEventSubscription(topic: string): boolean {
  return topic.includes('::') || topic.includes(':$:');
}
