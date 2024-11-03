import { Logger } from 'winston';
import { SocketAckHandler } from '@/types/socket.types';
import { Session } from '@/types/session.types';
import { RedisClient } from '@/lib/redis';
import { getNspEvent, getNspRoomId } from '@/util/helpers';
import { joinRoom, leaveRoom } from './room.service';
import { getReducedSession } from '../session/session.service';
import {
  getLatencyLog,
  pushRoomJoinMetrics,
  pushRoomLeaveMetrics
} from '@/modules/metrics/metrics.service';
import { formatErrorResponse, formatPresenceSubscription } from '@/util/format';
import { SubscriptionType } from '@/types/subscription.types';
import { removeActiveMember } from '../presence/presence.service';
import { unbindAllSubscriptions } from '../subscription/subscription.service';
import { KeyNamespace } from '@/types/state.types';
import { permissionsGuard } from '@/modules/guards/guards.service';
import { DsPermission } from '@/types/permissions.types';
import AmqpManager from '@/lib/amqp-manager/amqp-manager';
import { WebSocket } from 'uWebSockets.js';
import ChannelManager from '@/lib/amqp-manager/channel-manager';
import { enqueueWebhookEvent } from '../webhook/webhook.service';
import { WebhookEvent } from '@/types/webhook.types';
import { v4 as uuid } from 'uuid';
import { addMessageToCache, enqueueMessageForPersistence } from '@/modules/history/history.service';
import { getPublisher } from '@/lib/publisher';

// export async function clientRoomJoin(
//   logger: Logger,
//   redisClient: RedisClient,
//   socket: WebSocket<Session>,
//   data: any,
//   res: SocketAckHandler,
//   createdAt: string
// ): Promise<void> {
//   const session = socket.getUserData();

//   const { roomId } = data;

//   logger.debug('Joining room', { session, data });

//   try {
//     const nspRoomId = getNspRoomId(session.appPid, roomId);
//     const nspRoomRoutingKey = ChannelManager.getRoutingKey(nspRoomId);
//     const webhookdata = {
//       roomId
//     };

//     await Promise.all([
//       joinRoom(redisClient, session, nspRoomId, socket),
//       joinRoom(redisClient, session, nspRoomRoutingKey, socket),
//       pushRoomJoinMetrics(redisClient, session, roomId, nspRoomId),
//       enqueueWebhookEvent(WebhookEvent.ROOM_JOIN, webhookdata, session)
//     ]);

//     res(nspRoomId);
//   } catch (err: any) {
//     logger.error(`Failed to join room "${roomId}"`, { err, roomId, session });
//     res(null, formatErrorResponse(err));
//   }
// }

// export async function clientRoomLeave(
//   logger: Logger,
//   redisClient: RedisClient,
//   socket: WebSocket<Session>,
//   data: any,
//   res: SocketAckHandler,
//   createdAt: string
// ): Promise<void> {
//   const session = socket.getUserData();

//   const { roomId } = data;
//   const { uid, connectionId, user, clientId } = session;

//   try {
//     const nspRoomId = getNspRoomId(session.appPid, roomId);
//     const nspRoomRoutingKey = ChannelManager.getRoutingKey(nspRoomId);
//     const presenceSubsciption = formatPresenceSubscription(nspRoomId, SubscriptionType.LEAVE);
//     const timestamp = new Date().toISOString();

//     const presenceLeaveMessage = {
//       clientId,
//       event: SubscriptionType.LEAVE,
//       user,
//       timestamp
//     };

//     const webhookdata = {
//       roomId
//     };

//     await Promise.all([
//       leaveRoom(redisClient, session, nspRoomId, socket),
//       leaveRoom(redisClient, session, nspRoomRoutingKey, socket),
//       removeActiveMember(uid, nspRoomId, presenceSubsciption, session, presenceLeaveMessage),
//       unbindAllSubscriptions(
//         redisClient,
//         connectionId,
//         nspRoomId,
//         KeyNamespace.SUBSCRIPTIONS,
//         socket
//       ),
//       unbindAllSubscriptions(redisClient, connectionId, nspRoomId, KeyNamespace.PRESENCE, socket),
//       unbindAllSubscriptions(redisClient, connectionId, nspRoomId, KeyNamespace.METRICS, socket),
//       pushRoomLeaveMetrics(uid, nspRoomId, session),
//       enqueueWebhookEvent(WebhookEvent.ROOM_LEAVE, webhookdata, session)
//     ]);

//     res(nspRoomId);
//   } catch (err: any) {
//     logger.error(`Failed to leave room "${roomId}"`, { err, roomId, session });

//     res(null, formatErrorResponse(err));
//   }
// }

// export async function clientPublish(
//   logger: Logger,
//   redisClient: RedisClient,
//   socket: WebSocket<Session>,
//   data: any,
//   res: SocketAckHandler,
//   createdAt: string
// ): Promise<void> {
//   const session = socket.getUserData();
//   const publisher = getPublisher();

//   logger.debug(`Client publish event`, { session });

//   const { appPid, permissions } = session;
//   const { roomId, event, data: messageData } = data;

//   const nspRoomId = getNspRoomId(appPid, roomId);
//   const nspEvent = getNspEvent(nspRoomId, event);
//   const latencyLog = getLatencyLog(createdAt);

//   try {
//     permissionsGuard(roomId, DsPermission.PUBLISH, permissions);

//     const reducedSession = getReducedSession(session);

//     const sender = {
//       clientId: reducedSession.clientId || null,
//       connectionId: reducedSession.connectionId,
//       user: reducedSession.user
//     };

//     const messageId = uuid();

//     const extendedMessageData = {
//       id: messageId,
//       body: messageData,
//       sender,
//       timestamp: new Date().getTime(),
//       event
//     };

//     const webhookData = {
//       ...messageData,
//       id: messageId,
//       roomId,
//       event
//     };

//     const webhookFilterAttributes = {
//       roomId,
//       ...messageData
//     };

//     const amqpManager = AmqpManager.getInstance();

//     const processedMessageData = amqpManager.dispatchHandler
//       .to(nspRoomId)
//       .dispatch(nspEvent, extendedMessageData, reducedSession, latencyLog);

//     const persistedMessageData = {
//       roomId,
//       event,
//       message: processedMessageData
//     };

//     await addMessageToCache(logger, redisClient, persistedMessageData);
//     await enqueueMessageForPersistence(logger, publisher, persistedMessageData);

//     // TODO: pass logger to enqueueWebhookEvent
//     await enqueueWebhookEvent(
//       WebhookEvent.ROOM_PUBLISH,
//       webhookData,
//       session,
//       webhookFilterAttributes
//     );

//     res(extendedMessageData);
//   } catch (err: any) {
//     res(null, formatErrorResponse(err));
//   }
// }
