import { PoolClient } from 'pg';
import { Logger } from 'winston';
import { WebSocket } from 'uWebSockets.js';
import { RedisClient } from '@/lib/redis';
import * as cache from '@/modules/room/room.cache';
import * as db from '@/modules/room/room.db';
import { ReducedSession, Session } from '@/types/session.types';
import { KeyNamespace } from '@/types/state.types';
import { restoreRoomSubscriptions } from '@/modules/subscription/subscription.service';
import { Room, RoomMember, RoomMemberType, RoomVisibility } from '@/types/room.types';
import {
  ForbiddenError,
  NotFoundError,
  PasswordRequiredError,
  ValidationError
} from '@/lib/errors';
import { permissionsGuard } from '@/modules/guards/guards.service';
import { DsPermission } from '@/types/permissions.types';
import { generateSecret, strongHash } from '@/lib/encryption';
import { PasswordSaltPair } from '@/types/auth.types';
import { verifyAuthToken } from '@/lib/token';
import { ClientJwtPayload } from '@/types/jwt.types';

export async function joinRoom(
  logger: Logger,
  redisClient: RedisClient,
  session: Session,
  nspRoomId: string,
  socket: WebSocket<Session>
): Promise<void> {
  const { uid, connectionId } = session;

  logger.info(`Joining room ${nspRoomId}`, { uid, connectionId });

  try {
    await cache.setRoomJoin(redisClient, connectionId, nspRoomId);
    socket.subscribe(nspRoomId);
  } catch (err: any) {
    logger.error(`Failed to join room`, { err, uid, connectionId });
    throw err;
  }
}

export async function leaveRoom(
  logger: Logger,
  redisClient: RedisClient,
  session: Session,
  nspRoomId: string,
  socket: WebSocket<Session>
): Promise<void> {
  const { uid, connectionId } = session;

  logger.info(`Leaving room ${nspRoomId}`, { uid, connectionId });

  try {
    await cache.setRoomLeave(redisClient, connectionId, nspRoomId);
    socket.unsubscribe(nspRoomId);
  } catch (err: any) {
    logger.error(`Failed to leave room`, { err, uid, connectionId });
    throw err;
  }
}

export async function getCachedRooms(
  logger: Logger,
  redisClient: RedisClient,
  connectionId: string
): Promise<string[] | null> {
  try {
    const rooms = await cache.getCachedRooms(redisClient, connectionId);
    return Object.keys(rooms);
  } catch (err: any) {
    logger.error(`Failed to get cached rooms`, { err, connectionId });
    throw err;
  }
}

export async function restoreCachedRooms(
  logger: Logger,
  redisClient: RedisClient,
  session: Session,
  socket: WebSocket<Session>
): Promise<void> {
  const { uid, connectionId } = session;

  try {
    const rooms = await getCachedRooms(logger, redisClient, connectionId);

    logger.debug(`Restoring session, rooms (${rooms?.length})`, { uid, rooms });

    if (rooms && rooms.length > 0) {
      const subscriptions = [
        KeyNamespace.SUBSCRIPTIONS,
        KeyNamespace.PRESENCE,
        KeyNamespace.METRICS,
        KeyNamespace.INTELLECT
      ];

      await Promise.all(
        rooms.map(async (nspRoomId) =>
          Promise.all([
            joinRoom(logger, redisClient, session, nspRoomId, socket),
            ...subscriptions.map((subscription: KeyNamespace) =>
              restoreRoomSubscriptions(
                logger,
                redisClient,
                connectionId,
                nspRoomId,
                subscription,
                socket
              )
            )
          ])
        )
      );
    }
  } catch (err: any) {
    logger.error(`Failed to restore cached rooms`, { err });
    throw err;
  }
}

export async function getRoomByConnectionId(
  logger: Logger,
  redisClient: RedisClient,
  connectionId: string,
  nspRoomId: string
): Promise<string | undefined> {
  try {
    return await cache.getRoomByConnectionId(redisClient, connectionId, nspRoomId);
  } catch (err: any) {
    logger.error(`Failed to get room by connection id`, { err });
    throw err;
  }
}

