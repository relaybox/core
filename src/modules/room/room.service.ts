import { RedisClient } from '../../lib/redis';
import * as repository from './room.repository';
import { Session } from '../../types/session.types';
import { getLogger } from '../../util/logger';
import { WebSocket } from 'uWebSockets.js';
import { Logger } from 'winston';
import { KeyNamespace } from '../../types/state.types';
import { restoreRoomSubscriptions } from '../subscription/subscription.service';

const logger = getLogger('room');

export async function joinRoom(
  redisClient: RedisClient,
  session: Session,
  nspRoomId: string,
  socket: WebSocket<Session>
): Promise<void> {
  const { uid, connectionId } = session;

  logger.info(`Joining room ${nspRoomId}`, { uid, connectionId });

  try {
    await repository.setRoomJoin(redisClient, connectionId, nspRoomId);
    socket.subscribe(nspRoomId);
  } catch (err: any) {
    logger.error(`Failed to join room`, { err, uid, connectionId });
    throw err;
  }
}

export async function leaveRoom(
  redisClient: RedisClient,
  session: Session,
  nspRoomId: string,
  socket: WebSocket<Session>
): Promise<void> {
  const { uid, connectionId } = session;

  logger.info(`Leaving room ${nspRoomId}`, { uid, connectionId });

  try {
    await repository.setRoomLeave(redisClient, connectionId, nspRoomId);
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
    const rooms = await repository.getCachedRooms(redisClient, connectionId);
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
            joinRoom(redisClient, session, nspRoomId, socket),
            restoreRoomSubscriptions(
              redisClient,
              connectionId,
              nspRoomId,
              KeyNamespace.SUBSCRIPTIONS,
              socket
            ),
            restoreRoomSubscriptions(
              redisClient,
              connectionId,
              nspRoomId,
              KeyNamespace.PRESENCE,
              socket
            ),
            restoreRoomSubscriptions(
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
