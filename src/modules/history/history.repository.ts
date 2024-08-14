import { RedisClient } from '../../lib/redis';

export function addMessageToChannelHistory(
  redisClient: RedisClient,
  key: string,
  timestamp: any,
  messageData: any
): Promise<number> {
  return redisClient.zAdd(key, {
    score: timestamp,
    value: JSON.stringify(messageData)
  });
}

export function getChannelHistoryMessages(
  redisClient: RedisClient,
  key: string,
  lastScore: number,
  endTime: number,
  limit: number
): Promise<any[]> {
  return redisClient.zRangeWithScores(key, endTime, lastScore, {
    BY: 'SCORE',
    REV: true,
    LIMIT: {
      offset: 0,
      count: limit
    }
  });
}
