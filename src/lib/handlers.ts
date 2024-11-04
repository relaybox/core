import { ClientEvent } from '@/types/event.types';
import Services from '@/lib/services';
import { rateLimitMiddleware } from '@/modules/websocket/websocket.middleware';
import { handler as userStatusUpdateHandler } from '@/handlers/user/status';
import { handler as userSubscribeHandler } from '@/handlers/user/subscribe';
import { handler as userUnsubscribeHandler } from '@/handlers/user/unsubscribe';
import { handler as userUnsubscribeAllHandler } from '@/handlers/user/unsubscribe-all';
import { handler as subscriptionBindHandler } from '@/handlers/subscription/bind';
import { handler as subscriptionUnbindHandler } from '@/handlers/subscription/unbind';
import { handler as presenceCountHandler } from '@/handlers/presence/count';
import { handler as presenceGetHandler } from '@/handlers/presence/get';
import { handler as presenceJoinHandler } from '@/handlers/presence/join';
import { handler as presenceLeaveHandler } from '@/handlers/presence/leave';
import { handler as presenceSubscribeHandler } from '@/handlers/presence/subscribe';
import { handler as presenceUnsubscribeHandler } from '@/handlers/presence/unsubscribe';
import { handler as presenceUnsubscribeAllHandler } from '@/handlers/presence/unsubscribe-all';
import { handler as presenceUpdateHandler } from '@/handlers/presence/update';
import { handler as metricsSubscribeHandler } from '@/handlers/metrics/subscribe';
import { handler as metricsUnsubscribeHandler } from '@/handlers/metrics/unsubscribe';
import { handler as roomJoinHandler } from '@/handlers/room/join';
import { handler as roomLeaveHandler } from '@/handlers/room/leave';
import { handler as roomPublishHandler } from '@/handlers/room/publish';

type EventHandler = (...args: any[]) => Promise<void>;

export function createEventHandlersMap(services: Services): Record<ClientEvent, any> {
  return {
    [ClientEvent.ROOM_JOIN]: roomJoinHandler(services),
    [ClientEvent.ROOM_LEAVE]: roomLeaveHandler(services),
    // [ClientEvent.PUBLISH]: rateLimitMiddleware(roomPublishHandler(services)),
    [ClientEvent.PUBLISH]: roomPublishHandler(services),
    [ClientEvent.ROOM_SUBSCRIPTION_BIND]: subscriptionBindHandler(services),
    [ClientEvent.ROOM_SUBSCRIPTION_UNBIND]: subscriptionUnbindHandler(services),
    [ClientEvent.ROOM_PRESENCE_SUBSCRIBE]: presenceSubscribeHandler(services),
    [ClientEvent.ROOM_PRESENCE_UNSUBSCRIBE]: presenceUnsubscribeHandler(services),
    [ClientEvent.ROOM_PRESENCE_UNSUBSCRIBE_ALL]: presenceUnsubscribeAllHandler(services),
    [ClientEvent.ROOM_PRESENCE_JOIN]: presenceJoinHandler(services),
    [ClientEvent.ROOM_PRESENCE_LEAVE]: presenceLeaveHandler(services),
    // [ClientEvent.ROOM_PRESENCE_UPDATE]: rateLimitMiddleware(presenceUpdateHandler(services)),
    [ClientEvent.ROOM_PRESENCE_UPDATE]: presenceUpdateHandler(services),
    [ClientEvent.ROOM_PRESENCE_GET]: presenceGetHandler(services),
    [ClientEvent.ROOM_PRESENCE_COUNT]: presenceCountHandler(services),
    [ClientEvent.ROOM_METRICS_SUBSCRIBE]: metricsSubscribeHandler(services),
    [ClientEvent.ROOM_METRICS_UNSUBSCRIBE]: metricsUnsubscribeHandler(services),
    [ClientEvent.AUTH_USER_SUBSCRIBE]: userSubscribeHandler(services),
    [ClientEvent.AUTH_USER_UNSUBSCRIBE]: userUnsubscribeHandler(services),
    [ClientEvent.AUTH_USER_UNSUBSCRIBE_ALL]: userUnsubscribeAllHandler(services),
    [ClientEvent.AUTH_USER_STATUS_UPDATE]: userStatusUpdateHandler(services)
  };
}
