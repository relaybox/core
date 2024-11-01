import {
  createClient,
  RedisClientType,
  RedisModules,
  RedisFunctions,
  RedisScripts,
  RedisClientOptions
} from 'redis';
import { getLogger } from '@/util/logger';
import fs from 'fs';
import path from 'path';
import { addAndCleanup, setKeyExpiry } from '@/scripts/redis';

const logger = getLogger('redis');

const REDIS_HOST = process.env.REDIS_HOST;
const REDIS_PORT = process.env.REDIS_PORT;
const REDIS_AUTH = process.env.REDIS_AUTH;
const REDIS_TLS_DISABLED = process.env.REDIS_TLS_DISABLED === 'true';
const REDIS_AUTH_TOKEN = getRedisAuthToken();

export type RedisClient = RedisClientType<RedisModules, RedisFunctions, RedisScripts>;

function getCeritificate(): Buffer | undefined {
  try {
    return fs.readFileSync(path.join(__dirname, 'certs/AmazonRootCA1.pem'));
  } catch (err) {
    logger.error(`Failed to read certificate file: ${err}`);
  }
}

// Node redis client options
export const tlsConnectionOptions = {
  tls: true,
  rejectUnauthorized: true,
  cert: getCeritificate()
};

export const socketOptions = {
  host: REDIS_HOST!,
  port: Number(REDIS_PORT)!,
  ...(!REDIS_TLS_DISABLED && tlsConnectionOptions)
};

export const connectionOptions: RedisClientOptions = {
  ...(!REDIS_TLS_DISABLED && { password: REDIS_AUTH_TOKEN }),
  socket: {
    ...socketOptions,
    reconnectStrategy
  }
  // scripts: {
  //   addAndCleanup,
  //   setKeyExpiry
  // }
};

// IO redis client options (BullMQ)
const tlsConnectionOptionsIo = {
  password: REDIS_AUTH_TOKEN,
  tls: tlsConnectionOptions
};

export const connectionOptionsIo = {
  host: REDIS_HOST!,
  port: Number(REDIS_PORT)!,
  ...(!REDIS_TLS_DISABLED && tlsConnectionOptionsIo)
};

let redisClient: RedisClient | null = null;

function getRedisAuthToken(): string {
  if (!REDIS_AUTH) {
    logger.warn('Redis auth token for TLS connection not defined');
    return '';
  }

  return JSON.parse(REDIS_AUTH).authToken;
}

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

export async function cleanupRedisClient() {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch (err) {
      logger.error('Error ending Redis client', { err });
    } finally {
      logger.info('Redis client disconnected through app termination');
      redisClient = null;
    }
  }
}
