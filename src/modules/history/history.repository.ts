import { RedisClient } from '../../lib/redis';

export function addMessageToRoomHistory(
  redisClient: RedisClient,
  key: string,
  // timestamp: any,
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
  limit: number
): Promise<any[]> {
  return redisClient.zRangeWithScores(key, max, min, {
    BY: 'SCORE',
    REV: true,
    LIMIT: {
      offset: 0,
      count: limit
    }
  });
}
