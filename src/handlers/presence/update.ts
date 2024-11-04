import Services from '@/lib/services';
import { WebSocket } from 'uWebSockets.js';
import { Session } from '@/types/session.types';
import { SocketAckHandler } from '@/types/socket.types';
import { formatErrorResponse, formatPresenceSubscription } from '@/util/format';
import { getNspRoomId } from '@/util/helpers';
import {
  activeMemberGuard,
  authenticatedSessionGuard,
  roomMemberGuard
} from '@/modules/guards/guards.service';
import { SubscriptionType } from '@/types/subscription.types';
import { updateActiveMember } from '@/modules/presence/presence.service';
import { getLatencyLog } from '@/modules/metrics/metrics.service';
import { enqueueWebhookEvent } from '@/modules/webhook/webhook.service';
import { WebhookEvent } from '@/types/webhook.types';
import { getLogger } from '@/util/logger';
import { ClientEvent } from '@/types/event.types';

const logger = getLogger(ClientEvent.ROOM_PRESENCE_UPDATE);

export function handler({ redisClient }: Services) {
  return async function (
    socket: WebSocket<Session>,
    data: any,
    res: SocketAckHandler,
    createdAt?: string
  ): Promise<void> {
    const session = socket.getUserData();
    const { roomId, userData } = data;
    const { appPid, clientId, connectionId, uid, user } = session;

    const nspRoomId = getNspRoomId(appPid, roomId);
    const subscription = formatPresenceSubscription(nspRoomId, SubscriptionType.UPDATE);
    const timestamp = new Date().toISOString();
    const latencyLog = getLatencyLog(createdAt!);

    const message = {
      clientId,
      data: userData,
      timestamp,
      event: SubscriptionType.UPDATE,
      user
    };

    const webhookData = {
      roomId,
      userData
    };

    try {
      authenticatedSessionGuard(session);

      await roomMemberGuard(logger, redisClient, connectionId, nspRoomId);
      await activeMemberGuard(redisClient, uid, nspRoomId);

      updateActiveMember(clientId, nspRoomId, subscription, session, message, latencyLog);
      enqueueWebhookEvent(WebhookEvent.PRESENCE_UPDATE, webhookData, session);

      logger.info('Client updated presence', {
        session,
        subscription
      });

      res(subscription);
    } catch (err: any) {
      logger.error(`Failed to update presence`, {
        session,
        nspRoomId,
        subscription,
        err
      });

      res(null, formatErrorResponse(err));
    }
  };
}
