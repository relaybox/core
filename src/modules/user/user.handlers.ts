import { Logger } from 'winston';
import { WebSocket } from 'uWebSockets.js';
import { RedisClient } from '../../lib/redis';
import { Session } from '../../types/session.types';
import { SocketAckHandler } from '../../types/socket.types';
import { KeyNamespace } from '../../types/state.types';
import { formatErrorResponse, formatUserSubscription } from '../../util/format';
import { getNspClientId } from '../../util/helpers';
import { bindSubscription, unbindSubscription } from '../subscription/subscription.service';

export async function clientAuthUserSubscribe(
  logger: Logger,
  redisClient: RedisClient,
  socket: WebSocket<Session>,
  data: any,
  res: SocketAckHandler,
  createdAt: string
): Promise<void> {
  const session = socket.getUserData();
  const { appPid, permissions, connectionId } = session;

  const { clientId, event } = data;

  logger.debug('Subscribing to user actions', {
    clientId
  });

  const nspClientId = getNspClientId(appPid, clientId);
  const subscription = formatUserSubscription(nspClientId, event);

  try {
    await bindSubscription(
      redisClient,
      connectionId,
      nspClientId,
      subscription,
      KeyNamespace.USERS,
      socket
    );

    res(subscription);
  } catch (err: any) {
    logger.error(`Failed to subscribe to user actions`, {
      session,
      nspClientId,
      event,
      subscription
    });

    res(null, formatErrorResponse(err));
  }
}

export async function clientAuthUserUnsubscribe(
  logger: Logger,
  redisClient: RedisClient,
  socket: WebSocket<Session>,
  data: any,
  res: SocketAckHandler,
  createdAt: string
): Promise<void> {
  const session = socket.getUserData();
  const { appPid, permissions, connectionId } = session;

  const { clientId, event } = data;

  logger.debug('Unsubscribing from user actions', {
    clientId
  });

  const nspClientId = getNspClientId(appPid, clientId);
  const subscription = formatUserSubscription(nspClientId, event);

  try {
    await unbindSubscription(
      redisClient,
      connectionId,
      nspClientId,
      subscription,
      KeyNamespace.USERS,
      socket
    );

    res(subscription);
  } catch (err: any) {
    logger.error(`Failed to unsubscribe from user actions`, {
      session,
      nspClientId,
      event,
      subscription
    });

    res(null, formatErrorResponse(err));
  }
}
