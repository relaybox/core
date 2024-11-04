import { WebSocket } from 'uWebSockets.js';
import { DsPermission } from '@/types/permissions.types';
import { Session } from '@/types/session.types';
import { SocketAckHandler } from '@/types/socket.types';
import { formatErrorResponse } from '@/util/format';
import { getNspRoomId } from '@/util/helpers';
import { permissionsGuard } from '@/modules/guards/guards.service';
import { getActiveMemberCount } from '@/modules/presence/presence.service';
import { ClientEvent } from '@/types/event.types';
import { getLogger } from '@/util/logger';
import Services from '@/lib/services';

const logger = getLogger(ClientEvent.ROOM_PRESENCE_COUNT);

export function handler({ redisClient }: Services) {
  return async function (
    socket: WebSocket<Session>,
    data: any,
    res: SocketAckHandler
  ): Promise<void> {
    const session = socket.getUserData();

    const { roomId } = data;
    const { appPid, permissions } = session;

    const nspRoomId = getNspRoomId(appPid, roomId);

    logger.debug(`Getting presence count`, { nspRoomId });

    try {
      permissionsGuard(roomId, DsPermission.PRESENCE, permissions);

      const count = await getActiveMemberCount(redisClient, nspRoomId);

      res(count);
    } catch (err: any) {
      logger.error(`Failed to get presence count`, { roomId, err });
      res(null, formatErrorResponse(err));
    }
  };
}
