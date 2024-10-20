import { ClientEvent } from '@/types/event.types';
import {
  clientAuthUserStatusUpdate,
  clientAuthUserSubscribe,
  clientAuthUserUnsubscribe,
  clientAuthUserUnsubscribeAll
} from '@/modules/user/user.handlers';
import { clientRoomHistoryGet } from '@/modules/history/history.handlers';
import { clientPublish, clientRoomJoin, clientRoomLeave } from '../room/room.handlers';
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

export const eventHandlersMap = {
  [ClientEvent.ROOM_JOIN]: clientRoomJoin,
  [ClientEvent.ROOM_LEAVE]: clientRoomLeave,
  [ClientEvent.PUBLISH]: clientPublish,
  [ClientEvent.ROOM_SUBSCRIPTION_BIND]: clientRoomSubscriptionBind,
  [ClientEvent.ROOM_SUBSCRIPTION_UNBIND]: clientRoomSubscriptionUnbind,
  [ClientEvent.ROOM_PRESENCE_SUBSCRIBE]: clientPresenceSubscribe,
  [ClientEvent.ROOM_PRESENCE_UNSUBSCRIBE]: clientPresenceUnsubscribe,
  [ClientEvent.ROOM_PRESENCE_UNSUBSCRIBE_ALL]: clientPresenceUnsubscribeAll,
  [ClientEvent.ROOM_PRESENCE_JOIN]: clientPresenceJoin,
  [ClientEvent.ROOM_PRESENCE_LEAVE]: clientPresenceLeave,
  [ClientEvent.ROOM_PRESENCE_UPDATE]: clientPresenceUpdate,
  [ClientEvent.ROOM_PRESENCE_GET]: clientPresenceGet,
  [ClientEvent.ROOM_PRESENCE_COUNT]: clientPresenceCount,
  [ClientEvent.ROOM_METRICS_SUBSCRIBE]: clientMetricsSubscribe,
  [ClientEvent.ROOM_METRICS_UNSUBSCRIBE]: clientMetricsUnsubscribe,
  [ClientEvent.ROOM_HISTORY_GET]: clientRoomHistoryGet,
  [ClientEvent.AUTH_USER_SUBSCRIBE]: clientAuthUserSubscribe,
  [ClientEvent.AUTH_USER_UNSUBSCRIBE]: clientAuthUserUnsubscribe,
  [ClientEvent.AUTH_USER_UNSUBSCRIBE_ALL]: clientAuthUserUnsubscribeAll,
  [ClientEvent.AUTH_USER_STATUS_UPDATE]: clientAuthUserStatusUpdate
};
