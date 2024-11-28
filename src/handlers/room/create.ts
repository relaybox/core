import Services from '@/lib/services';
import { Session } from '@/types/session.types';
import { SocketAckHandler } from '@/types/socket.types';
import { getLogger } from '@/util/logger';
import { WebSocket } from 'uWebSockets.js';
import {
  initializeRoom,
  getRoomById,
  validateRoomCreatePermissions,
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
    const { appPid, clientId } = session;
    const { roomId, visibility: clientVisibility, password: clientPassword } = data;

    logger.debug(`Creating room`, { roomId, clientId });

    const pgClient = await pgPool!.connect();

    try {
      validateRoomId(roomId);
      validateRoomVisibility(clientVisibility);
      validateRoomCreatePermissions(logger, roomId, clientVisibility, session);

      const room = await getRoomById(logger, pgClient, appPid, roomId, clientId);

      if (room) {
        throw new ForbiddenError('Room already exists');
      }

      if (clientVisibility == RoomVisibility.PROTECTED) {
        passwordSaltPair = getPasswordSaltPair(clientPassword);
      }

      const createdRoom = await initializeRoom(
        logger,
        pgClient,
        roomId,
        clientVisibility,
        RoomMemberType.OWNER,
        session,
        passwordSaltPair
      );

      const roomData = {
        id: roomId,
        visibility: createdRoom?.visibility || RoomVisibility.PUBLIC
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
