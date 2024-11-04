import { ClientEvent, ServerEvent } from '@/types/event.types';
import { rateLimitMiddleware } from './websocket.middleware';
import {
  clientAuthUserStatusUpdate,
  clientAuthUserSubscribe,
  clientAuthUserUnsubscribe,
  clientAuthUserUnsubscribeAll
} from '@/modules/user/user.handlers';

import {
  clientRoomSubscriptionBind,
  clientRoomSubscriptionUnbind
} from '@/modules/subscription/subscription.handlers';
import {
  clientPresenceCount,
  clientPresenceGet,
  clientPresenceJoin,
  clientPresenceLeave,
  clientPresenceSubscribe,
  clientPresenceUnsubscribe,
  clientPresenceUnsubscribeAll,
  clientPresenceUpdate
} from '@/modules/presence/presence.handlers';
import {
  clientMetricsSubscribe,
  clientMetricsUnsubscribe
} from '@/modules/metrics/metrics.handlers';
import { handler as clientRoomJoin } from '@/handlers/room/join';
import { handler as clientRoomLeave } from '@/handlers/room/leave';
import { handler as clientPublish } from '@/handlers/room/publish';
import { TemplatedApp, WebSocket } from 'uWebSockets.js';
import { Session } from '@/types/session.types';
import { RedisClient } from '@/lib/redis';
import { ackHandler, emit, handleByteLengthError } from './websocket.service';
import { getLogger } from '@/util/logger';

export const eventHandlersMap = {
  [ClientEvent.ROOM_JOIN]: clientRoomJoin,
  [ClientEvent.ROOM_LEAVE]: clientRoomLeave,
  [ClientEvent.PUBLISH]: rateLimitMiddleware(clientPublish),
  [ClientEvent.ROOM_SUBSCRIPTION_BIND]: clientRoomSubscriptionBind,
  [ClientEvent.ROOM_SUBSCRIPTION_UNBIND]: clientRoomSubscriptionUnbind,
  [ClientEvent.ROOM_PRESENCE_SUBSCRIBE]: clientPresenceSubscribe,
  [ClientEvent.ROOM_PRESENCE_UNSUBSCRIBE]: clientPresenceUnsubscribe,
  [ClientEvent.ROOM_PRESENCE_UNSUBSCRIBE_ALL]: clientPresenceUnsubscribeAll,
  [ClientEvent.ROOM_PRESENCE_JOIN]: clientPresenceJoin,
  [ClientEvent.ROOM_PRESENCE_LEAVE]: clientPresenceLeave,
  [ClientEvent.ROOM_PRESENCE_UPDATE]: rateLimitMiddleware(clientPresenceUpdate),
  [ClientEvent.ROOM_PRESENCE_GET]: clientPresenceGet,
  [ClientEvent.ROOM_PRESENCE_COUNT]: clientPresenceCount,
  [ClientEvent.ROOM_METRICS_SUBSCRIBE]: clientMetricsSubscribe,
  [ClientEvent.ROOM_METRICS_UNSUBSCRIBE]: clientMetricsUnsubscribe,
  [ClientEvent.AUTH_USER_SUBSCRIBE]: clientAuthUserSubscribe,
  [ClientEvent.AUTH_USER_UNSUBSCRIBE]: clientAuthUserUnsubscribe,
  [ClientEvent.AUTH_USER_UNSUBSCRIBE_ALL]: clientAuthUserUnsubscribeAll,
  [ClientEvent.AUTH_USER_STATUS_UPDATE]: clientAuthUserStatusUpdate
};

const logger = getLogger('websocket-router');

const decoder = new TextDecoder('utf-8');

const MESSAGE_MAX_BYTE_LENGTH = 64 * 1024;

export async function handleSocketMessage(
  socket: WebSocket<Session>,
  redisClient: RedisClient,
  message: ArrayBuffer,
  isBinary: boolean,
  app: TemplatedApp
): Promise<void> {
  try {
    const { type, body, ackId, createdAt } = JSON.parse(decoder.decode(message));

    // IMPLEMENT AS MIDDLEWARE!!!!
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
