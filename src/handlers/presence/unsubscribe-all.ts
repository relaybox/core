import { WebSocket } from 'uWebSockets.js';
import { Session } from '@/types/session.types';
import { SocketAckHandler } from '@/types/socket.types';
import { formatErrorResponse } from '@/util/format';
import { getNspRoomId } from '@/util/helpers';
import { ClientEvent } from '@/types/event.types';
import { getLogger } from '@/util/logger';
import { Services } from '@/lib/services';
import { unbindAllSubscriptions } from '@/modules/subscription/subscription.service';
import { KeyNamespace } from '@/types/state.types';

const logger = getLogger(ClientEvent.ROOM_PRESENCE_UNSUBSCRIBE_ALL);

export function handler({ redisClient }: Services) {
  return async function (
    socket: WebSocket<Session>,
    data: any,
    res: SocketAckHandler
  ): Promise<void> {
    const session = socket.getUserData();
    const { roomId } = data;
    const { appPid, connectionId } = session;

    logger.debug('Unsubscribing from presence (all subscriptions)', { session, roomId });

    const nspRoomId = getNspRoomId(appPid, roomId);

    try {
      await unbindAllSubscriptions(
        redisClient,
        connectionId,
        nspRoomId,
        KeyNamespace.PRESENCE,
        socket
      );

      res(true);
    } catch (err: any) {
      logger.error(`Failed to unsubscribe from presence (all subscriptions)`, { err, roomId });
      res(null, formatErrorResponse(err));
    }
  };
}
