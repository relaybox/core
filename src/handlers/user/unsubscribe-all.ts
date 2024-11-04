import Services from '@/lib/services';
import { WebSocket } from 'uWebSockets.js';
import { Session } from '@/types/session.types';
import { SocketAckHandler } from '@/types/socket.types';
import { formatErrorResponse } from '@/util/format';
import {
  getUserSubscriptions,
  removeUserSubscription,
  unbindUserSubscription
} from '@/modules/user/user.service';
import ChannelManager from '@/lib/amqp-manager/channel-manager';
import { getNspClientId } from '@/util/helpers';
import { KeyNamespace } from '@/types/state.types';
import { getLogger } from '@/util/logger';
import { ClientEvent } from '@/types/event.types';

const logger = getLogger(ClientEvent.AUTH_USER_UNSUBSCRIBE_ALL);

export function handler({ redisClient }: Services) {
  return async function (
    socket: WebSocket<Session>,
    data: any,
    res: SocketAckHandler
  ): Promise<void> {
    const session = socket.getUserData();

    const { connectionId } = session;
    const { subscriptionId: clientId } = data;

    logger.debug('Deleting all user subscriptions', {
      clientId
    });

    const nspClientId = getNspClientId(KeyNamespace.USERS, clientId);
    const subscriptions = await getUserSubscriptions(
      logger,
      redisClient,
      connectionId,
      nspClientId
    );
    const userRoutingKey = ChannelManager.getRoutingKey(nspClientId);

    try {
      await Promise.all(
        subscriptions.map(async (subscription) =>
          unbindUserSubscription(
            logger,
            redisClient,
            connectionId,
            nspClientId,
            subscription,
            socket
          )
        )
      );

      await removeUserSubscription(
        logger,
        redisClient,
        connectionId,
        clientId,
        userRoutingKey,
        socket
      );

      res(true);
    } catch (err: any) {
      logger.error(`Failed to delete all user subscriptions`, {
        session,
        nspClientId
      });

      res(null, formatErrorResponse(err));
    }
  };
}
