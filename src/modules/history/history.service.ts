import * as db from './history.db';
import * as cache from './history.cache';
import { HistoryNextPageTokenData, HistoryRequestParams, Message } from '@/types/history.types';
import { Logger } from 'winston';
import { PoolClient } from 'pg';
import { QueryOrder } from '@/util/pg-query';
import { getISODateStringOrNull } from '@/util/date';
import { RedisClient } from '@/lib/redis';
import { PersistedMessage } from '@/types/data.types';
import { KeyPrefix } from '@/types/state.types';
import { ParsedHttpRequest } from '@/lib/middleware';
import { AMQP_EXCHANGE_NAME, AMQP_ROUTING_KEY } from '@/lib/publisher';
import { Envelope, Publisher } from 'rabbitmq-client';

export const HISTORY_MAX_LIMIT = 100;
export const HISTORY_CACHED_MESSAGE_TTL_SECS = 60;
export const NEXT_PAGE_TOKEN_ENCODING = 'base64';

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
): Promise<Message[]> {
  logger.debug(`Getting messages by room id`, { roomId });

  try {
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

    return parseMessages(messages);
  } catch (err: unknown) {
    logger.error(`Failed to get messages by room id`, { err });
    throw err;
  }
}

export function parseMessages(messages: any[]): Message[] {
  if (!messages?.length) {
    return [];
  }

  return messages.map((message) => {
    const { id, body, user, clientId, connectionId, event, humanMessage, llmModel } = message;

    return {
      id,
      body: body.$,
      sender: {
        clientId,
        connectionId,
        user
      },
      timestamp: new Date(message.createdAt).getTime(),
      event,
      metadata: {
        humanMessage,
        llmModel
      }
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
    const timestamp = message.data.timestamp;
    const key = `${KeyPrefix.HISTORY}:buffer:${message.nspRoomId}`;

    const messageData = {
      ...message.data,
      llmInputPath: persistedMessage.llmInputPath
    };

    await cache.setCachedMessage(redisClient, key, messageData, timestamp);
  } catch (err: unknown) {
    logger.error(`Failed to cache message`, { err });
    throw err;
  }
}

export async function getCachedMessagesForRange(
  logger: Logger,
  redisClient: RedisClient,
  appPid: string,
  roomId: string,
  start: number | null = null,
  end: number | null = null,
  order: QueryOrder = QueryOrder.DESC,
  items: Message[]
): Promise<Message[]> {
  logger.debug(`Getting buffered messages`);

  try {
    const index = order === QueryOrder.DESC ? 0 : items.length - 1;
    const startFromCache = items[index]?.timestamp || start || 0;
    const endFromCache = end ?? Date.now();
    const key = `${KeyPrefix.HISTORY}:buffer:${appPid}:${roomId}`;

    const cachedMessagedForRange = await cache.getCachedMessagesForRange(
      redisClient,
      key,
      startFromCache,
      endFromCache
    );

    return cachedMessagedForRange.map((message) => JSON.parse(message.value));
  } catch (err: unknown) {
    console.log(err);
    logger.error(`Failed to get cached messages`, { err });
    throw err;
  }
}

export function getMergedItems(
  logger: Logger,
  items: Message[],
  cachedMessagesForRange: Message[],
  order: QueryOrder,
  limit: number,
  lastItemId: string | null = null
): Message[] {
  logger.debug(`Merging items`);

  if (!cachedMessagesForRange.length) {
    return items;
  }

  try {
    const itemMap = new Map<string, Message>(items.map((item) => [item.id, item]));

    const mergedItems = [...items];

    for (const cachedMessage of cachedMessagesForRange) {
      if (!itemMap.has(cachedMessage.id) && lastItemId !== cachedMessage.id) {
        if (order === QueryOrder.DESC) {
          mergedItems.unshift(cachedMessage);
        } else {
          mergedItems.push(cachedMessage);
        }
      }
    }

    return mergedItems.slice(0, limit);
  } catch (err: unknown) {
    logger.error(`Failed to merge items`, { err });
    throw err;
  }
}

export function getNextPageToken(
  logger: Logger,
  items: Message[],
  start: number | null,
  end: number | null,
  order: QueryOrder,
  limit: number
): string | null {
  logger.debug(`Getting next page token`);

  if (items.length < limit) {
    return null;
  }

  try {
    const lastItem = items[items.length - 1];

    const tokenData = {
      start: order === QueryOrder.ASC ? lastItem.timestamp : start,
      end: order === QueryOrder.DESC ? lastItem.timestamp : end,
      order,
      limit,
      lastItemId: lastItem.id
    };

    return Buffer.from(JSON.stringify(tokenData)).toString(NEXT_PAGE_TOKEN_ENCODING);
  } catch (err: unknown) {
    logger.error(`Failed to get next page token`, { err });
    throw err;
  }
}

export function decodeNextPageToken(token: string): HistoryNextPageTokenData | null {
  if (!token) {
    return null;
  }

  return JSON.parse(Buffer.from(token, NEXT_PAGE_TOKEN_ENCODING).toString());
}

export async function enqueueHistoryMessage(
  logger: Logger,
  publisher: Publisher,
  data: any
): Promise<void> {
  logger.debug(`Enqueuing message`, { data });

  try {
    const envelope: Envelope = {
      exchange: AMQP_EXCHANGE_NAME,
      routingKey: AMQP_ROUTING_KEY
    };

    const message = {
      data
    };

    await publisher.send(envelope, message);
  } catch (err: unknown) {
    logger.error(`Failed to enqueue message`, { err });
    throw err;
  }
}
