import uWS from 'uWebSockets.js';
import { Logger } from 'winston';
import { RedisClient } from '../../lib/redis';
import { DsPermission } from '../../types/permissions.types';
import { Session } from '../../types/session.types';
import { SocketAckHandler } from '../../types/socket.types';
import { formatErrorResponse, formatPresenceSubscription } from '../../util/format';
import { getNspRoomId } from '../../util/helpers';
import {
  activeMemberGuard,
  authenticatedSessionGuard,
  permissionsGuard,
  roomMemberGuard
} from '../guards/guards.service';
import {
  bindSubscription,
  unbindAllSubscriptions,
  unbindSubscription
} from '../subscription/subscription.service';
import { KeyNamespace } from '../../types/state.types';
import { SubscriptionType } from '../../types/subscription.types';
import {
  addActiveMember,
  getActiveMemberCount,
  getActiveMembers,
  removeActiveMember,
  updateActiveMember
} from './presence.service';
import { getLatencyLog, publishMetric, unpublishMetric } from '../metrics/metrics.service';
import { MetricType } from '../../types/metric.types';
import { setSessionActive } from '../session/session.service';

export async function clientPresenceSubscribe(
  logger: Logger,
  redisClient: RedisClient,
  socket: uWS.WebSocket<Session>,
  data: any,
  res: SocketAckHandler,
  createdAt: string
): Promise<void> {
  const session = socket.getUserData();
  const { roomId, event } = data;
  const { appPid, permissions, connectionId } = session;

  const nspRoomId = getNspRoomId(appPid, roomId);
  const subscription = formatPresenceSubscription(nspRoomId, event);

  logger.info('Subscribing to presence', {
    session,
    nspRoomId,
    event,
    subscription
  });

  try {
    permissionsGuard(roomId, DsPermission.PRESENCE, permissions);
    await roomMemberGuard(redisClient, connectionId, nspRoomId);
    await bindSubscription(
      redisClient,
      connectionId,
      nspRoomId,
      subscription,
      KeyNamespace.PRESENCE,
      socket
    );

    res(subscription);
  } catch (err: any) {
    logger.error(`Failed to subscribe to presence`, {
      session,
      nspRoomId,
      event,
      subscription
    });

    res(null, formatErrorResponse(err));
  }
}

export async function clientPresenceUnsubscribe(
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
  const subscription = formatPresenceSubscription(nspRoomId, event);

  logger.info('Unsubscribing from presence', {
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
      KeyNamespace.PRESENCE,
      socket
    );
    res(subscription);
  } catch (err: any) {
    logger.error(`Failed to unsubscribe from presence`, {
      session,
      nspRoomId,
      event,
      subscription
    });

    res(null, formatErrorResponse(err));
  }
}

export async function clientPresenceUnsubscribeAll(
  logger: Logger,
  redisClient: RedisClient,
  socket: uWS.WebSocket<Session>,
  data: any,
  res: SocketAckHandler,
  createdAt: string
): Promise<void> {
  const session = socket.getUserData();
  const { roomId } = data;
  const { uid, appPid, connectionId } = session;

  logger.info('Unsubscribing from presence (all subscriptions)', { session, roomId });

  const nspRoomId = getNspRoomId(appPid, roomId);

  try {
    await unbindAllSubscriptions(
      redisClient,
      connectionId,
      nspRoomId,
      KeyNamespace.PRESENCE,
      socket
    );

    res(true);
  } catch (err: any) {
    logger.error(`Failed to unsubscribe from presence (all subscriptions)`, { err, roomId });
    res(null, formatErrorResponse(err));
  }
}

export async function clientPresenceJoin(
  logger: Logger,
  redisClient: RedisClient,
  socket: uWS.WebSocket<Session>,
  data: any,
  res: SocketAckHandler,
  createdAt: string
): Promise<void> {
  const session = socket.getUserData();
  const { roomId, userData } = data;
  const { appPid, clientId, connectionId } = session;

  const nspRoomId = getNspRoomId(appPid, roomId);
  const subscription = formatPresenceSubscription(nspRoomId, SubscriptionType.JOIN);
  const timestamp = new Date().toISOString();
  const latencyLog = getLatencyLog(createdAt);

  const message = {
    id: clientId,
    data: userData,
    timestamp,
    event: SubscriptionType.JOIN
  };

  try {
    authenticatedSessionGuard(session);
    await roomMemberGuard(redisClient, connectionId, nspRoomId);

    await Promise.all([
      addActiveMember(clientId, nspRoomId, subscription, session, message, latencyLog),
      publishMetric(clientId, nspRoomId, MetricType.PRESENCE_MEMBER, session)
      // setSessionActive(session, socket)
    ]);

    logger.info('Client joined presence', { session, subscription });

    res(subscription);
  } catch (err: any) {
    logger.error(`Failed to join presence`, { session, nspRoomId, subscription });
    res(null, formatErrorResponse(err));
  }
}

