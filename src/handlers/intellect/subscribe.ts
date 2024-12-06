import Services from '@/lib/services';
import { WebSocket } from 'uWebSockets.js';
import { DsPermission } from '@/types/permissions.types';
import { Session } from '@/types/session.types';
import { SocketAckHandler } from '@/types/socket.types';
import { formatErrorResponse, formatIntellectSubscription } from '@/util/format';
import { getNspRoomId } from '@/util/helpers';
import { permissionsGuard, roomMemberGuard } from '@/modules/guards/guards.service';
import { bindSubscription } from '@/modules/subscription/subscription.service';
import { KeyNamespace } from '@/types/state.types';
import { getLogger } from '@/util/logger';
import { ClientEvent } from '@/types/event.types';

const logger = getLogger(ClientEvent.ROOM_INTELLECT_SUBSCRIBE);

export function handler({ redisClient }: Services) {
  return async function (
    socket: WebSocket<Session>,
    data: any,
    res: SocketAckHandler
  ): Promise<void> {
    const session = socket.getUserData();
    const { subscriptionId: roomId, event } = data;
    const { appPid, permissions, connectionId } = session;

    const nspRoomId = getNspRoomId(appPid, roomId);
    const subscription = formatIntellectSubscription(nspRoomId, event);

    logger.debug('Subscribing to intellect event', {
      session,
      nspRoomId,
      event,
      subscription
    });

    try {
      permissionsGuard(roomId, DsPermission.INTELLECT, permissions);
      // await roomMemberGuard(logger, redisClient, connectionId, nspRoomId);
      await bindSubscription(
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
      logger.error(`Failed to subscribe to intellect`, {
        session,
        nspRoomId,
        event,
        subscription
      });

      res(null, formatErrorResponse(err));
    }
  };
}
