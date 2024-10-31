import * as db from './history.db';
import { getLogger } from '@/util/logger';
import { Message } from '@/types/history.types';
import { Logger } from 'winston';
import { PoolClient } from 'pg';
import { PaginatedQueryResult, QueryOrder } from '@/util/pg-query';
import { getISODateString } from '@/util/date';

const logger = getLogger('history'); // TODO: MOVE ALL LOGGERS TO HANDLERS FILE

export const HISTORY_MAX_LIMIT = 100;

export async function getMessagesByRoomId(
  logger: Logger,
  pgClient: PoolClient,
  roomId: string,
  appPid: string,
  offset: number,
  limit: number,
  start: string | null = null,
  end: string | null = null,
  order: QueryOrder = QueryOrder.DESC
): Promise<PaginatedQueryResult<Message>> {
  logger.debug(`Getting messages by room id`, { roomId });

  const { rows: messages } = await db.getMessagesByRoomId(
    pgClient,
    roomId,
    appPid,
    offset,
    limit,
    getISODateString(start),
    getISODateString(end),
    order
  );

  const parsedMessages = parseMessages(messages[0].data);

  return {
    count: messages[0].count,
    data: parsedMessages
  };
}

export function parseMessages(messages: any[]): Message[] {
  if (!messages?.length) {
    return [];
  }

  return messages.map((message) => {
    const { id, body, user, clientId, connectionId, event } = message;

    return {
      id,
      body,
      sender: {
        clientId,
        connectionId,
        user
      },
      timestamp: new Date(message.createdAt).getTime(),
      event
    };
  });
}
