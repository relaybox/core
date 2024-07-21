import { RedisClient } from '../../lib/redis';

export function createSubscription(
  redisClient: RedisClient,
  key: string,
  subscription: string
): Promise<number> {
  const now = new Date().toISOString();
  return redisClient.hSet(key, subscription, now);
}

export function deleteSubscription(
  redisClient: RedisClient,
  key: string,
  subscription: string
): Promise<number> {
  return redisClient.hDel(key, subscription);
}

export async function getAllSubscriptions(
  redisClient: RedisClient,
  key: string
): Promise<string[]> {
  const subscriptions = await redisClient.hGetAll(key);

  return Object.keys(subscriptions);
}