export async function getRoomById(
  logger: Logger,
  pgClient: PoolClient,
  appPid: string,
  roomId: string,
  clientId: string
): Promise<Room | undefined> {
  try {
    const { rows: rooms } = await db.getRoomById(pgClient, appPid, roomId, clientId);

    return rooms[0];
  } catch (err: any) {
    logger.error(`Failed to get room by id`, { err });
    throw err;
  }
}

export async function initializeRoom(
  logger: Logger,
  pgClient: PoolClient,
  roomId: string,
  roomName: string | null,
  visibility: RoomVisibility = RoomVisibility.PUBLIC,
  roomMemberType: RoomMemberType = RoomMemberType.OWNER,
  session: ReducedSession,
  passwordSaltPair: PasswordSaltPair
): Promise<Room | undefined> {
  logger.debug(`Creating room, if not exists`, { roomId, session });

  let room: Room | undefined;

  const { appPid } = session;

  try {
    await pgClient.query('BEGIN');

    const { rows: rooms } = await db.createRoom(
      pgClient,
      roomId,
      roomName,
      visibility,
      appPid,
      passwordSaltPair
    );

    if (rooms.length > 0) {
      room = rooms[0];
      const roomUuid = rooms[0].id;
      await upsertRoomMember(logger, pgClient, roomId, roomUuid, roomMemberType, session);
    } else {
      logger.debug(`Room already exists, no further action required`);
    }

    await pgClient.query('COMMIT');
  } catch (err: any) {
    await pgClient.query('ROLLBACK');
    logger.error(`Failed to create room ${roomId}:`, err);
    throw err;
  }

  return room;
}

export async function upsertRoomMember(
  logger: Logger,
  pgClient: PoolClient,
  roomId: string,
  roomUuid: string,
  roomMemberType: RoomMemberType,
  session: ReducedSession
): Promise<void> {
  logger.debug(`Upserting room member ${session.uid} as ${roomMemberType} to room ${roomId}`, {
    roomId,
    session
  });

  try {
    const { appPid, clientId, uid } = session;

    await db.upsertRoomMember(pgClient, roomId, roomUuid, roomMemberType, appPid, clientId, uid);
  } catch (err: any) {
    logger.error(`Failed to add room owner ${session.uid} to room ${roomId}:`, err);
    throw err;
  }
}

export async function updateRoomMemberType(
  logger: Logger,
  pgClient: PoolClient,
  roomUuid: string,
  clientId: string,
  roomMemberType: RoomMemberType
): Promise<void> {
  logger.debug(`Updating room member ${roomMemberType} in room ${roomUuid}`);

  try {
    await db.updateRoomMemberType(pgClient, roomUuid, clientId, roomMemberType);
  } catch (err: any) {
    logger.error(`Failed to update room member type:`, err);
    throw err;
  }
}

export async function removeRoomMember(
  logger: Logger,
  pgClient: PoolClient,
  clientId: string,
  roomUuid: string
): Promise<string> {
  logger.debug(`Removing room member`, { roomUuid, clientId });

  try {
    const { rows: existingMembers } = await db.getRoomMember(pgClient, clientId, roomUuid);

    if (!existingMembers.length) {
      throw new NotFoundError('Room member not found');
    }

    if (existingMembers[0].memberType === RoomMemberType.OWNER) {
      throw new ForbiddenError('Unable to delete room owner');
    }

    const { rows: members } = await db.removeRoomMember(pgClient, clientId, roomUuid);

    return members[0].id;
  } catch (err: any) {
    logger.error(`Failed to remove room member ${roomUuid}:`, err);
    throw err;
  }
}

export async function getRoomMember(
  logger: Logger,
  pgClient: PoolClient,
  clientId: string,
  roomUuid: string
): Promise<RoomMember> {
  logger.debug(`Getting room member ${roomUuid}:`, { clientId });

  try {
    const { rows: members } = await db.getRoomMember(pgClient, clientId, roomUuid);

    return members[0];
  } catch (err: any) {
    logger.error(`Failed to get room member ${roomUuid}:`, err);
    throw err;
  }
}

