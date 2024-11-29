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

export async function getActiveMemberCountByRoomId(
  redisClient: RedisClient,
  room: string
): Promise<number> {
  return redisClient.lLen(`${KeyPrefix.PRESENCE}:${room}:${KeySuffix.INDEX}`);
}
