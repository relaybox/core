import Services from '@/lib/services';
import ChannelManager from '@/lib/amqp-manager/channel-manager';
import { Session } from '@/types/session.types';
import { SocketAckHandler } from '@/types/socket.types';
import { getNspRoomId } from '@/util/helpers';
import { getLogger } from '@/util/logger';
import { WebSocket } from 'uWebSockets.js';
import {
  initializeRoom,
  evaluateRoomAccess,
  getRoomById,
  joinRoom,
  upsertRoomMember,
  validateRoomId
} from '@/modules/room/room.service';
import { pushRoomJoinMetrics } from '@/modules/metrics/metrics.service';
import { enqueueWebhookEvent } from '@/modules/webhook/webhook.service';
import { WebhookEvent } from '@/types/webhook.types';
import { formatErrorResponse } from '@/util/format';
import { ClientEvent } from '@/types/event.types';
import { RoomMemberType, RoomVisibility } from '@/types/room.types';
import { PasswordSaltPair } from '@/types/auth.types';

const logger = getLogger(ClientEvent.ROOM_JOIN);

export function handler({ pgPool, redisClient }: Services) {
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
    const { roomId } = data;
    const { appPid, clientId } = session;
    const nspRoomId = getNspRoomId(appPid, roomId);
    const nspRoomRoutingKey = ChannelManager.getRoutingKey(nspRoomId);
    const webhookdata = {
      roomId
    };

    logger.debug(`Joining room`, { roomId, clientId });

    const pgClient = await pgPool!.connect();

    try {
      validateRoomId(roomId);

      let room = await getRoomById(logger, pgClient, roomId, clientId);

      if (room) {
        evaluateRoomAccess(logger, room, session);

        await upsertRoomMember(
          logger,
          pgClient,
          roomId,
          room.internalId!,
          RoomMemberType.MEMBER,
          session
        );
      } else {
        room = await initializeRoom(
          logger,
          pgClient,
          roomId,
          RoomVisibility.PUBLIC,
          RoomMemberType.OWNER,
          session,
          passwordSaltPair
        );
      }

      await Promise.all([
        joinRoom(logger, redisClient, session, nspRoomId, socket),
        joinRoom(logger, redisClient, session, nspRoomRoutingKey, socket),
        pushRoomJoinMetrics(redisClient, session, roomId, nspRoomId),
        enqueueWebhookEvent(logger, WebhookEvent.ROOM_JOIN, webhookdata, session)
      ]);

      const responseData = {
        nspRoomId,
        type: room?.visibility || RoomVisibility.PUBLIC
      };

      res(responseData);
    } catch (err: any) {
      logger.error(`Failed to join room "${roomId}"`, { err, roomId, session });
      res(null, formatErrorResponse(err));
    } finally {
      pgClient.release();
    }
  };
}