export async function clientPresenceLeave(
  logger: Logger,
  redisClient: RedisClient,
  socket: uWS.WebSocket<Session>,
  data: any,
  res: SocketAckHandler,
  createdAt: string
): Promise<void> {
  const session = socket.getUserData();
  const { roomId, userData } = data;
  const { appPid, clientId } = session;

  const nspRoomId = getNspRoomId(appPid, roomId);
  const subscription = formatPresenceSubscription(nspRoomId, SubscriptionType.LEAVE);
  const latencyLog = getLatencyLog(createdAt);

  const message = {
    id: clientId,
    data: userData,
    event: SubscriptionType.LEAVE
  };

  try {
    authenticatedSessionGuard(session);

    await Promise.all([
      removeActiveMember(clientId, nspRoomId, subscription, session, message, latencyLog),
      unpublishMetric(clientId, nspRoomId, MetricType.PRESENCE_MEMBER, session)
    ]);

    logger.info('Client left presence', { session, subscription });

    res(subscription);
  } catch (err: any) {
    logger.error(`Failed to leave presence`, { session, nspRoomId, subscription });
    res(null, formatErrorResponse(err));
  }
}

export async function clientPresenceUpdate(
  logger: Logger,
  redisClient: RedisClient,
  socket: uWS.WebSocket<Session>,
  data: any,
  res: SocketAckHandler,
  createdAt: string
): Promise<void> {
  const session = socket.getUserData();
  const { roomId, userData } = data;
  const { appPid, clientId, connectionId, uid } = session;

  const nspRoomId = getNspRoomId(appPid, roomId);
  const subscription = formatPresenceSubscription(nspRoomId, SubscriptionType.UPDATE);
  const timestamp = new Date().toISOString();
  const latencyLog = getLatencyLog(createdAt);

  const message = {
    id: clientId,
    data: userData,
    timestamp,
    event: SubscriptionType.UPDATE
  };

  try {
    authenticatedSessionGuard(session);

    await roomMemberGuard(redisClient, connectionId, nspRoomId);
    await activeMemberGuard(redisClient, uid, nspRoomId);

    updateActiveMember(clientId, nspRoomId, subscription, session, message, latencyLog);

    logger.info('Client updated presence', {
      session,
      subscription
    });

    res(subscription);
  } catch (err: any) {
    logger.error(`Failed to update presence`, {
      session,
      nspRoomId,
      subscription,
      err
    });

    res(null, formatErrorResponse(err));
  }
}

export async function clientPresenceGet(
  logger: Logger,
  redisClient: RedisClient,
  socket: uWS.WebSocket<Session>,
  data: any,
  res: SocketAckHandler,
  createdAt: string
): Promise<void> {
  const session = socket.getUserData();
  const { roomId } = data;
  const { appPid, permissions } = session;

  const nspRoomId = getNspRoomId(appPid, roomId);

  try {
    permissionsGuard(roomId, DsPermission.PRESENCE, permissions);

    const members = await getActiveMembers(redisClient, nspRoomId);

    res(members || []);
  } catch (err: any) {
    res(null, formatErrorResponse(err));
  }
}

export async function clientPresenceCount(
  logger: Logger,
  redisClient: RedisClient,
  socket: uWS.WebSocket<Session>,
  data: any,
  res: SocketAckHandler,
  createdAt: string
): Promise<void> {
  const session = socket.getUserData();
  const { roomId } = data;
  const { appPid, permissions } = session;

  const nspRoomId = getNspRoomId(appPid, roomId);

  try {
    permissionsGuard(roomId, DsPermission.PRESENCE, permissions);

    const count = await getActiveMemberCount(redisClient, nspRoomId);

    res(count);
  } catch (err: any) {
    res(null, formatErrorResponse(err));
  }
}
