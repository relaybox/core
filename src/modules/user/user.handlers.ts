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
import ChannelManager from '../../lib/channel-manager';
import { getNspClientId } from '../../util/helpers';

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

  const nspClientId = getNspClientId(session.appPid, clientId);
  const subscription = formatUserSubscription(nspClientId, event);
  const userRoutingKey = ChannelManager.getRoutingKey(nspClientId);

  try {
    const subscriptionCount = await bindUserSubscription(
      logger,
      redisClient,
      connectionId,
      nspClientId,
      subscription,
      socket
    );

    if (subscriptionCount === 1) {
      await pushUserSubscription(
        logger,
        redisClient,
        connectionId,
        nspClientId,
        userRoutingKey,
        socket
      );
    }

    res(subscription);
  } catch (err: any) {
    logger.error(`Failed to bind user subscription`, {
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

  const nspClientId = getNspClientId(session.appPid, clientId);
  const subscription = formatUserSubscription(nspClientId, event);
  const userRoutingKey = ChannelManager.getRoutingKey(nspClientId);

  try {
    const subscriptionCount = await unbindUserSubscription(
      logger,
      redisClient,
      connectionId,
      nspClientId,
      subscription,
      socket
    );

    if (!subscriptionCount) {
      await removeUserSubscription(
        logger,
        redisClient,
        connectionId,
        nspClientId,
        userRoutingKey,
        socket
      );
    }

    res(subscription);
  } catch (err: any) {
    logger.error(`Failed to unbind user subscription`, {
      session,
      nspClientId,
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

  const nspClientId = getNspClientId(session.appPid, clientId);
  const subscriptions = await getUserSubscriptions(logger, redisClient, connectionId, nspClientId);
  const userRoutingKey = ChannelManager.getRoutingKey(nspClientId);

  try {
    await Promise.all(
      subscriptions.map(async (subscription) =>
        unbindUserSubscription(logger, redisClient, connectionId, nspClientId, subscription, socket)
      )
    );

    await removeUserSubscription(
      logger,
      redisClient,
      connectionId,
      nspClientId,
      userRoutingKey,
      socket
    );

    res(true);
  } catch (err: any) {
    logger.error(`Failed to delete all user subscriptions`, {
      session,
      nspClientId
    });

    res(null, formatErrorResponse(err));
  }
}
