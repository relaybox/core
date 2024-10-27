import { Pool } from 'pg';
import { getLogger } from '@/util/logger';

const logger = getLogger(`pg-pool`);

const RDS_ROOT_CERTIFICATE = process.env.RDS_ROOT_CERTIFICATE || '';
const DB_PROXY_ENABLED = process.env.DB_PROXY_ENABLED === 'true';
const DB_TLS_DISABLED = process.env.DB_TLS_DISABLED === 'true';

let pgPool: Pool | null = null;

const ssl = {
  rejectUnauthorized: true,
  ...(!DB_PROXY_ENABLED && { ca: RDS_ROOT_CERTIFICATE })
};

export function getPgPool(): Pool | null {
  if (pgPool) {
    return pgPool;
  }

  logger.info('Creating pg pool', {
    host: process.env.DB_HOST,
    name: process.env.DB_NAME
  });

  pgPool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    max: Number(process.env.DB_MAX_CONNECTIONS),
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS),
    connectionTimeoutMillis: 2000,
    ...(!DB_TLS_DISABLED && { ssl })
  });

  return pgPool;
}

export async function cleanupPgPool(): Promise<void> {
  if (pgPool) {
    try {
      await pgPool.end();
    } catch (err) {
      logger.error('Error ending pg pool', { err });
    } finally {
      logger.info('Pg pool disconnected through app termination');
      pgPool = null;
    }
  }
}
