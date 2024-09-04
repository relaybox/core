import { RedisClient } from 'src/lib/redis';
import { KeyNamespace, KeyPrefix } from '../../types/state.types';
import { Logger } from 'winston';
import * as repository from './user.repository';
import { WebSocket } from 'uWebSockets.js';
import { Session } from '../../types/session.types';
import ChannelManager from '../../lib/channel-manager';
import { getNspClientId } from '../../util/helpers';

function getUserSubscriptionKeyName(connectionId: string, nspClientId?: string): string {
  return `${KeyPrefix.CONNECTION}:${connectionId}:${nspClientId}`;
}

function getUserHashKeyName(connectionId: string): string {
  return `${KeyPrefix.CONNECTION}:${connectionId}:${KeyNamespace.USERS}`;
}

/**
 * Pushes client id to connection:{connectionId}:users hset
 * Use to track and iterate all nspClientId's this connection has subscriptions to
 * The field will Contain the nspClientId, not the subscription name
 * @param logger
 * @param redisClient
 * @param connectionId
 * @param nspClientId
 */
export async function pushUserSubscription(
  logger: Logger,
  redisClient: RedisClient,
  connectionId: string,
  clientId: string,
  userRoutingKey: string,
  socket: WebSocket<Session>
): Promise<void> {
  logger.debug(`Pushing user subscription`, { connectionId, clientId });

  try {
    const key = getUserHashKeyName(connectionId);
    await repository.pushUserSubscription(redisClient, key, clientId);
    socket.subscribe(userRoutingKey);
  } catch (err: any) {
    logger.error(`Failed to push user subscription`, { err });
    throw err;
  }
}

/**
 * Adds subscription to connection:{connectionId}:users:${nspClientId} hset
 * The hash contains all the subsciptions this connection is subscribed to for a given nspClientId
 * Responsible for binding the subscription to the socket
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
  nspClientId: string,
  subscription: string,
  socket: WebSocket<Session>
): Promise<number> {
  logger.debug(`Binding user subscription`, { connectionId, subscription });

  try {
    const key = getUserSubscriptionKeyName(connectionId, nspClientId);
    await repository.bindUserSubscription(redisClient, key, subscription);
    socket.subscribe(subscription);
    return repository.getUserSubscriptionCount(redisClient, key);
  } catch (err: any) {
    logger.error(`Failed to push user subscription`, { err });
    throw err;
  }
}

export async function removeUserSubscription(
  logger: Logger,
  redisClient: RedisClient,
  connectionId: string,
  clientId: string,
  userRoutingKey: string,
  socket: WebSocket<Session>
): Promise<void> {
  logger.debug(`Removing user subscription`, { connectionId, clientId });

  try {
    const key = getUserHashKeyName(connectionId);
    await repository.removeUserSubscription(redisClient, key, clientId);
    socket.unsubscribe(userRoutingKey);
  } catch (err: any) {
    logger.error(`Failed to remove user subscription`, { err });
    throw err;
  }
}

export async function unbindUserSubscription(
  logger: Logger,
  redisClient: RedisClient,
  connectionId: string,
  nspClientId: string,
  subscription: string,
  socket: WebSocket<Session>
): Promise<number> {
  logger.debug(`Unbinding user subscription ${subscription}`, { connectionId, subscription });

  try {
    const key = getUserSubscriptionKeyName(connectionId, nspClientId);
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
  nspClientId: string
): Promise<string[]> {
  logger.debug(`Getting user subscriptions`, { connectionId, nspClientId });

  try {
    const key = getUserSubscriptionKeyName(connectionId, nspClientId);
    const subscriptions = await repository.getUserSubscriptions(redisClient, key);
    return Object.keys(subscriptions);
  } catch (err: any) {
    logger.error(`Failed to get user subscriptions`, { err });
    throw err;
  }
}

export async function getCachedUsers(
  redisClient: RedisClient,
  connectionId: string
): Promise<string[]> {
  try {
    const key = getUserHashKeyName(connectionId);
    const users = await repository.getCachedUsers(redisClient, key);
    return Object.keys(users);
  } catch (err: any) {
    throw err;
  }
}

export async function restoreCachedUsers(
  logger: Logger,
  redisClient: RedisClient,
  session: Session,
  socket: WebSocket<Session>
): Promise<void> {
  const { uid, connectionId } = session;

  const users = await getCachedUsers(redisClient, connectionId);

  logger.debug(`Restoring session, users (${users?.length})`, { uid, users });

  if (users && users.length > 0) {
    await Promise.all(
      users.map(async (clientId) =>
        restoreUserSubscriptions(logger, redisClient, connectionId, clientId, socket)
      )
    );
  }
}

export async function restoreUserSubscriptions(
  logger: Logger,
  redisClient: RedisClient,
  connectionId: string,
  clientId: string,
  socket: WebSocket<Session>
): Promise<(number | void)[]> {
  logger.debug(`Restoring user subscriptions for ${connectionId}`, { connectionId });

  try {
    const nspClientId = getNspClientId(KeyNamespace.USERS, clientId);
    const userRoutingKey = ChannelManager.getRoutingKey(nspClientId);

    const subscriptions = await getUserSubscriptions(
      logger,
      redisClient,
      connectionId,
      nspClientId
    );

    const subscriptionBindingPromises = subscriptions.map(async (subscription) =>
      bindUserSubscription(logger, redisClient, connectionId, nspClientId, subscription, socket)
    );

    return Promise.all([
      pushUserSubscription(logger, redisClient, connectionId, clientId, userRoutingKey, socket),
      ...subscriptionBindingPromises
    ]);
  } catch (err) {
    logger.error(`Failed to restore user subscriptions for ${connectionId}`, { err });
    throw err;
  }
}
