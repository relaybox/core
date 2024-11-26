import { PoolClient } from 'pg';
import { Logger } from 'winston';
import { WebSocket } from 'uWebSockets.js';
import { RedisClient } from '@/lib/redis';
import * as cache from '@/modules/room/room.cache';
import * as db from '@/modules/room/room.db';
import { ReducedSession, Session } from '@/types/session.types';
import { KeyNamespace } from '@/types/state.types';
import { restoreRoomSubscriptions } from '@/modules/subscription/subscription.service';
import { Room, RoomMemberType, RoomVisibility } from '@/types/room.types';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { permissionsGuard } from '@/modules/guards/guards.service';
import { DsPermission } from '@/types/permissions.types';

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
      await Promise.all(
        rooms.map(async (nspRoomId) =>
          Promise.all([
            joinRoom(logger, redisClient, session, nspRoomId, socket),
            restoreRoomSubscriptions(
              logger,
              redisClient,
              connectionId,
              nspRoomId,
              KeyNamespace.SUBSCRIPTIONS,
              socket
            ),
            restoreRoomSubscriptions(
              logger,
              redisClient,
              connectionId,
              nspRoomId,
              KeyNamespace.PRESENCE,
              socket
            ),
            restoreRoomSubscriptions(
              logger,
              redisClient,
              connectionId,
              nspRoomId,
              KeyNamespace.METRICS,
              socket
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
  roomId: string,
  clientId: string
): Promise<Room | undefined> {
  try {
    const { rows: rooms } = await db.getRoomById(pgClient, roomId, clientId);

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
  visibility: RoomVisibility = RoomVisibility.PUBLIC,
  roomMemberType: RoomMemberType = RoomMemberType.OWNER,
  session: ReducedSession
): Promise<Room | undefined> {
  logger.debug(`Creating room, if not exists`, { roomId, session });

  try {
    await pgClient.query('BEGIN');

    const { appPid, clientId, connectionId, socketId, uid } = session;

    const { rows: rooms } = await db.createRoom(
      pgClient,
      roomId,
      visibility,
      appPid,
      clientId,
      connectionId!,
      socketId!,
      uid
    );

    if (!rooms.length) {
      logger.debug(`Room already exists, no futher action required`);
      await pgClient.query('COMMIT');
      return undefined;
    }

    const internalId = rooms[0]?.id;

    await upsertRoomMember(logger, pgClient, roomId, internalId, roomMemberType, session);

    await pgClient.query('COMMIT');

    return rooms[0];
  } catch (err: any) {
    await pgClient.query('ROLLBACK');
    logger.error(`Failed to create room ${roomId}:`, err);
    throw err;
  }
}

export async function upsertRoomMember(
  logger: Logger,
  pgClient: PoolClient,
  roomId: string,
  internalId: string,
  roomMemberType: RoomMemberType,
  session: ReducedSession
): Promise<void> {
  logger.debug(`Adding room owner ${session.uid} to room ${roomId}`, { roomId, session });

  try {
    const { appPid, clientId, connectionId, uid } = session;

    await db.upsertRoomMember(
      pgClient,
      roomId,
      internalId,
      roomMemberType,
      appPid,
      clientId,
      connectionId!,
      uid
    );
  } catch (err: any) {
    logger.error(`Failed to add room owner ${session.uid} to room ${roomId}:`, err);
    throw err;
  }
}

export function evaluateRoomAccess(logger: Logger, room: Room, session: Session): boolean {
  logger.debug(`Evaluating room access`, { session });

  const { permissions } = session;
  const { visibility, roomId, memberCreatedAt } = room;

  if (visibility === RoomVisibility.PRIVATE) {
    permissionsGuard(roomId, DsPermission.PRIVACY, permissions);
  }

  if (visibility === RoomVisibility.PRIVATE && !memberCreatedAt) {
    throw new ForbiddenError('Room access denied');
  }

  return true;
}

export function evaluateRoomCreationPermissions(
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
