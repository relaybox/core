import { RedisClient } from '../../lib/redis';
import { Session } from '../../types/session.types';
import { SocketAckHandler } from '../../types/socket.types';
import { WebSocket } from 'uWebSockets.js';
import { Logger } from 'winston';
import { getRoomHistoryMessages, HISTORY_MAX_LIMIT, HISTORY_MAX_RANGE_MS } from './history.service';
import { formatErrorResponse } from '../../util/format';

export async function clientRoomHistoryGet(
  logger: Logger,
  redisClient: RedisClient,
  socket: WebSocket<Session>,
  data: any,
  res: SocketAckHandler
): Promise<void> {
  const { nspRoomId, seconds, limit, nextPageToken } = data;

  try {
    const historyData = await getRoomHistoryMessages(
      redisClient,
      nspRoomId,
      seconds || HISTORY_MAX_RANGE_MS,
      limit || HISTORY_MAX_LIMIT,
      nextPageToken
    );

    res(historyData);
  } catch (err: any) {
    logger.error({ message: err.message, nspRoomId });
    res(null, formatErrorResponse(err));
  }
}
