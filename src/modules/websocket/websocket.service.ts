import { Job } from 'bullmq';
import {
  clearSessionMetrics,
  initializeSession,
  markSessionForDeletion,
  markSessionUserActive,
  markSessionUserInactive,
  recordConnnectionEvent,
  restoreSession,
  setSessionActive
} from '@/modules/session/session.service';
import { getLogger } from '@/util/logger';
import { v4 as uuid } from 'uuid';
import { Session } from '@/types/session.types';
import { ClientEvent, ServerEvent } from '@/types/event.types';
import {
  SocketConnectionEventType,
  SocketDisconnectReason,
  SocketSubscriptionEvent
} from '@/types/socket.types';
import { RedisClient } from '@/lib/redis';
import { DsErrorResponse } from '@/types/request.types';
import { eventEmitter } from '@/lib/event-bus';
import { getQueryParamRealValue } from '@/util/helpers';
import {
  HttpRequest,
  HttpResponse,
  TemplatedApp,
  us_socket_context_t,
  WebSocket
} from 'uWebSockets.js';
import ChannelManager from '@/lib/channel-manager';
import { KeyPrefix, KeySuffix } from '@/types/state.types';
import { eventHandlersMap } from './websocket.handlers';
import * as repository from './websocket.repository';

const logger = getLogger('websocket'); // TODO: MOVE LOGGER TO HANDLERS INSTEAD OF PASSING HERE

const decoder = new TextDecoder('utf-8');

const MESSAGE_MAX_BYTE_LENGTH = 64 * 1024;

export function handleConnectionUpgrade(
  res: HttpResponse,
  req: HttpRequest,
  context: us_socket_context_t
): void {
  const upgradeAborted = {
    aborted: false
  };

  const connectionAuthParams: ConnectionAuth = {
    token: getQueryParamRealValue(req.getQuery('token')),
    apiKey: getQueryParamRealValue(req.getQuery('apiKey')),
    clientId: getQueryParamRealValue(req.getQuery('clientId')),
    connectionId: getQueryParamRealValue(req.getQuery('connectionId'))
  };

  logger.debug(`Handling connection upgrade`, {
    clientId: connectionAuthParams.clientId,
    connectionId: connectionAuthParams.connectionId
  });

  const secWebsocketKey = req.getHeader('sec-websocket-key');
  const secWebsocketProtocol = req.getHeader('sec-websocket-protocol');
  const secWebsocketExtensions = req.getHeader('sec-websocket-extensions');

  initializeSession(connectionAuthParams)
    .then((verifiedSession: Session) => {
      verifiedSession.socketId = uuid();

      if (!upgradeAborted.aborted) {
        res.upgrade(
          verifiedSession,
          secWebsocketKey,
          secWebsocketProtocol,
          secWebsocketExtensions,
          context
        );
      }
    })
    .catch((err) => {
      logger.error('Error during WebSocket session initialization:', err);

      if (!upgradeAborted.aborted) {
        res.writeStatus('500 Internal Server Error').end();
      }
    });

  res.onAborted(() => {
    upgradeAborted.aborted = true;
    logger.warn('WebSocket upgrade was aborted');
  });
}

export async function handleSocketOpen(
  socket: WebSocket<Session>,
  redisClient: RedisClient
): Promise<void> {
  try {
    const verifiedSession = socket.getUserData();
    const { uid, connectionId, clientId } = verifiedSession;

    logger.debug(`Socket connect event, ${connectionId}`, verifiedSession);

    await setSessionActive(verifiedSession, socket);
    await markSessionUserActive(uid);
    await restoreSession(redisClient, verifiedSession, socket);
    await recordConnnectionEvent(verifiedSession, socket, SocketConnectionEventType.CONNECT);

    logger.info(
      `Session initialization complete, emitting CONNECTION_ACKNOWLEDGED (${connectionId})`,
      verifiedSession
    );

    emit(socket, ServerEvent.CONNECTION_ACKNOWLEDGED, {
      uid,
      clientId,
      connectionId
    });
  } catch (err: any) {
    logger.error(`Failed to establish socket connection`, { err });
  }
}

export function emit(socket: WebSocket<Session>, type: ServerEvent, body: any): void {
  const data = JSON.stringify({
    type,
    body
  });

  socket.send(data);
}

