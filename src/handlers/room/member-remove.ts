import Services from '@/lib/services';
import { ReducedSession, Session } from '@/types/session.types';
import { SocketAckHandler } from '@/types/socket.types';
import { getLogger } from '@/util/logger';
import { WebSocket } from 'uWebSockets.js';
import { getRoomById, removeRoomMember, upsertRoomMember } from '@/modules/room/room.service';
import { enqueueWebhookEvent } from '@/modules/webhook/webhook.service';
import { WebhookEvent } from '@/types/webhook.types';
import { formatErrorResponse } from '@/util/format';
import { ClientEvent } from '@/types/event.types';
import { RoomMemberType, RoomVisibility } from '@/types/room.types';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';

const logger = getLogger(ClientEvent.ROOM_MEMBER_REMOVE);

export function handler({ pgPool }: Services) {
  return async function (
    socket: WebSocket<Session>,
    data: any,
    res: SocketAckHandler
  ): Promise<void> {
    const session = socket.getUserData();
    const { appPid, clientId } = session;
    const { roomId, clientId: removeClientId } = data;

    logger.debug(`Removing member from private room`, { roomId, clientId });

    const pgClient = await pgPool!.connect();

    try {
      const room = await getRoomById(logger, pgClient, appPid, roomId, clientId);

      if (!room) {
        throw new NotFoundError('Room not found');
      }

      if (room.visibility !== RoomVisibility.PRIVATE) {
        throw new ValidationError('Room is not private');
      }

      if (room.memberType !== RoomMemberType.OWNER) {
        throw new ForbiddenError('Room is not owned by the client');
      }

      const member = await removeRoomMember(logger, pgClient, removeClientId, room.internalId);

      await enqueueWebhookEvent(logger, WebhookEvent.ROOM_MEMBER_REMOVE, member, session);

      res(member);
    } catch (err: any) {
      logger.error(`Failed to remove room member from private room`, { err, roomId, session });
      res(null, formatErrorResponse(err));
    } finally {
      pgClient.release();
    }
  };
}
