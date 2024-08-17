import { RedisClient } from 'src/lib/redis';
import * as historyRepository from './history.repository';
import { getLogger } from '../../util/logger';
import { KeyPrefix } from '../../types/state.types';
import { Job } from 'bullmq';
import { defaultJobConfig, HistoryJobName, historyQueue } from './history.queue';
import { HistoryOrder, HistoryResponse } from '../../types/history.types';

const logger = getLogger('history');

export const HISTORY_PARTITION_RANGE_MS = 60 * 60 * 1000;
export const HISTORY_MAX_SECONDS = 24 * 60 * 60;
export const HISTORY_MAX_LIMIT = 100;

function getPartitionKey(nspRoomId: string, timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getUTCHours();
  date.setUTCHours(hours, 0, 0, 0);

  return `${KeyPrefix.HISTORY}:messages:${nspRoomId}:${date.toISOString().slice(0, 13)}h`;
}

function parseToken(token: string) {
  const decoded = Buffer.from(token, 'base64').toString();
  return JSON.parse(decoded);
}

function generateToken(partitionKey: string, lastScore: number) {
  return Buffer.from(JSON.stringify({ partitionKey, lastScore })).toString('base64');
}

function getNextPageToken(
  messages: any[],
  lastScore: number,
  limit: number,
  currentPartitionKey: string,
  items: number | null = null,
  order: HistoryOrder
): string | null {
  if ((items && items <= limit) || messages.length < limit) {
    return null;
  }

  const lastScoreForOrder = order === HistoryOrder.DESC ? lastScore - 1 : lastScore + 1;

  return generateToken(currentPartitionKey, lastScoreForOrder);
}

export async function addRoomHistoryMessage(
  redisClient: RedisClient,
  nspRoomId: string,
  messageData: any
): Promise<void> {
  const { timestamp } = messageData;
  const key = getPartitionKey(nspRoomId, timestamp);

  logger.info(`Adding message to history`, { key, timestamp });

  try {
    await historyRepository.addRoomHistoryMessage(redisClient, key, messageData);

    const ttl = await redisClient.ttl(key);

    if (ttl < 0) {
      await setRoomHistoryKeyTtl(nspRoomId, key);
    }
  } catch (err) {
    logger.error(`Failed to add message to history`, { err });
    throw err;
  }
}

function getNextTime(lastTime: number, order: HistoryOrder): number {
  return order === HistoryOrder.DESC
    ? lastTime - HISTORY_PARTITION_RANGE_MS
    : lastTime + HISTORY_PARTITION_RANGE_MS;
}

function nextTimeOutOfRange(
  nextTime: number,
  startTime: number,
  endTime: number,
  order: HistoryOrder
): boolean {
  console.log('nextTimeOutOfRange', nextTime, startTime, endTime, order);
  return order === HistoryOrder.DESC ? nextTime < startTime : nextTime > endTime;
}

function getPartitionRange(
  startTime: number,
  endTime: number,
  order: HistoryOrder,
  lastScore?: number
): { min: number; max: number } {
  return order === HistoryOrder.DESC
    ? { min: startTime, max: lastScore || endTime }
    : { min: endTime, max: lastScore || startTime };
}

export async function getRoomHistoryMessages(
  redisClient: RedisClient,
  nspRoomId: string,
  start: number | null = null,
  end: number | null = null,
  seconds: number = HISTORY_MAX_SECONDS,
  limit = 100,
  items: number | null = null,
  order: HistoryOrder = HistoryOrder.DESC,
  token: string | null = null
): Promise<HistoryResponse> {
  logger.info(`Getting room message history`, { nspRoomId, seconds, limit, token });

  const endTime = end || Date.now();
  const startTime = start || endTime - seconds * 1000;

  let currentPartitionKey, lastScore, nextTime;

  if (token) {
    const { partitionKey, lastScore: parsedLastScore } = parseToken(token);
    currentPartitionKey = partitionKey;
    lastScore = parsedLastScore;
  } else {
    currentPartitionKey =
      order === HistoryOrder.DESC
        ? getPartitionKey(nspRoomId, endTime)
        : getPartitionKey(nspRoomId, startTime);
  }

  const messages: Record<string, unknown>[] = [];

  try {
    while (true) {
      const resultsLimit = Math.min(items ?? limit, limit);

      const { min, max } = getPartitionRange(startTime, endTime, order, lastScore);

      const currentMessages = await historyRepository.getRoomHistoryMessages(
        redisClient,
        currentPartitionKey,
        min,
        max,
        resultsLimit - messages.length,
        order === HistoryOrder.DESC
      );

      if (currentMessages.length) {
        messages.push(...currentMessages.map((message) => JSON.parse(message.value)));
        lastScore = currentMessages[currentMessages.length - 1].score;
        nextTime = getNextTime(lastScore, order);
      } else {
        nextTime = getNextTime(nextTime || endTime, order);
      }

      if (nextTimeOutOfRange(nextTime, startTime, endTime, order) || messages.length >= limit) {
        console.log('break');
        break;
      }

      currentPartitionKey = getPartitionKey(nspRoomId, nextTime);
    }

    const nextPageToken = getNextPageToken(
      messages,
      lastScore,
      limit,
      currentPartitionKey,
      items,
      order
    );

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
