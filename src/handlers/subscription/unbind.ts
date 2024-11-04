import { SocketAckHandler } from '@/types/socket.types';
import { Session } from '@/types/session.types';
import { formatDefaultSubscription, formatErrorResponse } from '@/util/format';
import { getNspRoomId } from '@/util/helpers';
import {
  unbindAllSubscriptions,
  unbindSubscription
} from '@/modules/subscription/subscription.service';
import { KeyNamespace } from '@/types/state.types';
import { WebSocket } from 'uWebSockets.js';
import { Services } from '@/lib/services';
import { getLogger } from '@/util/logger';
import { ClientEvent } from '@/types/event.types';

const logger = getLogger(ClientEvent.ROOM_SUBSCRIPTION_UNBIND);

export function handler({ redisClient }: Services) {
  return async function (
    socket: WebSocket<Session>,
    data: any,
    res: SocketAckHandler
  ): Promise<void> {
    const session = socket.getUserData();

    const { roomId, event } = data;
    const { appPid, connectionId } = session;

    logger.debug('Unbinding subscription', { session, roomId, event });

    const subscription = formatDefaultSubscription(appPid, roomId, event);
    const nspRoomId = getNspRoomId(appPid, roomId);

    try {
      if (!event) {
        await unbindAllSubscriptions(
          redisClient,
          connectionId,
          nspRoomId,
          KeyNamespace.SUBSCRIPTIONS,
          socket
        );
        res(nspRoomId);
      } else {
        await unbindSubscription(
          redisClient,
          connectionId,
          nspRoomId,
          subscription,
          KeyNamespace.SUBSCRIPTIONS,
          socket
        );
        res(subscription);
      }
    } catch (err: any) {
      logger.error(`Failed to unbind subscription`, {
        session,
        nspRoomId,
        subscription
      });

      res(null, formatErrorResponse(err));
    }
  };
}
