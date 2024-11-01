import * as db from './history.db';
import * as repository from './history.repository';
import { Message } from '@/types/history.types';
import { Logger } from 'winston';
import { PoolClient } from 'pg';
import { PaginatedQueryResult, QueryOrder } from '@/util/pg-query';
import { getISODateString, getISODateStringOrNull } from '@/util/date';
import { RedisClient } from '@/lib/redis';
import { PersistedMessage } from '@/types/data.types';
import { KeyPrefix } from '@/types/state.types';

export const HISTORY_MAX_LIMIT = 100;
export const HISTORY_CACHED_MESSAGE_TTL_SECS = 60;

export async function getMessagesByRoomId(
  logger: Logger,
  pgClient: PoolClient,
  appPid: string,
  roomId: string,
  offset: number,
  limit: number,
  start: number | null = null,
  end: number | null = null,
  order: QueryOrder = QueryOrder.DESC
): Promise<PaginatedQueryResult<Message>> {
  logger.debug(`Getting messages by room id`, { roomId });

  const { rows: messages } = await db.getMessagesByRoomId(
    pgClient,
    appPid,
    roomId,
    offset,
    limit,
    getISODateStringOrNull(start),
    getISODateStringOrNull(end),
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

export async function addMessageToCache(
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
    const key = `${KeyPrefix.HISTORY}:buffer:${message.nspRoomId}`;

    await repository.setCachedMessage(redisClient, key, messageData, timestamp);
  } catch (err: unknown) {
    logger.error(`Failed to cache message`, { err });
    throw err;
  }
}

export function sortItemsByTimestamp(items: Message[]) {
  return items.sort((a, b) => a.timestamp + b.timestamp);
}

export function unshiftNewItems(originalArray: Message[], newElements: Message[]) {
  return [...newElements, ...originalArray];
}

export function pushNewItems(originalArray: Message[], newElements: Message[]) {
  return [...originalArray, ...newElements];
}

export function getMergedItems(
  originalArray: Message[],
  newElements: Message[],
  order: QueryOrder,
  limit: number
): Message[] {
  const mergedItems =
    order === QueryOrder.DESC
      ? unshiftNewItems(originalArray, newElements)
      : pushNewItems(originalArray, newElements);

  return mergedItems.slice(0, limit);
}

export async function getCachedMessagesForRange(
  logger: Logger,
  redisClient: RedisClient,
  appPid: string,
  roomId: string,
  limit: number,
  start: number | null = null,
  end: number | null = null,
  order: QueryOrder = QueryOrder.DESC
): Promise<Message[]> {
  logger.debug(`Getting buffered messages`);

  try {
    const min = start || 0;
    const max = end || Date.now();
    const rev = order === QueryOrder.DESC;
    const key = `${KeyPrefix.HISTORY}:buffer:${appPid}:${roomId}`;

    // Reverse min and max if order is DESC
    // This will provide results in descending order
    const rangeMin = order === QueryOrder.DESC ? max : min;
    const rangeMax = order === QueryOrder.DESC ? min : max;

    let cachedMessagesByRange = await repository.getCachedMessagesForRange(
      redisClient,
      key,
      rangeMin,
      rangeMax,
      limit,
      rev
    );

    return cachedMessagesByRange.map((message) => JSON.parse(message.value));
  } catch (err: unknown) {
    console.log(err);
    logger.error(`Failed to get cached messages`, { err });
    throw err;
  }
}
