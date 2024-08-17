import { RedisClient } from 'src/lib/redis';
import * as historyRepository from './history.repository';
import { getLogger } from '../../util/logger';
import { KeyPrefix } from '../../types/state.types';
import { Job } from 'bullmq';
import { defaultJobConfig, HistoryJobName, historyQueue } from './history.queue';
import { HistoryOrder } from '../../types/history.types';

const logger = getLogger('history');

export const HISTORY_PARTITION_RANGE_MS = 60 * 60 * 1000;
export const HISTORY_MAX_SECONDS = 24 * 60 * 60;
export const HISTORY_MAX_LIMIT = 100;

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

function getNextPageToken(
  messages: any[],
  lastScore: number,
  limit: number,
  currentKey: string,
  items: number | null = null
): string | null {
  if ((items && items <= limit) || messages.length < limit) {
    return null;
  }

  return generateToken(currentKey, lastScore - 1);
}

export async function addMessageToRoomHistory(
  redisClient: RedisClient,
  nspRoomId: string,
  messageData: any
): Promise<void> {
  const { timestamp } = messageData;
  const key = getKey(nspRoomId, timestamp);

  logger.info(`Adding message to history`, { key, timestamp });

  try {
    await historyRepository.addMessageToRoomHistory(redisClient, key, messageData);

    const ttl = await redisClient.ttl(key);

    if (ttl < 0) {
      await setRoomHistoryKeyTtl(nspRoomId, key);
    }
  } catch (err) {
    logger.error(`Failed to add message to history`, { err });
    throw err;
  }
}

function getNextTime(lastTime: number, order: string): number {
  return lastTime - HISTORY_PARTITION_RANGE_MS;
}

export async function getRoomHistoryMessages(
  redisClient: RedisClient,
  nspRoomId: string,
  start: number | null = null,
  end: number | null = null,
  seconds: number = HISTORY_MAX_SECONDS,
  limit = 100,
  items: number | null = null,
  order: string = HistoryOrder.DESC,
  token: string | null = null
): Promise<{ messages: any[]; nextPageToken?: string | null; itemsRemaining?: number }> {
  logger.info(`Getting Room history messages`, { nspRoomId, seconds, limit, token });

  const endTime = end || Date.now();
  const startTime = start || endTime - seconds * 1000;

  let currentKey, lastScore, nextTime;

  if (token) {
    const { key, lastScore: parsedLastScore } = parseToken(token);
    currentKey = key;
    lastScore = parsedLastScore;
  } else {
    currentKey = getKey(nspRoomId, endTime);
  }

  const messages: Record<string, unknown>[] = [];

  try {
    while (true) {
      const resultsLimit = Math.min(items ?? limit, limit);

      const currentMessages = await historyRepository.getRoomHistoryMessages(
        redisClient,
        currentKey,
        startTime,
        lastScore || endTime,
        resultsLimit - messages.length
      );

      if (currentMessages.length) {
        messages.push(...currentMessages.map((message) => JSON.parse(message.value)));
        lastScore = currentMessages[currentMessages.length - 1].score;
        nextTime = getNextTime(lastScore, order);
      } else {
        nextTime = getNextTime(nextTime || endTime, order);
      }

      if (nextTime < startTime || messages.length >= limit) {
        break;
      }

      currentKey = getKey(nspRoomId, nextTime);
    }

    const nextPageToken = getNextPageToken(messages, lastScore, limit, currentKey, items);

    return {
      messages,
      nextPageToken,
      ...(items && { itemsRemaining: items - messages.length })
    };
  } catch (err) {
    logger.error(`Failed to get room history messages`, { err });
    throw err;
  }
}

export function setRoomHistoryKeyTtl(nspRoomId: string, key: string): Promise<Job> | void {
  logger.info('Adding history ttl job to history queue', { nspRoomId, key });

  try {
    const jobData = {
      nspRoomId,
      key
    };

    const jobConfig = {
      jobId: key,
      ...defaultJobConfig
    };

    return historyQueue.add(HistoryJobName.HISTORY_TTL, jobData, jobConfig);
  } catch (err) {
    logger.error(`Failed to add history ttl job to history queue`, { err });
  }
}
