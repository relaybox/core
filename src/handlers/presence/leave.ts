import Services from '@/lib/services';
import { WebSocket } from 'uWebSockets.js';
import { Session } from '@/types/session.types';
import { SocketAckHandler } from '@/types/socket.types';
import { formatErrorResponse, formatPresenceSubscription } from '@/util/format';
import { getNspRoomId } from '@/util/helpers';
import { authenticatedSessionGuard } from '@/modules/guards/guards.service';
import { SubscriptionType } from '@/types/subscription.types';
import { removeActiveMember } from '@/modules/presence/presence.service';
import { getLatencyLog, unpublishMetric } from '@/modules/metrics/metrics.service';
import { MetricType } from '@/types/metric.types';
import { enqueueWebhookEvent } from '@/modules/webhook/webhook.service';
import { WebhookEvent } from '@/types/webhook.types';
import { getLogger } from '@/util/logger';
import { ClientEvent } from '@/types/event.types';

const logger = getLogger(ClientEvent.ROOM_PRESENCE_LEAVE);

export function handler({ redisClient }: Services) {
  return async function (
    socket: WebSocket<Session>,
    data: any,
    res: SocketAckHandler,
    createdAt?: string
  ): Promise<void> {
    const session = socket.getUserData();
    const { roomId, userData } = data;
    const { appPid, clientId, user } = session;

    const nspRoomId = getNspRoomId(appPid, roomId);
    const subscription = formatPresenceSubscription(nspRoomId, SubscriptionType.LEAVE);
    const timestamp = new Date().toISOString();
    const latencyLog = getLatencyLog(createdAt!);

    const message = {
      clientId,
      data: userData,
      timestamp,
      event: SubscriptionType.LEAVE,
      user
    };

    const webhookData = {
      roomId,
      userData
    };

    try {
      authenticatedSessionGuard(session);

      await Promise.all([
        removeActiveMember(clientId, nspRoomId, subscription, session, message, latencyLog),
        unpublishMetric(clientId, nspRoomId, MetricType.PRESENCE_MEMBER, session),
        enqueueWebhookEvent(WebhookEvent.PRESENCE_LEAVE, webhookData, session)
      ]);

      logger.info('Client left presence', { session, subscription });

      res(subscription);
    } catch (err: any) {
      logger.error(`Failed to leave presence`, { session, nspRoomId, subscription });
      res(null, formatErrorResponse(err));
    }
  };
}
