import { WebSocket } from 'uWebSockets.js';
import Services from '@/lib/services';
import { DsPermission } from '@/types/permissions.types';
import { Session } from '@/types/session.types';
import { SocketAckHandler } from '@/types/socket.types';
import { formatErrorResponse, formatPresenceSubscription } from '@/util/format';
import { getNspRoomId } from '@/util/helpers';
import { permissionsGuard, roomMemberGuard } from '@/modules/guards/guards.service';
import { bindSubscription } from '@/modules/subscription/subscription.service';
import { KeyNamespace } from '@/types/state.types';
import { getLogger } from '@/util/logger';
import { ClientEvent } from '@/types/event.types';

const logger = getLogger(ClientEvent.ROOM_PRESENCE_SUBSCRIBE);

export function handler({ redisClient }: Services) {
  return async function (
    socket: WebSocket<Session>,
    data: any,
    res: SocketAckHandler
  ): Promise<void> {
    const session = socket.getUserData();
    const { roomId, event } = data;
    const { appPid, permissions, connectionId } = session;

    const nspRoomId = getNspRoomId(appPid, roomId);
    const subscription = formatPresenceSubscription(nspRoomId, event);

    logger.debug('Subscribing to presence', {
      session,
      nspRoomId,
      event,
      subscription
    });

    try {
      permissionsGuard(roomId, DsPermission.PRESENCE, permissions);
      await roomMemberGuard(logger, redisClient, connectionId, nspRoomId);
      await bindSubscription(
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
      logger.error(`Failed to subscribe to presence`, {
        session,
        nspRoomId,
        event,
        subscription
      });

      res(null, formatErrorResponse(err));
    }
  };
}
