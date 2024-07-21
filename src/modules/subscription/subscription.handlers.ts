import uWS from 'uWebSockets.js';
import { Logger } from 'winston';
import { SocketAckHandler } from '../../types/socket.types';
import { Session } from '../../types/session.types';
import { formatDefaultSubscription, formatErrorResponse } from '../../util/format';
import { getNspRoomId } from '../../util/helpers';
import { permissionsGuard, roomMemberGuard } from '../guards/guards.service';
import { DsPermission } from '../../types/permissions.types';
import { RedisClient } from '../../lib/redis';
import {
  bindSubscription,
  unbindAllSubscriptions,
  unbindSubscription
} from './subscription.service';
import { KeyNamespace } from '../../types/state.types';

export async function clientRoomSubscriptionBind(
  logger: Logger,
  redisClient: RedisClient,
  socket: uWS.WebSocket<Session>,
  data: any,
  res: SocketAckHandler
): Promise<void> {
  const session = socket.getUserData();

  const { roomId, event } = data;
  const { appPid, permissions, connectionId } = session;

  logger.info('Binding subscription', { session, roomId, event });

  const subscription = formatDefaultSubscription(appPid, roomId, event);
  const nspRoomId = getNspRoomId(appPid, roomId);

  try {
    permissionsGuard(roomId, DsPermission.SUBSCRIBE, permissions);

    await roomMemberGuard(redisClient, connectionId, nspRoomId);
    await bindSubscription(
      redisClient,
      connectionId,
      nspRoomId,
      subscription,
      KeyNamespace.SUBSCRIPTIONS,
      socket
    );

    res(subscription);
  } catch (err: any) {
    logger.error(`Failed to bind subscription`, {
      session,
      nspRoomId,
      subscription
    });

    res(null, formatErrorResponse(err));
  }
}

export async function clientRoomSubscriptionUnbind(
  logger: Logger,
  redisClient: RedisClient,
  socket: uWS.WebSocket<Session>,
  data: any,
  res: SocketAckHandler
): Promise<void> {
  const session = socket.getUserData();

  const { roomId, event } = data;
  const { appPid, connectionId } = session;

  logger.info('Unbinding subscription', { session, roomId, event });

  const subscription = formatDefaultSubscription(appPid, roomId, event);
  const nspRoomId = getNspRoomId(appPid, roomId);

  try {
    if (!event) {
      await unbindAllSubscriptions(
        redisClient,
        connectionId,
        nspRoomId,
        KeyNamespace.SUBSCRIPTIONS,
        socket
      );
      res(nspRoomId);
    } else {
      await unbindSubscription(
        redisClient,
        connectionId,
        nspRoomId,
        subscription,
        KeyNamespace.SUBSCRIPTIONS,
        socket
      );
      res(subscription);
    }
  } catch (err: any) {
    logger.error(`Failed to unbind subscription`, {
      session,
      nspRoomId,
      subscription
    });

    res(null, formatErrorResponse(err));
  }
}
