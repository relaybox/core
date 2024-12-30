import Services from '@/lib/services';
import ChannelManager from '@/lib/amqp-manager/channel-manager';
import { Session } from '@/types/session.types';
import { SocketAckHandler } from '@/types/socket.types';
import { getNspRoomId } from '@/util/helpers';
import { getLogger } from '@/util/logger';
import { WebSocket } from 'uWebSockets.js';
import {
  initializeRoom,
  validateRoomAccess,
  getRoomById,
  joinRoom,
  upsertRoomMember,
  validateRoomId,
  validateClientPassword
} from '@/modules/room/room.service';
import { pushRoomJoinMetrics } from '@/modules/metrics/metrics.service';
import { enqueueWebhookEvent } from '@/modules/webhook/webhook.service';
import { WebhookEvent } from '@/types/webhook.types';
import { formatErrorResponse } from '@/util/format';
import { ClientEvent } from '@/types/event.types';
import { RoomMemberType, RoomVisibility } from '@/types/room.types';
import { PasswordSaltPair } from '@/types/auth.types';
import { permissionsGuard } from '@/modules/guards/guards.service';
import { DsPermission } from '@/types/permissions.types';
import { getSecretKey, verifySignature } from '@/modules/auth/auth.service';

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
    const { roomId, roomName, password: clientPassword, signature: clientSignature } = data;
    const { appPid, clientId, permissions, keyId } = session;
    const nspRoomId = getNspRoomId(appPid, roomId);
    const nspRoomRoutingKey = ChannelManager.getRoutingKey(nspRoomId);
    const webhookdata = {
      roomId
    };

    logger.debug(`Joining room`, { roomId, clientId });

    const pgClient = await pgPool!.connect();

    try {
      validateRoomId(roomId);

      let room = await getRoomById(logger, pgClient, appPid, roomId, clientId);

      if (room) {
        permissionsGuard(roomId, DsPermission.JOIN, permissions);
        validateRoomAccess(logger, room, session);

        if (room.visibility == RoomVisibility.PROTECTED) {
          validateClientPassword(logger, room, clientPassword);
        }

        if (room.visibility == RoomVisibility.AUTHORIZED) {
          const secretKey = await getSecretKey(logger, pgClient, appPid, keyId);
          await verifySignature(data, clientSignature, secretKey);
        }

        await upsertRoomMember(logger, pgClient, roomId, room.id, RoomMemberType.MEMBER, session);
      } else {
        permissionsGuard(roomId, DsPermission.CREATE, permissions);

        room = await initializeRoom(
          logger,
          pgClient,
          roomId,
          roomName || null,
          RoomVisibility.PUBLIC,
          RoomMemberType.MEMBER,
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
        uuid: room?.id,
        nspRoomId,
        visibility: room?.visibility || RoomVisibility.PUBLIC,
        memberType: room?.memberType || RoomMemberType.MEMBER,
        roomName: room?.roomName || null
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
