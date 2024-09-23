import { Session } from 'src/types/session.types';
import { RedisClient } from '@/lib/redis';
import { KeyPrefix, KeySuffix } from '@/types/state.types';

export function setSessionActive(
  redisClient: RedisClient,
  connectionId: string,
  data: string,
  expiry: number
): Promise<string | null> {
  return redisClient.set(`${KeyPrefix.SESSION}:${connectionId}:${KeySuffix.ACTIVE}`, data, {
    EX: expiry
  });
}
