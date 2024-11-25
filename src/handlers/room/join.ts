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
  joinRoom
} from '@/modules/room/room.service';
import { pushRoomJoinMetrics } from '@/modules/metrics/metrics.service';
import { enqueueWebhookEvent } from '@/modules/webhook/webhook.service';
import { WebhookEvent } from '@/types/webhook.types';
import { formatErrorResponse } from '@/util/format';
import { ClientEvent } from '@/types/event.types';
import { RoomMemberType } from '@/types/room.types';

const logger = getLogger(ClientEvent.ROOM_JOIN);

export function handler({ pgPool, redisClient }: Services) {
  return async function (
    socket: WebSocket<Session>,
    data: any,
    res: SocketAckHandler
  ): Promise<void> {
    const session = socket.getUserData();

    const { roomId, roomType } = data;

    logger.debug(`Joining room`, { roomId, session });

    const pgClient = await pgPool!.connect();

    try {
      const room = await getRoomById(logger, pgClient, roomId, session.clientId!);
      const nspRoomId = getNspRoomId(session.appPid, roomId);
      const nspRoomRoutingKey = ChannelManager.getRoutingKey(nspRoomId);
      const webhookdata = {
        roomId
      };

      if (room) {
        evaluateRoomAccess(logger, room, session.clientId!);
      } else {
        await initializeRoom(logger, pgClient, roomId, roomType, RoomMemberType.OWNER, session);
      }

      await Promise.all([
        joinRoom(logger, redisClient, session, nspRoomId, socket),
        joinRoom(logger, redisClient, session, nspRoomRoutingKey, socket),
        pushRoomJoinMetrics(redisClient, session, roomId, nspRoomId, roomType),
        enqueueWebhookEvent(logger, WebhookEvent.ROOM_JOIN, webhookdata, session)
      ]);

      res(nspRoomId);
    } catch (err: any) {
      logger.error(`Failed to join room "${roomId}"`, { err, roomId, session });
      res(null, formatErrorResponse(err));
    } finally {
      if (pgClient) {
        pgClient.release();
      }
    }
  };
}
