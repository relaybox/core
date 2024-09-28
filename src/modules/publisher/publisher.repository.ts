import { RedisClient } from '@/lib/redis';

export function addRoomHistoryMessage(
  redisClient: RedisClient,
  key: string,
  timestamp: number,
  messageData: any
): Promise<number> {
  return redisClient.zAdd(key, {
    score: timestamp,
    value: JSON.stringify(messageData)
  });
}
