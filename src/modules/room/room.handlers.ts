import uWS from 'uWebSockets.js';
import { Logger } from 'winston';
import { SocketAckHandler } from '../../types/socket.types';
import { Session } from '../../types/session.types';
import { RedisClient } from '../../lib/redis';
import { getNspEvent, getNspRoomId, getRoomBindingId } from '../../util/helpers';
import { joinRoom, leaveRoom } from './room.service';
import { getReducedSession, setSessionActive } from '../session/session.service';
import {
  getLatencyLog,
  pushRoomJoinMetrics,
  pushRoomLeaveMetrics
} from '../metrics/metrics.service';
import { formatErrorResponse, formatPresenceSubscription } from '../../util/format';
import { SubscriptionType } from '../../types/subscription.types';
import { removeActiveMember } from '../presence/presence.service';
import { unbindAllSubscriptions } from '../subscription/subscription.service';
import { KeyNamespace } from '../../types/state.types';
import { permissionsGuard } from '../guards/guards.service';
import { DsPermission } from '../../types/permissions.types';
import AmqpManager from '../../lib/amqp-manager';

export async function clientRoomJoin(
  logger: Logger,
  redisClient: RedisClient,
  socket: uWS.WebSocket<Session>,
  data: any,
  res: SocketAckHandler,
  createdAt: string
): Promise<void> {
  const session = socket.getUserData();

  const { roomId } = data;

  logger.info('Joining room', { session, data });

  try {
    const nspRoomId = getNspRoomId(session.appPid, roomId);
    const roomBindingId = getRoomBindingId(nspRoomId);

    await Promise.all([
      joinRoom(redisClient, session, nspRoomId, socket),
      joinRoom(redisClient, session, roomBindingId, socket),
      // setSessionActive(session, socket),
      pushRoomJoinMetrics(redisClient, session, roomId, nspRoomId)
    ]);

    res(nspRoomId);
  } catch (err: any) {
    logger.error({ message: err.message, roomId, session });
    res(null, formatErrorResponse(err));
  }
}

export async function clientRoomLeave(
  logger: Logger,
  redisClient: RedisClient,
  socket: uWS.WebSocket<Session>,
  data: any,
  res: SocketAckHandler,
  createdAt: string
): Promise<void> {
  const session = socket.getUserData();

  const { roomId } = data;
  const { uid, connectionId } = session;

  logger.info('Leaving room', { session, data });

  try {
    const nspRoomId = getNspRoomId(session.appPid, roomId);
    const roomBindingId = getRoomBindingId(nspRoomId);
    const presenceSubsciption = formatPresenceSubscription(nspRoomId, SubscriptionType.LEAVE);

    await Promise.all([
      leaveRoom(redisClient, session, nspRoomId, socket),
      leaveRoom(redisClient, session, roomBindingId, socket),
      removeActiveMember(uid, nspRoomId, presenceSubsciption, session),
      unbindAllSubscriptions(
        redisClient,
        connectionId,
        nspRoomId,
        KeyNamespace.SUBSCRIPTIONS,
        socket
      ),
      unbindAllSubscriptions(redisClient, connectionId, nspRoomId, KeyNamespace.PRESENCE, socket),
      unbindAllSubscriptions(redisClient, connectionId, nspRoomId, KeyNamespace.METRICS, socket),
      pushRoomLeaveMetrics(uid, nspRoomId, session)
    ]);

    res(nspRoomId);
  } catch (err: any) {
    logger.error(`Leave room failed`, {
      message: err.message,
      roomId,
      session
    });

    res(null, formatErrorResponse(err));
  }
}

export async function clientPublish(
  logger: Logger,
  redisClient: RedisClient,
  socket: uWS.WebSocket<Session>,
  data: any,
  res: SocketAckHandler,
  createdAt: string
): Promise<void> {
  const session = socket.getUserData();

  logger.info(`Client publish event`, { session });

  const { roomId, event, data: messageData } = data;

  const nspRoomId = getNspRoomId(session.appPid, roomId);
  const nspEvent = getNspEvent(nspRoomId, event);
  const latencyLog = getLatencyLog(createdAt);

  try {
    permissionsGuard(roomId, DsPermission.PUBLISH, session.permissions);
    const reducedSession = getReducedSession(session);

    const amqpManager = AmqpManager.getInstance();

    amqpManager.dispatchHandler
      .to(nspRoomId)
      .dispatch(nspEvent, messageData, reducedSession, latencyLog);

    res(messageData);
  } catch (err: any) {
    res(null, formatErrorResponse(err));
  }
}
