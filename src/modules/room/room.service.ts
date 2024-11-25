import { RedisClient } from '@/lib/redis';
import * as cache from './room.cache';
import * as db from './room.db';
import { ReducedSession, Session } from '@/types/session.types';
import { WebSocket } from 'uWebSockets.js';
import { Logger } from 'winston';
import { KeyNamespace } from '@/types/state.types';
import { restoreRoomSubscriptions } from '@/modules/subscription/subscription.service';
import { PoolClient } from 'pg';
import { Room, RoomMemberType, RoomType } from '@/types/room.types';
import { ForbiddenError } from '@/lib/errors';
import { permissionsGuard } from '../guards/guards.service';
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
  roomType: RoomType = RoomType.PUBLIC,
  roomMemberType: RoomMemberType = RoomMemberType.OWNER,
  session: ReducedSession
): Promise<string | null> {
  logger.debug(`Creating room, if not exists`, { roomId, session });

  try {
    await pgClient.query('BEGIN');

    const { appPid, clientId, connectionId, socketId, uid } = session;

    const { rows: rooms } = await db.createRoom(
      pgClient,
      roomId,
      roomType,
      appPid,
      clientId,
      connectionId!,
      socketId!,
      uid
    );

    if (!rooms.length) {
      logger.debug(`Room already exists, no futher action required`);
      await pgClient.query('COMMIT');
      return null;
    }

    const roomInternalId = rooms[0]?.id;

    await addRoomMember(logger, pgClient, roomId, roomInternalId, roomMemberType, session);

    await pgClient.query('COMMIT');

    return roomInternalId;
  } catch (err: any) {
    await pgClient.query('ROLLBACK');
    logger.error(`Failed to create room ${roomId}:`, err);
    throw err;
  }
}

export async function addRoomMember(
  logger: Logger,
  pgClient: PoolClient,
  roomId: string,
  roomInternalId: string,
  roomMemberType: RoomMemberType,
  session: ReducedSession
): Promise<void> {
  logger.debug(`Adding room owner ${session.uid} to room ${roomId}`, { roomId, session });

  try {
    const { appPid, clientId, connectionId, uid } = session;

    await db.addRoomMember(
      pgClient,
      roomId,
      roomInternalId,
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
  const { roomType, roomId, memberCreatedAt } = room;

  if (roomType === RoomType.PRIVATE) {
    permissionsGuard(roomId, DsPermission.PRIVACY, permissions);
  }

  if (roomType === RoomType.PRIVATE && !memberCreatedAt) {
    throw new ForbiddenError('Room access denied');
  }

  return true;
}
