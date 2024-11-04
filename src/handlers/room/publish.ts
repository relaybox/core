import { v4 as uuid } from 'uuid';
import { RedisClient } from '@/lib/redis';
import { Session } from '@/types/session.types';
import { SocketAckHandler } from '@/types/socket.types';
import { getNspEvent, getNspRoomId } from '@/util/helpers';
import { getLogger } from '@/util/logger';
import { WebSocket } from 'uWebSockets.js';
import { getLatencyLog } from '@/modules/metrics/metrics.service';
import { enqueueWebhookEvent } from '@/modules/webhook/webhook.service';
import { WebhookEvent } from '@/types/webhook.types';
import { formatErrorResponse } from '@/util/format';
import { ClientEvent } from '@/types/event.types';
import { permissionsGuard } from '@/modules/guards/guards.service';
import { DsPermission } from '@/types/permissions.types';
import { getReducedSession } from '@/modules/session/session.service';
import { addMessageToCache, enqueueMessageForPersistence } from '@/modules/history/history.service';
import { Services } from '@/lib/services';

const logger = getLogger(ClientEvent.PUBLISH);

export function handler({ redisClient, publisher, amqpManager }: Services) {
  return async function (
    socket: WebSocket<Session>,
    data: any,
    res: SocketAckHandler,
    createdAt?: string
  ): Promise<void> {
    const session = socket.getUserData();

    logger.debug(`Client publish event`, { session });

    const { appPid, permissions } = session;
    const { roomId, event, data: messageData } = data;

    const nspRoomId = getNspRoomId(appPid, roomId);
    const nspEvent = getNspEvent(nspRoomId, event);
    const latencyLog = getLatencyLog(createdAt!);

    try {
      permissionsGuard(roomId, DsPermission.PUBLISH, permissions);

      const reducedSession = getReducedSession(session);

      const sender = {
        clientId: reducedSession.clientId || null,
        connectionId: reducedSession.connectionId,
        user: reducedSession.user
      };

      const messageId = uuid();

      const extendedMessageData = {
        id: messageId,
        body: messageData,
        sender,
        timestamp: new Date().getTime(),
        event
      };

      const webhookData = {
        ...messageData,
        id: messageId,
        roomId,
        event
      };

      const webhookFilterAttributes = {
        roomId,
        ...messageData
      };

      const processedMessageData = amqpManager.dispatchHandler
        .to(nspRoomId)
        .dispatch(nspEvent, extendedMessageData, reducedSession, latencyLog);

      const persistedMessageData = {
        roomId,
        event,
        message: processedMessageData
      };

      await addMessageToCache(logger, redisClient, persistedMessageData);
      await enqueueMessageForPersistence(logger, publisher, persistedMessageData);

      // TODO: pass logger to enqueueWebhookEvent
      await enqueueWebhookEvent(
        WebhookEvent.ROOM_PUBLISH,
        webhookData,
        session,
        webhookFilterAttributes
      );

      res(extendedMessageData);
    } catch (err: any) {
      res(null, formatErrorResponse(err));
    }
  };
}
