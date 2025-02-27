import { RedisClient } from '@/lib/redis';
import { Message } from '@/types/data.types';

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

export function getCachedMessagesForRange(
  redisClient: RedisClient,
  key: string,
  min: number,
  max: number
): Promise<{ score: number; value: string }[]> {
  return redisClient.zRangeWithScores(key, min, max, { BY: 'SCORE' });
}
