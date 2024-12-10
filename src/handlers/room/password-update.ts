import Services from '@/lib/services';
import { Session } from '@/types/session.types';
import { SocketAckHandler } from '@/types/socket.types';
import { getLogger } from '@/util/logger';
import { WebSocket } from 'uWebSockets.js';
import {
  getRoomById,
  getPasswordSaltPair,
  updateRoomPassword,
  roomActionPermitted
} from '@/modules/room/room.service';
import { enqueueWebhookEvent } from '@/modules/webhook/webhook.service';
import { WebhookEvent } from '@/types/webhook.types';
import { formatErrorResponse } from '@/util/format';
import { ClientEvent } from '@/types/event.types';
import { RoomMemberType, RoomVisibility } from '@/types/room.types';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';

const logger = getLogger(ClientEvent.ROOM_PASSWORD_UPDATE);

export function handler({ pgPool }: Services) {
  return async function (
    socket: WebSocket<Session>,
    data: any,
    res: SocketAckHandler
  ): Promise<void> {
    const session = socket.getUserData();
    const { appPid, clientId } = session;
    const { roomId, password: clientPassword } = data;

    logger.debug(`Updating room password`, { roomId, clientId });

    const pgClient = await pgPool!.connect();

    try {
      const room = await getRoomById(logger, pgClient, appPid, roomId, clientId);

      if (!room) {
        throw new NotFoundError('Room not found');
      }

      if (room.visibility !== RoomVisibility.PROTECTED) {
        throw new ValidationError('Room is not protected');
      }

      if (!roomActionPermitted(room.memberType, RoomMemberType.ADMIN)) {
        throw new ForbiddenError('Room is not owned by the client');
      }

      const passwordSaltPair = getPasswordSaltPair(clientPassword);

      await updateRoomPassword(logger, pgClient, room.id, passwordSaltPair);

      const roomData = {
        id: roomId,
        visibility: room?.visibility || RoomVisibility.PUBLIC
      };

      await enqueueWebhookEvent(logger, WebhookEvent.ROOM_PASSWORD_UPDATE, roomData, session);

      res(roomData);
    } catch (err: any) {
      logger.error(`Failed to update room password`, { err, roomId, session });
      res(null, formatErrorResponse(err));
    } finally {
      pgClient.release();
    }
  };
}
