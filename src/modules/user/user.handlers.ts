import { Logger } from 'winston';
import { WebSocket } from 'uWebSockets.js';
import { RedisClient } from '@/lib/redis';
import { Session } from '@/types/session.types';
import { SocketAckHandler } from '@/types/socket.types';
import { formatErrorResponse, formatUserSubscription } from '@/util/format';
import { ClientSubscription } from '@/types/subscription.types';
import {
  bindUserSubscription,
  getUserSubscriptions,
  pushUserSubscription,
  removeUserSubscription,
  unbindUserSubscription
} from './user.service';
import ChannelManager from '@/lib/amqp-manager/channel-manager';
import { getNspClientId } from '@/util/helpers';
import { KeyNamespace } from '@/types/state.types';
import AmqpManager from '@/lib/amqp-manager/amqp-manager';
import { getLatencyLog } from '@/modules/metrics/metrics.service';
import { enqueueWebhookEvent } from '../webhook/webhook.service';
import { WebhookEvent } from '@/types/webhook.types';

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

  const nspClientId = getNspClientId(KeyNamespace.USERS, clientId);
  const subscription = formatUserSubscription(nspClientId, event);
  const userRoutingKey = ChannelManager.getRoutingKey(nspClientId);

  try {
    await bindUserSubscription(
      logger,
      redisClient,
      connectionId,
      nspClientId,
      subscription,
      socket
    );

    await pushUserSubscription(logger, redisClient, connectionId, clientId, userRoutingKey, socket);

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

  const nspClientId = getNspClientId(KeyNamespace.USERS, clientId);
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
        clientId,
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

  const nspClientId = getNspClientId(KeyNamespace.USERS, clientId);
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
      clientId,
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

export async function clientAuthUserStatusUpdate(
  logger: Logger,
  redisClient: RedisClient,
  socket: WebSocket<Session>,
  data: any,
  res: SocketAckHandler,
  createdAt: string
): Promise<void> {
  logger.debug('Updating user status');

  const session = socket.getUserData();

  try {
    if (!session.user) {
      throw new Error('User not found');
    }

    const { status, event } = data;
    const nspClientId = getNspClientId(KeyNamespace.USERS, session.user!.clientId);
    const subscription = formatUserSubscription(nspClientId, event);
    const amqpManager = AmqpManager.getInstance();
    const latencyLog = getLatencyLog(createdAt);

    const messageData = {
      status,
      updatedAt: new Date().toISOString(),
      user: session.user
    };

    const webhookData = {
      status
    };

    amqpManager.dispatchHandler
      .to(nspClientId)
      .dispatch(subscription, messageData, session, latencyLog);

    await enqueueWebhookEvent(WebhookEvent.USER_STATUS_UPDATE, webhookData, session);

    res(messageData);
  } catch (err: any) {
    logger.error(`Failed to update user status`, {
      session
    });

    res(null, formatErrorResponse(err));
  }
}
