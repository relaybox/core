import * as db from './history.db';
import * as repository from './history.repository';
import { HistoryNextPageTokenData, HistoryRequestParams, Message } from '@/types/history.types';
import { Logger } from 'winston';
import { PoolClient } from 'pg';
import { PaginatedQueryResult, QueryOrder } from '@/util/pg-query';
import { getISODateStringOrNull } from '@/util/date';
import { RedisClient } from '@/lib/redis';
import { PersistedMessage } from '@/types/data.types';
import { KeyPrefix } from '@/types/state.types';
import { ParsedHttpRequest } from '@/lib/middleware';

export const HISTORY_MAX_LIMIT = 100;
export const HISTORY_CACHED_MESSAGE_TTL_SECS = 60;

export function parseRequestQueryParams(req: ParsedHttpRequest): HistoryRequestParams {
  const tokenParams = decodeNextPageToken(req.query.nextPageToken || '');

  const lastItemId = tokenParams?.lastItemId || null;
  const start = tokenParams?.start || Number(req.query.start) || null;
  const end = tokenParams?.end || Number(req.query.end) || null;
  const order = tokenParams?.order || ((req.query.order || QueryOrder.DESC) as QueryOrder);
  const limit = tokenParams?.limit || Number(req.query.limit) || HISTORY_MAX_LIMIT;

  return {
    lastItemId,
    start,
    end,
    order,
    limit
  };
}

export async function getMessagesByRoomId(
  logger: Logger,
  pgClient: PoolClient,
  appPid: string,
  roomId: string,
  start: number | null = null,
  end: number | null = null,
  order: QueryOrder = QueryOrder.DESC,
  limit: number,
  lastItemId: string | null = null
): Promise<PaginatedQueryResult<Message>> {
  logger.debug(`Getting messages by room id`, { roomId });

  const { rows: messages } = await db.getMessagesByRoomId(
    pgClient,
    appPid,
    roomId,
    getISODateStringOrNull(start),
    getISODateStringOrNull(end),
    order,
    limit,
    lastItemId
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

export function unshiftNewItems(
  originalArray: Message[],
  newElements: Message[],
  keyMap: Map<string, Message>
): Message[] {
  const mergedItems = [...originalArray];

  for (const newElement of newElements) {
    if (!keyMap.has(newElement.id)) {
      mergedItems.unshift(newElement);
    }
  }

  return mergedItems;
}

export function pushNewItems(
  originalArray: Message[],
  newElements: Message[],
  keyMap: Map<string, Message>
): Message[] {
  const mergedItems = [...originalArray];

  for (const newElement of newElements) {
    if (!keyMap.has(newElement.id)) {
      mergedItems.unshift(newElement);
    }
  }

  return mergedItems;
}

export function getMergedItems(
  originalArray: Message[],
  newElements: Message[],
  limit: number,
  order: QueryOrder
): Message[] {
  const keyMap = new Map(originalArray.map((item) => [item.id, item]));

  const mergedItems =
    order === QueryOrder.DESC
      ? unshiftNewItems(originalArray, newElements, keyMap)
      : pushNewItems(originalArray, newElements, keyMap);

  return mergedItems.slice(0, limit);
}

// export async function getCachedMessagesForRange(
//   logger: Logger,
//   redisClient: RedisClient,
//   appPid: string,
//   roomId: string,
//   start: number | null = null,
//   end: number | null = null,
//   order: QueryOrder = QueryOrder.DESC,
//   limit: number
// ): Promise<Message[]> {
//   logger.debug(`Getting buffered messages`);

//   try {
//     const min = start || 0;
//     const max = end || Date.now();
//     const rev = order === QueryOrder.DESC;
//     const key = `${KeyPrefix.HISTORY}:buffer:${appPid}:${roomId}`;

//     // Reverse min and max if order is DESC
//     // This will provide results in descending order
//     const rangeMin = order === QueryOrder.DESC ? max : min;
//     const rangeMax = order === QueryOrder.DESC ? min : max;

//     let cachedMessagesByRange = await repository.getCachedMessagesForRange(
//       redisClient,
//       key,
//       rangeMin,
//       rangeMax,
//       limit,
//       rev
//     );

//     return cachedMessagesByRange.map((message) => JSON.parse(message.value));
//   } catch (err: unknown) {
//     console.log(err);
//     logger.error(`Failed to get cached messages`, { err });
//     throw err;
//   }
// }

export function getNextPageToken(
  items: Message[],
  start: number | null,
  end: number | null,
  order: QueryOrder,
  limit: number
): string {
  const lastItem = items[items.length - 1];

  const tokenData = {
    start: order === QueryOrder.ASC ? lastItem.timestamp : start,
    end: order === QueryOrder.DESC ? lastItem.timestamp : end,
    order,
    limit,
    lastItemId: lastItem.id
  };

  console.log(tokenData);

  return Buffer.from(JSON.stringify(tokenData)).toString('base64');
}

export function decodeNextPageToken(token: string): HistoryNextPageTokenData | null {
  if (!token) {
    return null;
  }

  return JSON.parse(Buffer.from(token, 'base64').toString());
}
