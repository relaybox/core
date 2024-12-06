import Services from '@/lib/services';
import { WebSocket } from 'uWebSockets.js';
import { Session } from '@/types/session.types';
import { SocketAckHandler } from '@/types/socket.types';
import { formatErrorResponse, formatIntellectSubscription } from '@/util/format';
import { getNspRoomId } from '@/util/helpers';
import { unbindSubscription } from '@/modules/subscription/subscription.service';
import { KeyNamespace } from '@/types/state.types';
import { getLogger } from '@/util/logger';
import { ClientEvent } from '@/types/event.types';

const logger = getLogger(ClientEvent.ROOM_INTELLECT_UNSUBSCRIBE);

export function handler({ redisClient }: Services) {
  return async function (
    socket: WebSocket<Session>,
    data: any,
    res: SocketAckHandler
  ): Promise<void> {
    const session = socket.getUserData();
    const { subscriptionId: roomId, event } = data;
    const { appPid, connectionId } = session;

    const nspRoomId = getNspRoomId(appPid, roomId);
    const subscription = formatIntellectSubscription(nspRoomId, event);

    logger.debug('Unsubscribing from intellect event', {
      session,
      nspRoomId,
      event,
      subscription
    });

    try {
      await unbindSubscription(
        logger,
        redisClient,
        connectionId,
        nspRoomId,
        subscription,
        KeyNamespace.INTELLECT,
        socket
      );
      res(subscription);
    } catch (err: any) {
      logger.error(`Failed to unsubscribe from intellect event`, {
        session,
        nspRoomId,
        event,
        subscription
      });

      res(null, formatErrorResponse(err));
    }
  };
}
