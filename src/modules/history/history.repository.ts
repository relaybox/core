import { RedisClient } from '@/lib/redis';

export function addRoomHistoryMessage(
  redisClient: RedisClient,
  key: string,
  messageData: any
): Promise<number> {
  return redisClient.zAdd(key, {
    score: messageData.timestamp,
    value: JSON.stringify(messageData)
  });
}

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

export function roomHistoryKeyExists(redisClient: RedisClient, key: string): Promise<number> {
  return redisClient.exists(key);
}
