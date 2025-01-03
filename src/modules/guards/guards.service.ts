import { DsPermission, DsPermissions } from '@/types/permissions.types';
import { matchRoomPermissions } from '@/modules/permissions/permissions.service';
import { Session } from '@/types/session.types';
import { RedisClient } from '@/lib/redis';
import { isActiveMember } from '@/modules/presence/presence.service';
import { getRoomByConnectionId } from '@/modules/room/room.service';
import { Logger } from 'winston';
import { KeyPrefix, KeySuffix } from '@/types/state.types';
import * as cache from '@/modules/guards/guards.cache';
import { ForbiddenError } from '@/lib/errors';
import { RoomMemberType } from '@/types/room.types';

export function authenticatedSessionGuard(session: Session): boolean {
  if (!session.clientId) {
    throw new Error(`No client id provided`);
  }

  return true;
}

export async function activeMemberGuard(
  redisClient: RedisClient,
  connectionId: string,
  nspRoomId: string
): Promise<boolean> {
  const activeMember = await isActiveMember(redisClient, connectionId, nspRoomId);

  if (!activeMember) {
    throw new Error(`Client not member of presence set for ${nspRoomId}`);
  }

  return true;
}

export function permissionsGuard(
  roomId: string,
  permission: DsPermission,
  permissions: DsPermissions | string[]
): boolean {
  if (Array.isArray(permissions)) {
    if (permissions.includes(permission) || permissions.includes('*')) {
      return true;
    }
  } else {
    const roomPermissions = matchRoomPermissions(roomId, permissions);

    if (
      roomPermissions &&
      (roomPermissions.includes('*') || roomPermissions.includes(permission))
    ) {
      return true;
    }
  }

  throw new ForbiddenError(`Client not permitted to perform "${permission}" in "${roomId}"`);
}

export async function roomMemberGuard(
  logger: Logger,
  redisClient: RedisClient,
  connectionId: string,
  nspRoomId: string
): Promise<boolean> {
  const roomJoinedTimestamp = await getRoomByConnectionId(
    logger,
    redisClient,
    connectionId,
    nspRoomId
  );

  if (!roomJoinedTimestamp) {
    throw new Error(`Client not active in room`);
  }

  return true;
}

export async function rateLimitGuard(
  redisClient: RedisClient,
  connectionId: string,
  evaluationPeriodMs: number,
  entryLimit: number
): Promise<number> {
  const key = `${KeyPrefix.RATE}:messages:${connectionId}:${KeySuffix.COUNT}`;

  return cache.evaluateRateLimit(redisClient, key, `${evaluationPeriodMs}`, `${entryLimit}`);
}
