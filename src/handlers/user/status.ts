import { WebSocket } from 'uWebSockets.js';
import { Session } from '@/types/session.types';
import { SocketAckHandler } from '@/types/socket.types';
import { formatErrorResponse, formatUserSubscription } from '@/util/format';
import { getNspClientId } from '@/util/helpers';
import { KeyNamespace } from '@/types/state.types';
import AmqpManager from '@/lib/amqp-manager/amqp-manager';
import { getLatencyLog } from '@/modules/metrics/metrics.service';
import { enqueueWebhookEvent } from '@/modules/webhook/webhook.service';
import { WebhookEvent } from '@/types/webhook.types';
import Services from '@/lib/services';
import { getLogger } from '@/util/logger';
import { ClientEvent } from '@/types/event.types';

const logger = getLogger(ClientEvent.AUTH_USER_STATUS_UPDATE);

export function handler({ redisClient }: Services) {
  return async function (
    socket: WebSocket<Session>,
    data: any,
    res: SocketAckHandler,
    createdAt: string
  ): Promise<void> {
    logger.debug('Updating user status');

    const session = socket.getUserData();

    try {
      if (!session.user) {
        throw new Error('User not found');
      }

      const { status, event } = data;
      const nspClientId = getNspClientId(KeyNamespace.USERS, session.user!.clientId);
      const subscription = formatUserSubscription(nspClientId, event);
      const amqpManager = AmqpManager.getInstance();
      const latencyLog = getLatencyLog(createdAt);

      const messageData = {
        status,
        updatedAt: new Date().toISOString(),
        user: session.user
      };

      const webhookData = {
        status
      };

      amqpManager.dispatchHandler
        .to(nspClientId)
        .dispatch(subscription, messageData, session, latencyLog);

      await enqueueWebhookEvent(WebhookEvent.USER_STATUS_UPDATE, webhookData, session);

      res(messageData);
    } catch (err: any) {
      logger.error(`Failed to update user status`, {
        session
      });

      res(null, formatErrorResponse(err));
    }
  };
}
