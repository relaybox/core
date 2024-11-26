import Services from '@/lib/services';
import { Session } from '@/types/session.types';
import { SocketAckHandler } from '@/types/socket.types';
import { getLogger } from '@/util/logger';
import { WebSocket } from 'uWebSockets.js';
import {
  initializeRoom,
  getRoomById,
  evaluateRoomCreatePermissions,
  validateRoomId,
  validateRoomVisibility,
  getPasswordSaltPair
} from '@/modules/room/room.service';
import { enqueueWebhookEvent } from '@/modules/webhook/webhook.service';
import { WebhookEvent } from '@/types/webhook.types';
import { formatErrorResponse } from '@/util/format';
import { ClientEvent } from '@/types/event.types';
import { RoomMemberType, RoomVisibility } from '@/types/room.types';
import { ForbiddenError } from '@/lib/errors';
import { PasswordSaltPair } from '@/types/auth.types';

const logger = getLogger(ClientEvent.ROOM_CREATE);

export function handler({ pgPool }: Services) {
  return async function (
    socket: WebSocket<Session>,
    data: any,
    res: SocketAckHandler
  ): Promise<void> {
    let passwordSaltPair = {
      password: null,
      salt: null
    } as PasswordSaltPair;

    const session = socket.getUserData();

    const { clientId } = session;
    const { roomId, visibility: clientRoomVisibility, password: clientPassword } = data;

    logger.debug(`Creating room`, { roomId, clientId });

    const pgClient = await pgPool!.connect();

    try {
      validateRoomId(roomId);
      validateRoomVisibility(clientRoomVisibility);
      evaluateRoomCreatePermissions(logger, roomId, clientRoomVisibility, session);

      const room = await getRoomById(logger, pgClient, roomId, clientId);

      if (room) {
        throw new ForbiddenError('Room already exists');
      }

      if (clientRoomVisibility == RoomVisibility.PROTECTED) {
        passwordSaltPair = getPasswordSaltPair(clientPassword);
      }

      const createdRoom = await initializeRoom(
        logger,
        pgClient,
        roomId,
        clientRoomVisibility,
        RoomMemberType.OWNER,
        session,
        passwordSaltPair
      );

      const roomData = {
        id: roomId,
        type: createdRoom?.visibility || RoomVisibility.PUBLIC
      };

      await enqueueWebhookEvent(logger, WebhookEvent.ROOM_CREATE, roomData, session);

      res(roomData);
    } catch (err: any) {
      logger.error(`Failed to create room "${roomId}"`, { err, roomId, session });
      res(null, formatErrorResponse(err));
    } finally {
      pgClient.release();
    }
  };
}
