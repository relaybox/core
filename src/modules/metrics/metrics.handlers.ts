import uWS from 'uWebSockets.js';
import { Logger } from 'winston';
import { RedisClient } from '../../lib/redis';
import { Session } from '../../types/session.types';
import { SocketAckHandler } from '../../types/socket.types';
import { formatErrorResponse, formatMetricsSubscription } from '../../util/format';
import { getNspRoomId } from '../../util/helpers';
import { permissionsGuard } from '../guards/guards.service';
import { DsPermission } from '../../types/permissions.types';
import { bindSubscription, unbindSubscription } from '../subscription/subscription.service';
import { KeyNamespace } from '../../types/state.types';

export async function clientMetricsSubscribe(
  logger: Logger,
  redisClient: RedisClient,
  socket: uWS.WebSocket<Session>,
  data: any,
  res: SocketAckHandler,
  createdAt: string
): Promise<void> {
  const session = socket.getUserData();
  const { roomId, event } = data;
  const { uid, appPid, permissions, connectionId } = session;

  const nspRoomId = getNspRoomId(appPid, roomId);
  const subscription = formatMetricsSubscription(nspRoomId, event);

  logger.info('Subscribing to metrics', {
    session,
    nspRoomId,
    event,
    subscription
  });

  try {
    permissionsGuard(roomId, DsPermission.METRICS, permissions);

    await bindSubscription(
      redisClient,
      connectionId,
      nspRoomId,
      subscription,
      KeyNamespace.METRICS,
      socket
    );

    res(subscription);
  } catch (err: any) {
    logger.error(`Failed to subscribe to metrics`, { session, nspRoomId, event, subscription });
    res(null, formatErrorResponse(err));
  }
}

export async function clientMetricsUnsubscribe(
  logger: Logger,
  redisClient: RedisClient,
  socket: uWS.WebSocket<Session>,
  data: any,
  res: SocketAckHandler,
  createdAt: string
): Promise<void> {
  const session = socket.getUserData();
  const { roomId, event } = data;
  const { uid, appPid, connectionId } = session;

  const nspRoomId = getNspRoomId(appPid, roomId);
  const subscription = formatMetricsSubscription(nspRoomId, event);

  logger.info('Unsubscribing from metrics', {
    session,
    nspRoomId,
    event,
    subscription
  });

  try {
    await unbindSubscription(
      redisClient,
      connectionId,
      nspRoomId,
      subscription,
      KeyNamespace.METRICS,
      socket
    );

    res(subscription);
  } catch (err: any) {
    logger.error(`Failed to unsubscribe from metrics`, {
      session,
      nspRoomId,
      event,
      subscription
    });

    res(null, formatErrorResponse(err));
  }
}
