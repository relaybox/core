import { DsPermission, DsPermissions } from '@/types/permissions.types';
import { matchRoomPermissions } from '@/modules/permissions/permissions.service';
import { Session } from '@/types/session.types';
import { RedisClient } from '@/lib/redis';
import { isActiveMember } from '@/modules/presence/presence.service';
import { getRoomByConnectionId, getRoomById } from '@/modules/room/room.service';
import { Logger } from 'winston';
import { KeyPrefix, KeySuffix } from '@/types/state.types';
import * as cache from '@/modules/guards/guards.cache';
import { PoolClient } from 'pg';
import { RoomType } from '@/types/room.types';
import { ForbiddenError } from '@/lib/errors';

export function authenticatedSessionGuard(session: Session): boolean {
  if (!session.clientId) {
    throw new Error(`No client id provided`);
  }

  return true;
}

export async function activeMemberGuard(
  redisClient: RedisClient,
  uid: string,
  nspRoomId: string
): Promise<boolean> {
  const activeMember = await isActiveMember(redisClient, uid, nspRoomId);

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

  throw new Error(`Client not permitted to perform "${permission}" in "${roomId}"`);
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

export async function roomAccessGuard(
  logger: Logger,
  pgClient: PoolClient,
  roomId: string,
  session: Session
): Promise<boolean> {
  logger.debug(`Checking room access`, { roomId, session });

  try {
    const { clientId } = session;

    const room = await getRoomById(logger, pgClient, roomId, clientId);

    if (!room || room.roomType === RoomType.PUBLIC) {
      return true;
    }

    if (room.roomType === RoomType.PRIVATE && !room.memberCreatedAt) {
      throw new ForbiddenError('Room access denied');
    }

    return true;
  } catch (err: any) {
    logger.error(`Failed to check room access:`, err);
    throw err;
  }
}
