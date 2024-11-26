import { DsErrorResponse } from '@/types/request.types';
import { KeyNamespace } from '@/types/state.types';

const PLATFORM_RESERVED_NAMESPACE = '$';

export function formatDefaultSubscription(appPid: string, roomId: string, event: string): string {
  return `${appPid}:${roomId}::${event}`;
}

export function formatPresenceSubscription(nspRoomId: string, event: string): string {
  return `${nspRoomId}:${PLATFORM_RESERVED_NAMESPACE}:${KeyNamespace.PRESENCE}:${event}`;
}

export function formatMetricsSubscription(nspRoomId: string, event: string): string {
  return `${nspRoomId}:${PLATFORM_RESERVED_NAMESPACE}:${KeyNamespace.METRICS}:${event}`;
}

export function formatUserSubscription(nspClientId: string, event: string): string {
  return `${nspClientId}:${PLATFORM_RESERVED_NAMESPACE}:${event}`;
}

export function formatErrorResponse(error: Error, status?: number): DsErrorResponse {
  return {
    name: error.name,
    message: error.message,
    ...(status && { status })
  };
}
