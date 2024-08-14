import { RedisClient } from 'src/lib/redis';
import * as historyRepository from './history.repository';
import { getLogger } from '../../util/logger';
import { KeyPrefix } from '../../types/state.types';

const logger = getLogger('history');

const HISTORY_PARTITION_RANGE_MS = 60 * 60 * 1000;

function getKey(nspRoomId: string, timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getUTCHours();
  date.setUTCHours(hours, 0, 0, 0);

  return `${KeyPrefix.HISTORY}:messages:${nspRoomId}:${date.toISOString().slice(0, 13)}h`;
}

function parseToken(token: string) {
  const decoded = Buffer.from(token, 'base64').toString();
  return JSON.parse(decoded);
}

function generateToken(key: string, lastScore: number) {
  return Buffer.from(JSON.stringify({ key, lastScore })).toString('base64');
}

export async function addMessageToChannelHistory(
  redisClient: RedisClient,
  nspRoomid: string,
  messageData: any
): Promise<void> {
  const timestamp = Date.now();
  const key = getKey(nspRoomid, timestamp);

  logger.info(`Adding message to history`, { key, timestamp });

  try {
    await historyRepository.addMessageToChannelHistory(redisClient, key, timestamp, messageData);

    const ttl = await redisClient.ttl(key);

    if (ttl < 0) {
      await redisClient.expire(key, 24 * 60 * 60);
    }
  } catch (err) {
    logger.error(`Failed to add message to history`, { err });
    throw err;
  }
}

function getNextPageToken(messages: any[], limit: number, currentKey: string): string | null {
  if (messages.length === limit) {
    const lastMessageTimestamp = messages[messages.length - 1].timestamp;
    return generateToken(currentKey, lastMessageTimestamp as number);
  }

  return null;
}

export async function getChannelHistoryMessages(
  redisClient: RedisClient,
  nspRoomId: string,
  seconds: number,
  limit = 100,
  token?: string | null
): Promise<{ messages: any[]; nextPageToken?: string | null }> {
  logger.info(`Getting channel history messages`, { nspRoomId, seconds, limit, token });

  let messages: Record<string, unknown>[] = [],
    currentKey,
    lastScore,
    endTime = Date.now(),
    nextTime,
    startTime = endTime - seconds * 1000;

  if (token) {
    const parsedToken = parseToken(token);
    currentKey = parsedToken.key;
    lastScore = parsedToken.lastScore;
  } else {
    currentKey = getKey(nspRoomId, endTime);
  }

  while (true) {
    const currentMessages = await historyRepository.getChannelHistoryMessages(
      redisClient,
      currentKey,
      startTime,
      lastScore || endTime,
      limit - messages.length
    );

    if (currentMessages.length) {
      messages = messages.concat(currentMessages.map((message) => JSON.parse(message.value)));
      lastScore = currentMessages[currentMessages.length - 1].score;
      nextTime = lastScore - HISTORY_PARTITION_RANGE_MS;
    } else {
      nextTime = (nextTime || endTime) - HISTORY_PARTITION_RANGE_MS;
    }

    if (nextTime < startTime || messages.length >= limit) {
      break;
    }

    currentKey = getKey(nspRoomId, nextTime);
  }

  const nextPageToken = getNextPageToken(messages, limit, currentKey);

  return {
    messages,
    nextPageToken
  };
}
