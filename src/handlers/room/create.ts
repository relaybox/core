import Services from '@/lib/services';
import { Session } from '@/types/session.types';
import { SocketAckHandler } from '@/types/socket.types';
import { getLogger } from '@/util/logger';
import { WebSocket } from 'uWebSockets.js';
import {
  initializeRoom,
  getRoomById,
  evaluateRoomCreationPermissions
} from '@/modules/room/room.service';
import { enqueueWebhookEvent } from '@/modules/webhook/webhook.service';
import { WebhookEvent } from '@/types/webhook.types';
import { formatErrorResponse } from '@/util/format';
import { ClientEvent } from '@/types/event.types';
import { RoomMemberType, RoomType } from '@/types/room.types';
import { ForbiddenError, ValidationError } from '@/lib/errors';

const logger = getLogger(ClientEvent.ROOM_CREATE);

export function handler({ pgPool, redisClient }: Services) {
  return async function (
    socket: WebSocket<Session>,
    data: any,
    res: SocketAckHandler
  ): Promise<void> {
    const session = socket.getUserData();

    const { clientId } = session;
    const { roomId, type: clientRoomType } = data;

    logger.debug(`Creating room`, { roomId, clientId });

    const pgClient = await pgPool!.connect();

    try {
      if (!Object.values(RoomType).includes(clientRoomType)) {
        throw new ValidationError('Unsupported room type');
      }

      evaluateRoomCreationPermissions(logger, roomId, clientRoomType, session);

      const room = await getRoomById(logger, pgClient, roomId, clientId);

      if (room) {
        throw new ForbiddenError('Room already exists');
      }

      const createdRoom = await initializeRoom(
        logger,
        pgClient,
        roomId,
        clientRoomType,
        RoomMemberType.OWNER,
        session
      );

      const webhookdata = {
        roomId
      };

      await enqueueWebhookEvent(logger, WebhookEvent.ROOM_CREATE, webhookdata, session);

      const responseData = {
        id: roomId,
        type: createdRoom?.roomType || RoomType.PUBLIC
      };

      res(responseData);
    } catch (err: any) {
      logger.error(`Failed to create room "${roomId}"`, { err, roomId, session });
      res(null, formatErrorResponse(err));
    } finally {
      if (pgClient) {
        pgClient.release();
      }
    }
  };
}
