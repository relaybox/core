import { ClientEvent } from '@/types/event.types';
import { rateLimitMiddleware } from '@/modules/websocket/websocket.middleware';
import { handler as clientAuthUserStatusUpdate } from '@/handlers/user/status';
import { handler as clientAuthUserSubscribe } from '@/handlers/user/subscribe';
import { handler as clientAuthUserUnsubscribe } from '@/handlers/user/unsubscribe';
import { handler as clientAuthUserUnsubscribeAll } from '@/handlers/user/unsubscribe-all';
import { handler as clientRoomSubscriptionBind } from '@/handlers/subscription/bind';
import { handler as clientRoomSubscriptionUnbind } from '@/handlers/subscription/unbind';
import { handler as clientPresenceCount } from '@/handlers/presence/count';
import { handler as clientPresenceGet } from '@/handlers/presence/get';
import { handler as clientPresenceJoin } from '@/handlers/presence/join';
import { handler as clientPresenceLeave } from '@/handlers/presence/leave';
import { handler as clientPresenceSubscribe } from '@/handlers/presence/subscribe';
import { handler as clientPresenceUnsubscribe } from '@/handlers/presence/unsubscribe';
import { handler as clientPresenceUnsubscribeAll } from '@/handlers/presence/unsubscribe-all';
import { handler as clientPresenceUpdate } from '@/handlers/presence/update';
import { handler as clientMetricsSubscribe } from '@/handlers/metrics/subscribe';
import { handler as clientMetricsUnsubscribe } from '@/handlers/metrics/unsubscribe';
import { handler as clientRoomJoin } from '@/handlers/room/join';
import { handler as clientRoomLeave } from '@/handlers/room/leave';
import { handler as clientPublish } from '@/handlers/room/publish';
import { Services } from './services';

type EventHandler = (...args: any[]) => Promise<void>;

export function createEventHandlersMap(services: Services): Record<ClientEvent, any> {
  return {
    [ClientEvent.ROOM_JOIN]: clientRoomJoin(services),
    [ClientEvent.ROOM_LEAVE]: clientRoomLeave(services),
    [ClientEvent.PUBLISH]: rateLimitMiddleware(clientPublish(services)),
    [ClientEvent.ROOM_SUBSCRIPTION_BIND]: clientRoomSubscriptionBind(services),
    [ClientEvent.ROOM_SUBSCRIPTION_UNBIND]: clientRoomSubscriptionUnbind(services),
    [ClientEvent.ROOM_PRESENCE_SUBSCRIBE]: clientPresenceSubscribe(services),
    [ClientEvent.ROOM_PRESENCE_UNSUBSCRIBE]: clientPresenceUnsubscribe(services),
    [ClientEvent.ROOM_PRESENCE_UNSUBSCRIBE_ALL]: clientPresenceUnsubscribeAll(services),
    [ClientEvent.ROOM_PRESENCE_JOIN]: clientPresenceJoin(services),
    [ClientEvent.ROOM_PRESENCE_LEAVE]: clientPresenceLeave(services),
    [ClientEvent.ROOM_PRESENCE_UPDATE]: rateLimitMiddleware(clientPresenceUpdate(services)),
    [ClientEvent.ROOM_PRESENCE_GET]: clientPresenceGet(services),
    [ClientEvent.ROOM_PRESENCE_COUNT]: clientPresenceCount(services),
    [ClientEvent.ROOM_METRICS_SUBSCRIBE]: clientMetricsSubscribe(services),
    [ClientEvent.ROOM_METRICS_UNSUBSCRIBE]: clientMetricsUnsubscribe(services),
    [ClientEvent.AUTH_USER_SUBSCRIBE]: clientAuthUserSubscribe(services),
    [ClientEvent.AUTH_USER_UNSUBSCRIBE]: clientAuthUserUnsubscribe(services),
    [ClientEvent.AUTH_USER_UNSUBSCRIBE_ALL]: clientAuthUserUnsubscribeAll(services),
    [ClientEvent.AUTH_USER_STATUS_UPDATE]: clientAuthUserStatusUpdate(services)
  };
}
