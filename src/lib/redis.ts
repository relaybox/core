import {
  createClient,
  RedisClientType,
  RedisModules,
  RedisFunctions,
  RedisScripts,
  RedisClientOptions
} from 'redis';
import { getLogger } from '../util/logger';
import fs from 'fs';
import path from 'path';

const logger = getLogger('redis');

const REDIS_HOST = process.env.REDIS_HOST;
const REDIS_PORT = process.env.REDIS_PORT;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';
const REDIS_TLS_DISABLED = process.env.REDIS_TLS_DISABLED === 'true';

export type RedisClient = RedisClientType<RedisModules, RedisFunctions, RedisScripts>;

export const tlsConnectOptions = {
  tls: true,
  rejectUnauthorized: true,
  cert: fs.readFileSync(path.join(__dirname, '../certs/AmazonRootCA1.pem'))
};

export const socketOptions = {
  host: REDIS_HOST!,
  port: Number(REDIS_PORT)!,
  ...(!REDIS_TLS_DISABLED && tlsConnectOptions)
};

export const connectionOptions: RedisClientOptions = {
  ...(!REDIS_TLS_DISABLED && { password: REDIS_PASSWORD }),
  socket: {
    ...socketOptions,
    reconnectStrategy
  }
};

const tlsConnectionOptionsIo = {
  password: REDIS_PASSWORD,
  tls: tlsConnectOptions
};

export const connectionOptionsIo = {
  host: REDIS_HOST!,
  port: Number(REDIS_PORT)!,
  ...(!REDIS_TLS_DISABLED && tlsConnectionOptionsIo)
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

  redisClient = createClient(connectionOptions);

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
