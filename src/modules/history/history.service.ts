import * as db from './history.db';
import * as repository from './history.repository';
import { getLogger } from '@/util/logger';
import { Message } from '@/types/history.types';
import { Logger } from 'winston';
import { PoolClient } from 'pg';
import { PaginatedQueryResult, QueryOrder } from '@/util/pg-query';
import { getISODateString } from '@/util/date';
import { RedisClient } from '@/lib/redis';
import { PersistedMessage } from '@/types/data.types';
import { KeyPrefix } from '@/types/state.types';

const logger = getLogger('history'); // TODO: MOVE ALL LOGGERS TO HANDLERS FILE

export const HISTORY_MAX_LIMIT = 100;
export const HISTORY_CACHED_MESSAGE_TTL_SECS = 120;

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
    items: parsedMessages
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

export async function cacheMessage(
  logger: Logger,
  redisClient: RedisClient,
  persistedMessage: PersistedMessage
): Promise<void> {
  logger.debug(`Caching message`, { id: persistedMessage.message?.data.id });

  if (!persistedMessage.message) {
    logger.error(`Message not found`);
    return;
  }

  try {
    const message = persistedMessage.message;
    const messageData = message.data;
    const timestamp = message.data.timestamp;
    const partitionKey = getPartitionKey(timestamp);
    const key = `${KeyPrefix.HISTORY}:${message.nspRoomId}:${partitionKey}`;

    await repository.setCachedMessage(redisClient, key, messageData, timestamp);
    await repository.setCachedMessageExpiry(redisClient, key, HISTORY_CACHED_MESSAGE_TTL_SECS);
  } catch (err: unknown) {
    logger.error(`Failed to cache message`, { err });
    throw err;
  }
}

export function getPartitionKey(timestamp: number): number {
  return Math.floor(timestamp / 60) * 60;
}
