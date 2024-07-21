import {
  createClient as createRedisClient,
  RedisClientType,
  RedisModules,
  RedisFunctions,
  RedisScripts
} from 'redis';
import { getLogger } from '../util/logger';

const logger = getLogger('redis');

const REDIS_HOST = process.env.REDIS_HOST;
const REDIS_PORT = process.env.REDIS_PORT;

interface RedisOptions {
  host: string;
  port: number;
}

export type RedisClient = RedisClientType<RedisModules, RedisFunctions, RedisScripts>;

const connectionOptions: RedisOptions = {
  host: REDIS_HOST!,
  port: Number(REDIS_PORT)!
};

let redisClient: RedisClient;

function reconnectStrategy(retries: number) {
  return Math.min(retries * 50, 1000);
}

export function getRedisClient(): RedisClient {
  if (redisClient) {
    logger.info(`Reusing Redis client`);
    return redisClient;
  }

  logger.info(`Creating redis client`);

  redisClient = createRedisClient({
    socket: {
      ...connectionOptions,
      reconnectStrategy
    }
  });

  redisClient.on('connect', () => {
    logger.info('Redis connected');
  });

  redisClient.on('error', (err) => {
    logger.error(`Redis connection error: ${err.message}`);
  });

  redisClient.on('ready', () => {
    logger.info('Redis client is ready');
  });

  redisClient.on('end', () => {
    logger.info('Redis client disconnected');
  });

  redisClient.connect().catch((err) => {
    logger.error(`Failed to connect to Redis: ${err.message}`);
  });

  return redisClient;
}

process.on('SIGINT', async () => {
  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis client disconnected through app termination');
  }

  process.exit(0);
});
