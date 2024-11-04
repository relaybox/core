import { SocketAckHandler } from '@/types/socket.types';
import { Session } from '@/types/session.types';
import { formatDefaultSubscription, formatErrorResponse } from '@/util/format';
import { getNspRoomId } from '@/util/helpers';
import { permissionsGuard, roomMemberGuard } from '@/modules/guards/guards.service';
import { DsPermission } from '@/types/permissions.types';
import { bindSubscription } from '@/modules/subscription/subscription.service';
import { KeyNamespace } from '@/types/state.types';
import { WebSocket } from 'uWebSockets.js';
import { getLogger } from '@/util/logger';
import { ClientEvent } from '@/types/event.types';
import Services from '@/lib/services';

const logger = getLogger(ClientEvent.ROOM_SUBSCRIPTION_BIND);

export function handler({ redisClient }: Services) {
  return async function (
    socket: WebSocket<Session>,
    data: any,
    res: SocketAckHandler
  ): Promise<void> {
    const session = socket.getUserData();

    const { roomId, event } = data;
    const { appPid, permissions, connectionId } = session;

    logger.debug('Binding subscription', { session, roomId, event });

    const subscription = formatDefaultSubscription(appPid, roomId, event);
    const nspRoomId = getNspRoomId(appPid, roomId);

    try {
      permissionsGuard(roomId, DsPermission.SUBSCRIBE, permissions);

      await roomMemberGuard(logger, redisClient, connectionId, nspRoomId);
      await bindSubscription(
        logger,
        redisClient,
        connectionId,
        nspRoomId,
        subscription,
        KeyNamespace.SUBSCRIPTIONS,
        socket
      );

      res(subscription);
    } catch (err: any) {
      logger.error(`Failed to bind subscription`, {
        session,
        nspRoomId,
        subscription
      });

      res(null, formatErrorResponse(err));
    }
  };
}
