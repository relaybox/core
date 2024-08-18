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
import { HistoryOrder } from '../../types/history.types';

export async function clientRoomHistoryGet(
  logger: Logger,
  redisClient: RedisClient,
  socket: WebSocket<Session>,
  data: any,
  res: SocketAckHandler
): Promise<void> {
  const session = socket.getUserData();
  let { nspRoomId, start, end, seconds, limit, nextPageToken, items, order } = data;
  const roomId = extractRoomId(nspRoomId);

  try {
    permissionsGuard(roomId, DsPermission.HISTORY, session.permissions);

    start = start || null;
    end = end || null;
    seconds = seconds || HISTORY_MAX_SECONDS;
    limit = limit || HISTORY_MAX_LIMIT;
    items = items || null;
    order = order || HistoryOrder.DESC;
    nextPageToken = nextPageToken || null;

    if (seconds && seconds > HISTORY_MAX_SECONDS) {
      throw new Error(`Invalid seconds parameter`);
    }

    if (limit > HISTORY_MAX_LIMIT) {
      throw new Error(`Invalid limit parameter`);
    }

    if (order !== HistoryOrder.DESC && !seconds && !start) {
      throw new Error(
        `Either 'seconds' or 'start' must be provided when order is ${HistoryOrder.ASC}`
      );
    }

    console.log(start, end, seconds, limit, items, order, nextPageToken);

    const historyData = await getRoomHistoryMessages(
      redisClient,
      nspRoomId,
      start,
      end,
      seconds,
      limit,
      items,
      order,
      nextPageToken
    );

    res(historyData);
  } catch (err: any) {
    logger.error({ message: err.message, nspRoomId });
    res(null, formatErrorResponse(err));
  }
}
