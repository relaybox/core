import Services from '@/lib/services';
import { WebSocket } from 'uWebSockets.js';
import { Session } from '@/types/session.types';
import { SocketAckHandler } from '@/types/socket.types';
import { formatErrorResponse, formatUserSubscription } from '@/util/format';
import { removeUserSubscription, unbindUserSubscription } from '@/modules/user/user.service';
import ChannelManager from '@/lib/amqp-manager/channel-manager';
import { getNspClientId } from '@/util/helpers';
import { KeyNamespace } from '@/types/state.types';
import { ClientEvent } from '@/types/event.types';
import { getLogger } from '@/util/logger';

const logger = getLogger(ClientEvent.AUTH_USER_UNSUBSCRIBE);

export function handler({ redisClient }: Services) {
  return async function (
    socket: WebSocket<Session>,
    data: any,
    res: SocketAckHandler
  ): Promise<void> {
    const session = socket.getUserData();

    const { connectionId } = session;
    const { subscriptionId: clientId, event } = data;

    logger.debug('Removing user subscription', {
      clientId
    });

    const nspClientId = getNspClientId(KeyNamespace.USERS, clientId);
    const subscription = formatUserSubscription(nspClientId, event);
    const userRoutingKey = ChannelManager.getRoutingKey(nspClientId);

    try {
      await unbindUserSubscription(
        logger,
        redisClient,
        connectionId,
        nspClientId,
        subscription,
        socket
      );

      await removeUserSubscription(
        logger,
        redisClient,
        connectionId,
        clientId,
        userRoutingKey,
        socket
      );

      res(subscription);
    } catch (err: any) {
      logger.error(`Failed to remove user subscription`, {
        session,
        nspClientId,
        event,
        subscription
      });

      res(null, formatErrorResponse(err));
    }
  };
}
