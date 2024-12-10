import Services from '@/lib/services';
import { Session } from '@/types/session.types';
import { SocketAckHandler } from '@/types/socket.types';
import { getLogger } from '@/util/logger';
import { WebSocket } from 'uWebSockets.js';
import {
  getRoomById,
  roomActionPermitted,
  updateRoomMemberType
} from '@/modules/room/room.service';
import { enqueueWebhookEvent } from '@/modules/webhook/webhook.service';
import { WebhookEvent } from '@/types/webhook.types';
import { formatErrorResponse } from '@/util/format';
import { ClientEvent } from '@/types/event.types';
import { RoomMemberType } from '@/types/room.types';
import { ForbiddenError, NotFoundError } from '@/lib/errors';
import { getUserByClientId } from '@/modules/auth/auth.service';

const logger = getLogger(ClientEvent.ROOM_MEMBER_TYPE);

export function handler({ pgPool }: Services) {
  return async function (
    socket: WebSocket<Session>,
    data: any,
    res: SocketAckHandler
  ): Promise<void> {
    const session = socket.getUserData();
    const { appPid, clientId } = session;
    const { roomId, clientId: updateClientId, memberType: updateMemberType } = data;

    logger.debug(`Adding member to private room`, { roomId, clientId });

    const pgClient = await pgPool!.connect();

    try {
      const room = await getRoomById(logger, pgClient, appPid, roomId, clientId);

      if (!room) {
        throw new NotFoundError('Room not found');
      }

      if (!roomActionPermitted(room.memberType, RoomMemberType.ADMIN)) {
        throw new ForbiddenError('Room is not owned by the client');
      }

      const user = await getUserByClientId(logger, pgClient, updateClientId);

      if (!user) {
        throw new NotFoundError('User not found');
      }

      const member = await updateRoomMemberType(
        logger,
        pgClient,
        room.id,
        updateClientId,
        updateMemberType
      );

      await enqueueWebhookEvent(logger, WebhookEvent.ROOM_MEMBER_ADD, member, session);

      res(member);
    } catch (err: any) {
      logger.error(`Failed to add member to private room`, { err, roomId, session });
      res(null, formatErrorResponse(err));
    } finally {
      pgClient.release();
    }
  };
}
