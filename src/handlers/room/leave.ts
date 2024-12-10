import Services from '@/lib/services';
import ChannelManager from '@/lib/amqp-manager/channel-manager';
import { Session } from '@/types/session.types';
import { SocketAckHandler } from '@/types/socket.types';
import { getNspRoomId } from '@/util/helpers';
import { getLogger } from '@/util/logger';
import { WebSocket } from 'uWebSockets.js';
import { leaveRoom } from '@/modules/room/room.service';
import { pushRoomLeaveMetrics } from '@/modules/metrics/metrics.service';
import { enqueueWebhookEvent } from '@/modules/webhook/webhook.service';
import { WebhookEvent } from '@/types/webhook.types';
import { formatErrorResponse, formatPresenceSubscription } from '@/util/format';
import { ClientEvent } from '@/types/event.types';
import { SubscriptionType } from '@/types/subscription.types';
import { removeActiveMember } from '@/modules/presence/presence.service';
import { unbindAllSubscriptions } from '@/modules/subscription/subscription.service';
import { KeyNamespace } from '@/types/state.types';

const logger = getLogger(ClientEvent.ROOM_LEAVE);

export function handler({ redisClient }: Services) {
  return async function (
    socket: WebSocket<Session>,
    data: any,
    res: SocketAckHandler
  ): Promise<void> {
    const session = socket.getUserData();

    const { roomId } = data;
    const { uid, connectionId, user, clientId } = session;

    try {
      const nspRoomId = getNspRoomId(session.appPid, roomId);
      const nspRoomRoutingKey = ChannelManager.getRoutingKey(nspRoomId);
      const presenceSubsciption = formatPresenceSubscription(nspRoomId, SubscriptionType.LEAVE);
      const timestamp = new Date().toISOString();

      const presenceLeaveMessage = {
        clientId,
        event: SubscriptionType.LEAVE,
        user,
        timestamp
      };

      const webhookdata = {
        roomId
      };

      await Promise.all([
        leaveRoom(logger, redisClient, session, nspRoomId, socket),
        leaveRoom(logger, redisClient, session, nspRoomRoutingKey, socket),
        removeActiveMember(uid, nspRoomId, presenceSubsciption, session, presenceLeaveMessage),
        unbindAllSubscriptions(
          logger,
          redisClient,
          connectionId,
          nspRoomId,
          KeyNamespace.SUBSCRIPTIONS,
          socket
        ),
        unbindAllSubscriptions(
          logger,
          redisClient,
          connectionId,
          nspRoomId,
          KeyNamespace.PRESENCE,
          socket
        ),
        unbindAllSubscriptions(
          logger,
          redisClient,
          connectionId,
          nspRoomId,
          KeyNamespace.METRICS,
          socket
        ),
        unbindAllSubscriptions(
          logger,
          redisClient,
          connectionId,
          nspRoomId,
          KeyNamespace.INTELLECT,
          socket
        ),
        pushRoomLeaveMetrics(uid, nspRoomId, session),
        enqueueWebhookEvent(logger, WebhookEvent.ROOM_LEAVE, webhookdata, session)
      ]);

      res(nspRoomId);
    } catch (err: any) {
      logger.error(`Failed to leave room "${roomId}"`, { err, roomId, session });

      res(null, formatErrorResponse(err));
    }
  };
}
