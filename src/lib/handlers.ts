import { ClientEvent } from '@/types/event.types';
import { rateLimitMiddleware } from '@/modules/websocket/websocket.middleware';
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
import { Services } from './services';

type EventHandler = (...args: any[]) => Promise<void>;

export function createEventHandlersMap(services: Services): Record<ClientEvent, any> {
  return {
    [ClientEvent.ROOM_JOIN]: clientRoomJoin(services),
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
}
