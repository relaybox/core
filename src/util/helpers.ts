export function getNspRoomId(appPid: string, roomId: string): string {
  return `${appPid}:${roomId}`;
}

export function getNspClientId(appPid: string, clientId: string): string {
  return `${appPid}:${clientId}`;
}

export function extractRoomId(nspRoomId: string): string {
  const [_, roomId] = nspRoomId.split(/:(.+)/);
  return roomId;
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

export function getExternalClientId(clientId: string): string | null {
  return clientId?.split(':')[1] || null;
}
