import { RedisClient } from '@/lib/redis';
import { Message } from '@/types/data.types';

export function getRoomHistoryMessages(
  redisClient: RedisClient,
  key: string,
  min: number,
  max: number,
  limit: number,
  rev: boolean
): Promise<any[]> {
  return redisClient.zRangeWithScores(key, max, min, {
    BY: 'SCORE',
    ...(rev && { REV: true }),
    LIMIT: {
      offset: 0,
      count: limit
    }
  });
}

export function setCachedMessage(
  redisClient: RedisClient,
  key: string,
  message: Message,
  timestamp: number
): Promise<number> {
  return redisClient.zAdd(key, {
    score: timestamp,
    value: JSON.stringify(message)
  });
}

export function setCachedMessageExpiry(
  redisClient: RedisClient,
  key: string,
  ttl: number
): Promise<boolean> {
  return redisClient.setKeyExpiry(key, ttl);
}
