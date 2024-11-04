import { WebSocket } from 'uWebSockets.js';
import { KeyNamespace, KeyPrefix } from '@/types/state.types';
import {
  createSubscription,
  deleteSubscription,
  getAllSubscriptions
} from './subscription.repository';
import { RedisClient } from '@/lib/redis';
import { Session } from '@/types/session.types';
import { Logger } from 'winston';

function getSubscriptionKeyName(
  connectionId: string,
  keyNamespace: string,
  nspRoomId: string
): string {
  return `${KeyPrefix.CONNECTION}:${connectionId}:${keyNamespace}:${nspRoomId}`;
}

export async function bindSubscription(
  logger: Logger,
  redisClient: RedisClient,
  connectionId: string,
  nspRoomId: string,
  subscription: string,
  keyNamespace: KeyNamespace,
  socket: WebSocket<Session>
): Promise<void> {
  const key = getSubscriptionKeyName(connectionId, keyNamespace, nspRoomId);

  logger.debug(`Binding subscription ${subscription}`, { connectionId, keyNamespace, nspRoomId });

  try {
    await createSubscription(redisClient, key, subscription);
    socket.subscribe(subscription);
  } catch (err: any) {
    logger.error(`Failed to bind subscription`, { key, err });
    throw err;
  }
}

export async function unbindSubscription(
  logger: Logger,
  redisClient: RedisClient,
  connectionId: string,
  nspRoomId: string,
  subscription: string,
  keyNamespace: KeyNamespace,
  socket?: WebSocket<Session>
): Promise<void> {
  const key = getSubscriptionKeyName(connectionId, keyNamespace, nspRoomId);

  logger.debug(`Unbinding subscription ${subscription}`, { connectionId, keyNamespace, nspRoomId });

  try {
    await deleteSubscription(redisClient, key, subscription);

    if (socket) {
      socket.unsubscribe(subscription);
    }
  } catch (err: any) {
    logger.error(`Failed to unbind subscription`, { key, err });
    throw err;
  }
}

export async function unbindAllSubscriptions(
  logger: Logger,
  redisClient: RedisClient,
  connectionId: string,
  nspRoomId: string,
  keyNamespace: KeyNamespace,
  socket?: WebSocket<Session>
): Promise<void> {
  const key = getSubscriptionKeyName(connectionId, keyNamespace, nspRoomId);

  logger.debug(`Unbinding all subscriptions`, { connectionId, keyNamespace, nspRoomId });

  try {
    const subscriptions = await getAllSubscriptions(redisClient, key);

    if (socket) {
      subscriptions.forEach((subscription) => socket.unsubscribe(subscription));
    }

    if (subscriptions) {
      await Promise.all(
        subscriptions.map(async (subscription) =>
          unbindSubscription(
            logger,
            redisClient,
            connectionId,
            nspRoomId,
            subscription,
            keyNamespace
          )
        )
      );
    }
  } catch (err: any) {
    logger.error(`Failed to unbind all subscriptions`, { key, err });
    throw err;
  }
}

export async function restoreRoomSubscriptions(
  logger: Logger,
  redisClient: RedisClient,
  connectionId: string,
  nspRoomId: string,
  keyNamespace: KeyNamespace,
  socket: WebSocket<Session>
): Promise<void> {
  logger.debug(`Restoring subscriptions for ${connectionId}`, { keyNamespace, nspRoomId });

  const key = getSubscriptionKeyName(connectionId, keyNamespace, nspRoomId);

  try {
    const subscriptions = await getAllSubscriptions(redisClient, key);
    subscriptions.forEach((subscription) => socket.subscribe(subscription));
  } catch (err: any) {
    logger.error(`Failed to restore subscriptions for ${connectionId}`, { key, err });
    throw err;
  }
}
