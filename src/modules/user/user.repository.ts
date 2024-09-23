import { RedisClient } from '@/lib/redis';

export function bindUserSubscription(
  redisClient: RedisClient,
  key: string,
  subscription: string
): Promise<number> {
  const now = new Date().toISOString();
  return redisClient.hSet(key, subscription, now);
}

export function unbindUserSubscription(
  redisClient: RedisClient,
  key: string,
  subscription: string
): Promise<number> {
  const now = new Date().toISOString();
  return redisClient.hDel(key, subscription);
}

export function pushUserSubscription(
  redisClient: RedisClient,
  key: string,
  clientId: string
): Promise<number> {
  const now = new Date().toISOString();
  return redisClient.hSet(key, clientId, now);
}

export function removeUserSubscription(
  redisClient: RedisClient,
  key: string,
  clientId: string
): Promise<number> {
  const now = new Date().toISOString();
  return redisClient.hDel(key, clientId);
}

export function getUserSubscriptionCount(redisClient: RedisClient, key: string): Promise<number> {
  return redisClient.hLen(key);
}

export function getUserSubscriptions(
  redisClient: RedisClient,
  key: string
): Promise<{ [x: string]: string }> {
  return redisClient.hGetAll(key);
}

export function getCachedUsers(
  redisClient: RedisClient,
  key: string
): Promise<{ [x: string]: string }> {
  return redisClient.hGetAll(key);
}
