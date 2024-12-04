import { KeyPrefix, KeySuffix } from '@/types/state.types';
import { RedisClient } from '@/lib/redis';

export function isActiveMember(
  redisClient: RedisClient,
  connectionId: string,
  room: string
): Promise<string | undefined> {
  return redisClient.hGet(`${KeyPrefix.PRESENCE}:${room}:${KeySuffix.MEMBERS}`, connectionId);
}

export function getActiveMembersByRoomId(
  redisClient: RedisClient,
  nspRoomid: string
): Promise<{ [x: string]: string }> {
  return redisClient.hGetAll(`${KeyPrefix.PRESENCE}:${nspRoomid}:${KeySuffix.MEMBERS}`);
}

export function getActiveMemberCountByRoomId(
  redisClient: RedisClient,
  nspRoomId: string
): Promise<number> {
  return redisClient.lLen(`${KeyPrefix.PRESENCE}:${nspRoomId}:${KeySuffix.INDEX}`);
}

export function getActiveConnectionIds(
  redisClient: RedisClient,
  nspRoomId: string,
  limit: number
): Promise<string[]> {
  return redisClient.lRange(`${KeyPrefix.PRESENCE}:${nspRoomId}:${KeySuffix.INDEX}`, 0, limit);
}

export function getActiveMembersByConnectionIds(
  redisClient: RedisClient,
  nspRoomId: string,
  connectionIds: string[]
): Promise<string[]> {
  return redisClient.hmGet(
    `${KeyPrefix.PRESENCE}:${nspRoomId}:${KeySuffix.MEMBERS}`,
    connectionIds
  );
}
