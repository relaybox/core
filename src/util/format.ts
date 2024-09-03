import { DsErrorResponse } from 'src/types/request.types';

const PLATFORM_RESERVED_NAMESPACE = '$';

export function formatDefaultSubscription(appPid: string, roomId: string, event: string): string {
  return `${appPid}:${roomId}::${event}`;
}

export function formatPresenceSubscription(nspRoomId: string, event: string): string {
  return `${nspRoomId}:${PLATFORM_RESERVED_NAMESPACE}:presence:${event}`;
}

export function formatMetricsSubscription(nspRoomId: string, event: string): string {
  return `${nspRoomId}:${PLATFORM_RESERVED_NAMESPACE}:metrics:${event}`;
}

export function formatUserSubscription(nspClientId: string, event: string): string {
  return `${nspClientId}:${PLATFORM_RESERVED_NAMESPACE}:user:${event}`;
}

export function formatErrorResponse(error: Error, status?: number): DsErrorResponse {
  return {
    message: error.message,
    ...(status && { status })
  };
}
