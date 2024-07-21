import { WebSocket } from 'uWebSockets.js';
import { KeyNamespace, KeyPrefix } from '../../types/state.types';
import { getLogger } from '../../util/logger';
import {
  createSubscription,
  deleteSubscription,
  getAllSubscriptions
} from './subscription.repository';
import { RedisClient } from 'src/lib/redis';
import { Session } from 'src/types/session.types';

const logger = getLogger('subscription');

function getSubscriptionKeyName(
  connectionId: string,
  keyNamespace: string,
  nspRoomId: string
): string {
  return `${KeyPrefix.CONNECTION}:${connectionId}:${keyNamespace}:${nspRoomId}`;
}

export async function bindSubscription(
  redisClient: RedisClient,
  connectionId: string,
  nspRoomId: string,
  subscription: string,
  keyNamespace: KeyNamespace,
  socket: WebSocket<Session>
): Promise<void> {
  const key = getSubscriptionKeyName(connectionId, keyNamespace, nspRoomId);

  logger.info(`Binding subscription ${subscription}`, { connectionId, keyNamespace, nspRoomId });

  try {
    await createSubscription(redisClient, key, subscription);
    socket.subscribe(subscription);
  } catch (err: any) {
    logger.error(`Failed to bind subscription`, { key, err });
    throw err;
  }
}

export async function unbindSubscription(
  redisClient: RedisClient,
  connectionId: string,
  nspRoomId: string,
  subscription: string,
  keyNamespace: KeyNamespace,
  socket?: WebSocket<Session>
): Promise<void> {
  const key = getSubscriptionKeyName(connectionId, keyNamespace, nspRoomId);

  logger.info(`Unbinding subscription ${subscription}`, { connectionId, keyNamespace, nspRoomId });

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
  redisClient: RedisClient,
  connectionId: string,
  nspRoomId: string,
  keyNamespace: KeyNamespace,
  socket?: WebSocket<Session>
): Promise<void> {
  const key = getSubscriptionKeyName(connectionId, keyNamespace, nspRoomId);

  logger.info(`Unbinding all subscriptions`, { connectionId, keyNamespace, nspRoomId });

  try {
    const subscriptions = await getAllSubscriptions(redisClient, key);

    if (socket) {
      subscriptions.forEach((subscription) => socket.unsubscribe(subscription));
    }

    if (subscriptions) {
      await Promise.all(
        subscriptions.map(async (subscription) =>
          unbindSubscription(redisClient, connectionId, nspRoomId, subscription, keyNamespace)
        )
      );
    }
  } catch (err: any) {
    logger.error(`Failed to unbind all subscriptions`, { key, err });
    throw err;
  }
}

export async function restoreRoomSubscriptions(
  redisClient: RedisClient,
  connectionId: string,
  nspRoomId: string,
  keyNamespace: KeyNamespace,
  socket: WebSocket<Session>
): Promise<void> {
  logger.info(`Restoring subscriptions for ${connectionId}`, { keyNamespace, nspRoomId });

  const key = getSubscriptionKeyName(connectionId, keyNamespace, nspRoomId);

  try {
    const subscriptions = await getAllSubscriptions(redisClient, key);

    subscriptions.forEach((subscription) => socket.subscribe(subscription));
  } catch (err: any) {
    logger.error(`Failed to restore subscriptions for ${connectionId}`, { key, err });
    throw err;
  }
}
