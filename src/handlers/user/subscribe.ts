import Services from '@/lib/services';
import { WebSocket } from 'uWebSockets.js';
import { Session } from '@/types/session.types';
import { SocketAckHandler } from '@/types/socket.types';
import { formatErrorResponse, formatUserSubscription } from '@/util/format';
import { bindUserSubscription, pushUserSubscription } from '@/modules/user/user.service';
import ChannelManager from '@/lib/amqp-manager/channel-manager';
import { getNspClientId } from '@/util/helpers';
import { KeyNamespace } from '@/types/state.types';
import { getLogger } from '@/util/logger';
import { ClientEvent } from '@/types/event.types';

const logger = getLogger(ClientEvent.AUTH_USER_SUBSCRIBE);

export function handler({ redisClient }: Services) {
  return async function (
    socket: WebSocket<Session>,
    data: any,
    res: SocketAckHandler
  ): Promise<void> {
    const session = socket.getUserData();

    const { connectionId } = session;
    const { subscriptionId: clientId, event } = data;

    logger.debug('Creating user subscription', {
      clientId
    });

    const nspClientId = getNspClientId(KeyNamespace.USERS, clientId);
    const subscription = formatUserSubscription(nspClientId, event);
    const userRoutingKey = ChannelManager.getRoutingKey(nspClientId);

    try {
      await bindUserSubscription(
        logger,
        redisClient,
        connectionId,
        nspClientId,
        subscription,
        socket
      );

      await pushUserSubscription(
        logger,
        redisClient,
        connectionId,
        clientId,
        userRoutingKey,
        socket
      );

      res(subscription);
    } catch (err: any) {
      logger.error(`Failed to bind user subscription`, {
        session,
        nspClientId,
        event,
        subscription
      });

      res(null, formatErrorResponse(err));
    }
  };
}
