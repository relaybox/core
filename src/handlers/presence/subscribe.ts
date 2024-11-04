import { Logger } from 'winston';
import { WebSocket } from 'uWebSockets.js';
import { RedisClient } from '@/lib/redis';
import { DsPermission } from '@/types/permissions.types';
import { Session } from '@/types/session.types';
import { SocketAckHandler } from '@/types/socket.types';
import { formatErrorResponse, formatPresenceSubscription } from '@/util/format';
import { getNspRoomId } from '@/util/helpers';
import { permissionsGuard, roomMemberGuard } from '@/modules/guards/guards.service';
import { bindSubscription } from '@/modules/subscription/subscription.service';
import { KeyNamespace } from '@/types/state.types';

export async function clientPresenceSubscribe(
  logger: Logger,
  redisClient: RedisClient,
  socket: WebSocket<Session>,
  data: any,
  res: SocketAckHandler,
  createdAt: string
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
    await roomMemberGuard(redisClient, connectionId, nspRoomId);
    await bindSubscription(
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
}
