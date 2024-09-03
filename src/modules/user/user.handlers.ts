import { Logger } from 'winston';
import { WebSocket } from 'uWebSockets.js';
import { RedisClient } from '../../lib/redis';
import { Session } from '../../types/session.types';
import { SocketAckHandler } from '../../types/socket.types';
import { formatErrorResponse, formatUserSubscription } from '../../util/format';
import { ClientSubscription } from '../../types/subscription.types';
import {
  bindUserSubscription,
  getUserSubscriptions,
  pushUserSubscription,
  removeUserSubscription,
  unbindUserSubscription
} from './user.service';

export async function clientAuthUserSubscribe(
  logger: Logger,
  redisClient: RedisClient,
  socket: WebSocket<Session>,
  data: ClientSubscription,
  res: SocketAckHandler,
  createdAt: string
): Promise<void> {
  const session = socket.getUserData();

  const { connectionId } = session;
  const { subscriptionId: clientId, event } = data;

  logger.debug('Creating user subscription', {
    clientId
  });

  const subscription = formatUserSubscription(clientId, event);

  try {
    await pushUserSubscription(logger, redisClient, connectionId, clientId);
    await bindUserSubscription(logger, redisClient, connectionId, clientId, subscription, socket);

    socket.subscribe(subscription);

    res(subscription);
  } catch (err: any) {
    logger.error(`Failed to bind user subscription`, {
      session,
      clientId,
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
  data: ClientSubscription,
  res: SocketAckHandler,
  createdAt: string
): Promise<void> {
  const session = socket.getUserData();

  const { connectionId } = session;
  const { subscriptionId: clientId, event } = data;

  logger.debug('Deleting user subscription', {
    clientId
  });

  const subscription = formatUserSubscription(clientId, event);

  try {
    const remainingSubscriptionCount = await unbindUserSubscription(
      logger,
      redisClient,
      connectionId,
      clientId,
      subscription,
      socket
    );

    if (!remainingSubscriptionCount) {
      await removeUserSubscription(logger, redisClient, connectionId, clientId);
    }

    socket.unsubscribe(subscription);

    res(subscription);
  } catch (err: any) {
    logger.error(`Failed to unbind user subscription`, {
      session,
      clientId,
      event,
      subscription
    });

    res(null, formatErrorResponse(err));
  }
}

export async function clientAuthUserUnsubscribeAll(
  logger: Logger,
  redisClient: RedisClient,
  socket: WebSocket<Session>,
  data: any,
  res: SocketAckHandler,
  createdAt: string
): Promise<void> {
  const session = socket.getUserData();

  const { connectionId } = session;
  const { subscriptionId: clientId } = data;

  logger.debug('Deleting all user subscriptions', {
    clientId
  });

  try {
    const subscriptions = await getUserSubscriptions(logger, redisClient, connectionId, clientId);

    await Promise.all(
      subscriptions.map(async (subscription) =>
        unbindUserSubscription(logger, redisClient, connectionId, clientId, subscription, socket)
      )
    );

    await removeUserSubscription(logger, redisClient, connectionId, clientId);

    res(true);
  } catch (err: any) {
    logger.error(`Failed to delete all user subscriptions`, {
      session,
      clientId
    });

    res(null, formatErrorResponse(err));
  }
}
