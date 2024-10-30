import { LatencyLog } from '@/types/request.types';

export function getLatencyLog(createdAt: number): LatencyLog {
  const receivedAt = new Date().toISOString();

  return {
    createdAt: new Date(createdAt).toISOString(),
    receivedAt
  };
}
