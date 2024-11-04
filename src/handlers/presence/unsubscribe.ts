import { Logger } from 'winston';
import { WebSocket } from 'uWebSockets.js';
import { RedisClient } from '@/lib/redis';
import { Session } from '@/types/session.types';
import { SocketAckHandler } from '@/types/socket.types';
import { formatErrorResponse, formatPresenceSubscription } from '@/util/format';
import { getNspRoomId } from '@/util/helpers';
import { unbindSubscription } from '@/modules/subscription/subscription.service';
import { KeyNamespace } from '@/types/state.types';
import Services from '@/lib/services';
import { getLogger } from '@/util/logger';
import { ClientEvent } from '@/types/event.types';

const logger = getLogger(ClientEvent.ROOM_PRESENCE_UNSUBSCRIBE);

export function handler({ redisClient }: Services) {
  return async function (
    socket: WebSocket<Session>,
    data: any,
    res: SocketAckHandler
  ): Promise<void> {
    const session = socket.getUserData();
    const { roomId, event } = data;
    const { appPid, connectionId } = session;

    const nspRoomId = getNspRoomId(appPid, roomId);
    const subscription = formatPresenceSubscription(nspRoomId, event);

    logger.debug('Unsubscribing from presence', {
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
        KeyNamespace.PRESENCE,
        socket
      );
      res(subscription);
    } catch (err: any) {
      logger.error(`Failed to unsubscribe from presence`, {
        session,
        nspRoomId,
        event,
        subscription
      });

      res(null, formatErrorResponse(err));
    }
  };
}
