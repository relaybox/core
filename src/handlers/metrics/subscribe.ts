import { Session } from '@/types/session.types';
import { SocketAckHandler } from '@/types/socket.types';
import { formatErrorResponse, formatMetricsSubscription } from '@/util/format';
import { getNspRoomId } from '@/util/helpers';
import { permissionsGuard } from '@/modules/guards/guards.service';
import { DsPermission } from '@/types/permissions.types';
import { bindSubscription } from '@/modules/subscription/subscription.service';
import { KeyNamespace } from '@/types/state.types';
import { WebSocket } from 'uWebSockets.js';
import Services from '@/lib/services';
import { ClientEvent } from '@/types/event.types';
import { getLogger } from '@/util/logger';
import { EventHandler } from '@/lib/handlers';

const logger = getLogger(ClientEvent.ROOM_METRICS_SUBSCRIBE);

export function handler({ redisClient }: Services): EventHandler {
  return async function (
    socket: WebSocket<Session>,
    data: any,
    res: SocketAckHandler
  ): Promise<void> {
    const session = socket.getUserData();

    const { roomId, event } = data;
    const { appPid, permissions, connectionId } = session;

    const nspRoomId = getNspRoomId(appPid, roomId);
    const subscription = formatMetricsSubscription(nspRoomId, event);

    logger.debug('Subscribing to metrics', {
      session,
      nspRoomId,
      event,
      subscription
    });

    try {
      permissionsGuard(roomId, DsPermission.METRICS, permissions);

      await bindSubscription(
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
      logger.error(`Failed to subscribe to metrics`, { session, nspRoomId, event, subscription });
      res(null, formatErrorResponse(err));
    }
  };
}
