import { WebSocket } from 'uWebSockets.js';
import { Session } from '@/types/session.types';
import { SocketAckHandler } from '@/types/socket.types';
import { formatErrorResponse, formatMetricsSubscription } from '@/util/format';
import { getNspRoomId } from '@/util/helpers';
import { unbindSubscription } from '@/modules/subscription/subscription.service';
import { KeyNamespace } from '@/types/state.types';
import { ClientEvent } from '@/types/event.types';
import { getLogger } from '@/util/logger';
import Services from '@/lib/services';
import { EventHandler } from '@/lib/handlers';

const logger = getLogger(ClientEvent.ROOM_METRICS_UNSUBSCRIBE);

export function handler({ redisClient }: Services): EventHandler {
  return async function (
    socket: WebSocket<Session>,
    data: any,
    res: SocketAckHandler
  ): Promise<void> {
    const session = socket.getUserData();
    const { roomId, event } = data;
    const { appPid, connectionId } = session;

    const nspRoomId = getNspRoomId(appPid, roomId);
    const subscription = formatMetricsSubscription(nspRoomId, event);

    logger.debug('Unsubscribing from metrics', {
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
        KeyNamespace.METRICS,
        socket
      );

      res(subscription);
    } catch (err: any) {
      logger.error(`Failed to unsubscribe from metrics`, {
        session,
        nspRoomId,
        event,
        subscription
      });

      res(null, formatErrorResponse(err));
    }
  };
}