export async function handleSocketMessage(
  socket: WebSocket<Session>,
  redisClient: RedisClient,
  message: ArrayBuffer,
  isBinary: boolean,
  app: TemplatedApp
): Promise<void> {
  try {
    const { type, body, ackId, createdAt } = JSON.parse(decoder.decode(message));

    if (message.byteLength > MESSAGE_MAX_BYTE_LENGTH) {
      handleByteLengthError(socket, ackId);
    }

    const handler = eventHandlersMap[type as ClientEvent];

    if (!handler) {
      logger.error(`Event ${type} not recognized`, { type, ackId });
      return;
    }

    const res = ackHandler(socket, ackId);

    return handler(logger, redisClient, socket, body, res, createdAt);
  } catch (err: any) {
    logger.error(`Failed to handle socket message`, { err });
  }
}

export function ackHandler(socket: WebSocket<Session>, ackId: string) {
  return function (data: any, err?: DsErrorResponse) {
    try {
      emit(socket, ServerEvent.MESSAGE_ACKNOWLEDGED, { ackId, data, err });
    } catch (err: any) {
      logger.error(`Failed to send message acknowledgment`, { err });
    }
  };
}

export function handleByteLengthError(socket: WebSocket<Session>, ackId: string) {
  const res = ackHandler(socket, ackId);

  const message = `Message size exceeds maximum allowed size (${MESSAGE_MAX_BYTE_LENGTH})`;

  if (res) {
    res(null, { message });
  }

  throw new Error(message);
}

export async function handleDisconnect(
  socket: WebSocket<Session>,
  redisClient: RedisClient,
  code: number,
  message: ArrayBuffer,
  serverInstanceId: string
): Promise<Job | void> {
  const session = socket.getUserData();
  // const decodedMessage = decoder.decode(message);

  if (!session.uid) {
    return;
  }

  try {
    logger.info(`Socket disconnection event: ${code}`, { session });

    await clearSessionMetrics(redisClient, session);
    await markSessionForDeletion(session, serverInstanceId);
    await markSessionUserInactive(session, serverInstanceId);
    await recordConnnectionEvent(session, socket, SocketConnectionEventType.DISCONNECT);
  } catch (err: any) {
    logger.error(`Failed to perform session clean up`, err);
  }
}

export async function handleSubscriptionBindings(
  socket: WebSocket<Session>,
  topic: ArrayBuffer,
  newCount: number,
  oldCount: number
): Promise<void> {
  const decodedTopic = decoder.decode(topic);

  const [routingKeyPrefix, appPid, hashedNamespace] = decodedTopic.split(':');

  // Only emit create event for top level room subscriptions
  // Binding keys not created for lower levels
  if (routingKeyPrefix !== ChannelManager.AMQP_ROUTING_KEY_PREFIX) {
    return;
  }

  logger.info(`Emitting subscription create for "${appPid}:${hashedNamespace}"`, {
    oldCount,
    newCount,
    decodedTopic
  });

  // Emitter event is handled in amqp-manager.ts
  // Responsible or creating the RMQ bindings for the subscription
  if (oldCount === 0 && newCount > 0) {
    eventEmitter.emit(SocketSubscriptionEvent.SUBSCRIPTION_CREATE, decodedTopic);
  }

  if (oldCount > 0 && newCount === 0) {
    eventEmitter.emit(SocketSubscriptionEvent.SUBSCRIPTION_DELETE, decodedTopic);
  }
}

export async function handleClientHeartbeat(socket: WebSocket<Session>): Promise<void> {
  const session = socket.getUserData();

  logger.debug(`Client heartbeat recieved via "pong" response, ${session.connectionId}`, {
    session
  });

  try {
    await setSessionActive(session, socket);
  } catch (err: any) {
    logger.error(`Failed to set session heartbeat`, { session });
  }
}

export async function rateLimitGuard(
  redisClient: RedisClient,
  connectionId: string,
  evaluationPeriodMs: number,
  entryLimit: number
): Promise<number> {
  const key = `${KeyPrefix.RATE}:messages:${connectionId}:${KeySuffix.COUNT}`;

  return repository.evaluateRateLimit(redisClient, key, `${evaluationPeriodMs}`, `${entryLimit}`);
}
