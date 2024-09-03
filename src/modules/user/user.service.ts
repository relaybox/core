import { RedisClient } from 'src/lib/redis';
import { KeyNamespace, KeyPrefix, KeySuffix } from '../../types/state.types';
import { Logger } from 'winston';
import * as repository from './user.repository';
import { WebSocket } from 'uWebSockets.js';
import { Session } from 'src/types/session.types';

function getUserSubscriptionKeyName(connectionId: string, clientId?: string): string {
  return `${KeyPrefix.CONNECTION}:${connectionId}:${KeyNamespace.USERS}${
    clientId ? `:${clientId}` : ''
  }`;
}

/**
 * Pushes client id to connection:{connectionId}:users hset
 * Use to track and iterate all clientId's this connection has subscriptions to
 * The field will Contain the clientId, not the subscription name
 * @param logger
 * @param redisClient
 * @param connectionId
 * @param clientId
 */
export async function pushUserSubscription(
  logger: Logger,
  redisClient: RedisClient,
  connectionId: string,
  clientId: string
): Promise<void> {
  logger.debug(`Pushing user subscription`, { connectionId, clientId });

  try {
    const key = getUserSubscriptionKeyName(connectionId);
    await repository.pushUserSubscription(redisClient, key, clientId);
  } catch (err: any) {
    logger.error(`Failed to push user subscription`, { err });
    throw err;
  }
}

/**
 * Adds subscription to connection:{connectionId}:users:${clientId} hset
 * The hash contains all the subsciptions this connection is subscribed to for a given clientId
 * @param logger
 * @param redisClient
 * @param connectionId
 * @param subscription
 * @param socket
 */
export async function bindUserSubscription(
  logger: Logger,
  redisClient: RedisClient,
  connectionId: string,
  clientId: string,
  subscription: string,
  socket: WebSocket<Session>
): Promise<void> {
  logger.debug(`Binding user subscription`, { connectionId, subscription });

  try {
    const key = getUserSubscriptionKeyName(connectionId, clientId);
    await repository.bindUserSubscription(redisClient, key, subscription);
    socket.subscribe(subscription);
  } catch (err: any) {
    logger.error(`Failed to push user subscription`, { err });
    throw err;
  }
}

export async function removeUserSubscription(
  logger: Logger,
  redisClient: RedisClient,
  connectionId: string,
  clientId: string
): Promise<void> {
  logger.debug(`Removing user subscription`, { connectionId, clientId });

  try {
    const key = getUserSubscriptionKeyName(connectionId);
    await repository.removeUserSubscription(redisClient, key, clientId);
  } catch (err: any) {
    logger.error(`Failed to remove user subscription`, { err });
    throw err;
  }
}

export async function unbindUserSubscription(
  logger: Logger,
  redisClient: RedisClient,
  connectionId: string,
  clientId: string,
  subscription: string,
  socket: WebSocket<Session>
): Promise<number> {
  logger.debug(`Unbinding user subscription ${subscription}`, { connectionId, subscription });

  try {
    const key = getUserSubscriptionKeyName(connectionId, clientId);
    await repository.unbindUserSubscription(redisClient, key, subscription);
    socket.unsubscribe(subscription);
    return repository.getUserSubscriptionCount(redisClient, key);
  } catch (err: any) {
    logger.error(`Failed to push user subscription`, { err });
    throw err;
  }
}

export async function getUserSubscriptions(
  logger: Logger,
  redisClient: RedisClient,
  connectionId: string,
  clientId: string
): Promise<string[]> {
  logger.debug(`Getting user subscriptions`, { connectionId, clientId });

  try {
    const key = getUserSubscriptionKeyName(connectionId, clientId);
    const subscriptions = await repository.getUserSubscriptions(redisClient, key);
    return Object.keys(subscriptions);
  } catch (err: any) {
    logger.error(`Failed to get user subscriptions`, { err });
    throw err;
  }
}
