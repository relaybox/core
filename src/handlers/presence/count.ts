import { Logger } from 'winston';
import { WebSocket } from 'uWebSockets.js';
import { RedisClient } from '@/lib/redis';
import { DsPermission } from '@/types/permissions.types';
import { Session } from '@/types/session.types';
import { SocketAckHandler } from '@/types/socket.types';
import { formatErrorResponse } from '@/util/format';
import { getNspRoomId } from '@/util/helpers';
import { permissionsGuard } from '@/modules/guards/guards.service';
import { getActiveMemberCount } from '@/modules/presence/presence.service';

export async function clientPresenceCount(
  logger: Logger,
  redisClient: RedisClient,
  socket: WebSocket<Session>,
  data: any,
  res: SocketAckHandler,
  createdAt: string
): Promise<void> {
  const session = socket.getUserData();
  const { roomId } = data;
  const { appPid, permissions } = session;

  const nspRoomId = getNspRoomId(appPid, roomId);

  try {
    permissionsGuard(roomId, DsPermission.PRESENCE, permissions);

    const count = await getActiveMemberCount(redisClient, nspRoomId);

    res(count);
  } catch (err: any) {
    res(null, formatErrorResponse(err));
  }
}