export function validateRoomAccess(logger: Logger, room: Room, session: Session): boolean {
  logger.debug(`Evaluating room access`, { session });

  const { permissions } = session;
  const { visibility, roomId, memberCreatedAt, memberDeletedAt } = room;

  if (memberDeletedAt) {
    throw new ForbiddenError('Room access denied');
  }

  if (visibility === RoomVisibility.PRIVATE) {
    permissionsGuard(roomId, DsPermission.PRIVACY, permissions);
  }

  if (visibility === RoomVisibility.PRIVATE && !memberCreatedAt) {
    throw new ForbiddenError('Room access denied');
  }

  return true;
}

export function validateRoomCreatePermissions(
  logger: Logger,
  roomId: string,
  visibility: RoomVisibility,
  session: Session
): boolean {
  logger.debug(`Evaluating room access`, { session });

  const { permissions } = session;

  if (visibility === RoomVisibility.PRIVATE) {
    permissionsGuard(roomId, DsPermission.PRIVACY, permissions);
  }

  return true;
}

export function validateRoomId(roomId: string): boolean {
  const roomIdRegex = /^[a-zA-Z0-9-_:.]+$/;

  if (!roomIdRegex.test(roomId)) {
    throw new ValidationError(
      'Invalid room id. Only alphanumeric characters, hyphens, underscores, colons and periods are allowed.'
    );
  }

  return true;
}

export function validateRoomVisibility(visibility: RoomVisibility): boolean {
  const values = Object.values(RoomVisibility);

  if (!values.includes(visibility)) {
    throw new ValidationError(`Unsupported room type. Supported values: ${values.join(', ')}`);
  }

  return true;
}

export function getPasswordSaltPair(password: string): PasswordSaltPair {
  const salt = generateSecret();
  const passwordHash = strongHash(password, salt);

  return {
    password: passwordHash,
    salt
  };
}

export function validateClientPassword(logger: Logger, room: Room, clientPassword: string): void {
  logger.debug(`Validating user password, ${room.roomId}`);

  const { password, salt } = room;

  if (!password || !salt || !clientPassword) {
    throw new PasswordRequiredError('Password required');
  }

  const passwordHash = strongHash(clientPassword, salt);

  if (!passwordHash || passwordHash !== password) {
    throw new ForbiddenError('Password access denied');
  }
}

export async function updateRoomPassword(
  logger: Logger,
  pgClient: PoolClient,
  roomUuid: string,
  passwordSaltPair: PasswordSaltPair
): Promise<void> {
  logger.debug(`Updating room password`, { roomUuid });

  try {
    await db.updateRoomPassword(pgClient, roomUuid, passwordSaltPair);
  } catch (err: any) {
    logger.error(`Failed to update room password`, { err, roomUuid });
    throw err;
  }
}

export async function getRoomsByClientId(
  logger: Logger,
  pgClient: PoolClient,
  appPid: string,
  clientId: string,
  offset?: number,
  limit?: number
): Promise<Room[]> {
  logger.debug(`Getting rooms by client id`, { clientId });

  try {
    const { rows: rooms } = await db.getRoomsByClientId(pgClient, appPid, clientId, offset, limit);
    return rooms[0];
  } catch (err: any) {
    logger.error(`Failed to get rooms by client id`, { err, clientId });
    throw err;
  }
}

export function roomActionPermitted(
  memberType: RoomMemberType,
  requiredMemberType: RoomMemberType
): boolean {
  if (memberType === RoomMemberType.OWNER) {
    return true;
  }

  return requiredMemberType === RoomMemberType.ADMIN && memberType !== RoomMemberType.MEMBER;
}

export async function verifyRoomAccessToken(
  logger: Logger,
  roomId: string,
  token: string,
  secretKey: string
): Promise<ClientJwtPayload> {
  logger.debug(`Verifying room access token`);

  const payload = verifyAuthToken(token, secretKey) as ClientJwtPayload;

  if (payload.roomId !== roomId) {
    throw new ForbiddenError('Room access denied');
  }

  return payload;
}
