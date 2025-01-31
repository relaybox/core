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
import { ServerEvent } from '@/types/event.types';
import {
  SocketConnectionEventType,
  SocketDisconnectReason,
  SocketSubscriptionEvent
} from '@/types/socket.types';
import { RedisClient } from '@/lib/redis';
import { DsErrorResponse } from '@/types/request.types';
import { eventEmitter } from '@/lib/event-bus';
import { getQueryParamRealValue } from '@/util/helpers';
import { HttpRequest, HttpResponse, us_socket_context_t, WebSocket } from 'uWebSockets.js';
import ChannelManager from '@/lib/amqp-manager/channel-manager';
import { ConnectionAuth } from '@/types/auth.types';

const logger = getLogger('websocket');

const decoder = new TextDecoder('utf-8');

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

  initializeSession(logger, connectionAuthParams)
    .then((verifiedSession: Session) => {
      /**
       * Extend session with custom socketId and subscriptions map
       */
      verifiedSession.socketId = uuid();
      verifiedSession.subscriptions = new Map();

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
        res.cork(() => res.writeStatus('500 Internal Server Error').end());
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

    await setSessionActive(logger, verifiedSession, socket);
    await markSessionUserActive(logger, connectionId);
    await restoreSession(logger, redisClient, verifiedSession, socket);
    await recordConnnectionEvent(
      logger,
      verifiedSession,
      socket,
      SocketConnectionEventType.CONNECT
    );

    logger.info(`Session initialization complete (${connectionId})`, { verifiedSession });

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

export function ackHandler(socket: WebSocket<Session>, ackId: string) {
  return function (data: any, err?: DsErrorResponse) {
    try {
      emit(socket, ServerEvent.MESSAGE_ACKNOWLEDGED, { ackId, data, err });
    } catch (err: any) {
      logger.error(`Failed to send message acknowledgment`, { err });
    }
  };
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

    await clearSessionMetrics(logger, redisClient, session);
    await markSessionForDeletion(logger, session, serverInstanceId);
    await markSessionUserInactive(logger, session, serverInstanceId);
    await recordConnnectionEvent(logger, session, socket, SocketConnectionEventType.DISCONNECT);
  } catch (err: any) {
    logger.error(`Failed to perform session clean up`, { err });
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

  logger.debug(`Emitting subscription create for "${appPid}:${hashedNamespace}"`, {
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
    await setSessionActive(logger, session, socket);
  } catch (err: any) {
    logger.error(`Failed to set session heartbeat`, { session });
  }
}
