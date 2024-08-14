import { RedisClient } from 'src/lib/redis';
import * as historyRepository from './history.repository';
import { getLogger } from '../../util/logger';
import { KeyPrefix } from '../../types/state.types';

const logger = getLogger('history');

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

export async function getChannelHistoryMessages(
  redisClient: RedisClient,
  nspRoomId: string,
  seconds: number,
  limit = 100,
  token?: string | null
): Promise<{ messages: any[]; nextPageToken?: string | null }> {
  logger.info(`Getting channel history messages`, { nspRoomId, seconds, limit, token });

  let messages: Record<string, unknown>[] = [];
  let currentKey;
  let lastScore;
  let endTime = Date.now();
  let nextTime;
  let startTime = endTime - seconds * 1000;

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
      limit
    );

    if (currentMessages.length) {
      console.log(currentMessages);
      messages = messages.concat(currentMessages.map((message) => JSON.parse(message.value)));
      lastScore = currentMessages[currentMessages.length - 1].score;
      endTime = lastScore;
      nextTime = lastScore - 60 * 60 * 1000;
    } else {
      nextTime = (nextTime || endTime) - 60 * 60 * 1000;
    }

    if (nextTime < startTime || messages.length >= limit) {
      console.log('break');
      break;
    }

    currentKey = getKey(nspRoomId, nextTime);

    console.log({ currentKey, lastScore, startTime, endTime, limit });
  }

  let nextPageToken = null;

  if (messages.length === limit) {
    const lastMessageTimestamp = messages[messages.length - 1].timestamp;
    nextPageToken = generateToken(currentKey, lastMessageTimestamp as number);
  }

  return { messages, nextPageToken };
}

// export async function getChannelHistoryMessages(
//   redisClient: RedisClient,
//   nspRoomId: string,
//   seconds: number,
//   limit = 100,
//   token?: string | null
// ): Promise<{ messages: any[]; nextPageToken: string | null }> {
//   logger.info(`Getting channel history messages`, { nspRoomId, seconds, limit, token });

//   let messages: Record<string, unknown>[] = [];
//   let currentKey;
//   let lastScore;
//   let endTime = Date.now();
//   let startTime = endTime - seconds * 1000;

//   if (token) {
//     const parsedToken = parseToken(token);
//     currentKey = parsedToken.key;
//     lastScore = parsedToken.lastScore;
//   } else {
//     currentKey = getKey(nspRoomId, startTime);
//     lastScore = startTime;
//   }

//   console.log(currentKey, lastScore, startTime, endTime, limit);

//   try {
//     let currentMessages = await historyRepository.getChannelHistoryMessages(
//       redisClient,
//       currentKey,
//       lastScore,
//       endTime,
//       limit
//     );

//     messages = messages.concat(currentMessages.map((message) => JSON.parse(message)));

//     while (messages.length < limit && startTime < lastScore) {
//       endTime = startTime;
//       startTime -= 60 * 60 * 1000;
//       currentKey = getKey(nspRoomId, startTime);
//       lastScore = startTime;

//       console.log(currentKey, lastScore, startTime, endTime, limit);

//       if (await redisClient.exists(currentKey)) {
//         currentMessages = await historyRepository.getChannelHistoryMessages(
//           redisClient,
//           currentKey,
//           lastScore,
//           endTime,
//           limit - messages.length
//         );

//         messages = messages.concat(currentMessages.map((message) => JSON.parse(message)));
//       }
//     }

//     let nextPageToken = null;

//     if (messages.length === limit) {
//       const lastMessageTimestamp = messages[messages.length - 1].timestamp;
//       nextPageToken = generateToken(currentKey, lastMessageTimestamp as number);
//     }

//     return { messages, nextPageToken };
//   } catch (err) {
//     console.log(err);
//     logger.error(`Failed to get channel history messages`, { err });
//     throw err;
//   }
// }
