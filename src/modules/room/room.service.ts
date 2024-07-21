// import { Socket } from 'socket.io';
import uWS from 'uWebSockets.js';
import { RedisClient } from '../../lib/redis';
import { getRoomByConnectionId, setRoomJoin, setRoomLeave } from './room.repository';
import { Session } from '../../types/session.types';
import { getLogger } from '../../util/logger';

const logger = getLogger('room');

export async function joinRoom(
  redisClient: RedisClient,
  session: Session,
  nspRoomId: string,
  socket: uWS.WebSocket<Session>
): Promise<void> {
  const { uid, connectionId } = session;

  logger.info(`Joining room ${nspRoomId}`, { uid, connectionId });

  try {
    await setRoomJoin(redisClient, connectionId, nspRoomId);
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
  socket: uWS.WebSocket<Session>
): Promise<void> {
  const { uid, connectionId } = session;

  logger.info(`Leaving room ${nspRoomId}`, { uid, connectionId });

  try {
    await setRoomLeave(redisClient, connectionId, nspRoomId);
    socket.unsubscribe(nspRoomId);
  } catch (err: any) {
    logger.error(`Failed to leave room`, { err, uid, connectionId });
    throw err;
  }
}
