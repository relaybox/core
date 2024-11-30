import Services from '@/lib/services';
import { WebSocket } from 'uWebSockets.js';
import { DsPermission } from '@/types/permissions.types';
import { Session } from '@/types/session.types';
import { SocketAckHandler } from '@/types/socket.types';
import { formatErrorResponse } from '@/util/format';
import { getNspRoomId } from '@/util/helpers';
import { permissionsGuard } from '@/modules/guards/guards.service';
import { dedupeActiveMembers, getActiveMembers } from '@/modules/presence/presence.service';
import { getLogger } from '@/util/logger';
import { ClientEvent } from '@/types/event.types';

const logger = getLogger(ClientEvent.ROOM_PRESENCE_GET);

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

    try {
      permissionsGuard(roomId, DsPermission.PRESENCE, permissions);

      const members = await getActiveMembers(redisClient, nspRoomId);
      const dedupedMembers = dedupeActiveMembers(members);

      res(dedupedMembers || []);
    } catch (err: any) {
      logger.error(`Failed to get presence members`, { roomId, err });
      res(null, formatErrorResponse(err));
    }
  };
}
