import { RedisClient } from '../../lib/redis';
import { KeyPrefix, KeySuffix } from '../../types/state.types';

export async function setRoomJoin(
  redisClient: RedisClient,
  connectionId: string,
  nspRoomId: string
): Promise<number> {
  const now = new Date().toISOString();

  return redisClient.hSet(
    `${KeyPrefix.CONNECTION}:${connectionId}:${KeySuffix.ROOMS}`,
    nspRoomId,
    now
  );
}

export async function setRoomLeave(
  redisClient: RedisClient,
  connectionId: string,
  nspRoomId: string
): Promise<number> {
  return redisClient.hDel(`${KeyPrefix.CONNECTION}:${connectionId}:${KeySuffix.ROOMS}`, nspRoomId);
}

export async function getCachedRooms(
  redisClient: RedisClient,
  connectionId: string
): Promise<Record<string, string>> {
  return redisClient.hGetAll(`${KeyPrefix.CONNECTION}:${connectionId}:${KeySuffix.ROOMS}`);
}

export function getRoomByConnectionId(
  redisClient: RedisClient,
  connectionId: string,
  nspRoomId: string
): Promise<string | undefined> {
  return redisClient.hGet(`${KeyPrefix.CONNECTION}:${connectionId}:${KeySuffix.ROOMS}`, nspRoomId);
}
