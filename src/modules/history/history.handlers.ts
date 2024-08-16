import { RedisClient } from '../../lib/redis';
import { Session } from '../../types/session.types';
import { SocketAckHandler } from '../../types/socket.types';
import { WebSocket } from 'uWebSockets.js';
import { Logger } from 'winston';
import { getRoomHistoryMessages, HISTORY_MAX_LIMIT, HISTORY_MAX_SECONDS } from './history.service';
import { formatErrorResponse } from '../../util/format';
import { permissionsGuard } from '../guards/guards.service';
import { DsPermission } from '../../types/permissions.types';
import { extractRoomId } from '../../util/helpers';

export async function clientRoomHistoryGet(
  logger: Logger,
  redisClient: RedisClient,
  socket: WebSocket<Session>,
  data: any,
  res: SocketAckHandler
): Promise<void> {
  const session = socket.getUserData();
  const { nspRoomId, seconds, limit, nextPageToken, items } = data;
  const roomId = extractRoomId(nspRoomId);

  try {
    permissionsGuard(roomId, DsPermission.HISTORY, session.permissions);

    const historyData = await getRoomHistoryMessages(
      redisClient,
      nspRoomId,
      seconds || HISTORY_MAX_SECONDS,
      limit || HISTORY_MAX_LIMIT,
      items || null,
      nextPageToken
    );

    console.log(historyData.messages);
    console.log(historyData.nextPageToken);

    res(historyData);
  } catch (err: any) {
    logger.error({ message: err.message, nspRoomId });
    res(null, formatErrorResponse(err));
  }
}
