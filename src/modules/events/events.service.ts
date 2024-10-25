import { createHmac } from 'crypto';
import { PoolClient } from 'pg';
import { Logger } from 'winston';
import { DsPermissions } from '@/types/permissions.types';
import { LatencyLog } from '@/types/request.types';
import { KeyPrefix } from '@/types/state.types';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import * as db from './events.db';

const SIGNATURE_HASHING_ALGORITHM = 'sha256';
const SIGNATURE_BUFFER_ENCODING = 'utf-8';
const SIGNATURE_DIGEST = 'hex';

export async function verifySignature(
  providedPayload: any,
  providedSignature: string,
  secretKey: string
): Promise<boolean> {
  const buffer = Buffer.from(providedPayload, SIGNATURE_BUFFER_ENCODING);
  const computedSignature = createHmac(SIGNATURE_HASHING_ALGORITHM, secretKey)
    .update(buffer)
    .digest(SIGNATURE_DIGEST);

  if (providedSignature !== computedSignature) {
    throw new UnauthorizedError('Unable to verify signature');
  }

  return true;
}

export function verifyTimestamp(timestamp: number, diffInSeconds: number): number {
  const now = Date.now();

  if (now - timestamp > diffInSeconds * 1000) {
    throw new UnauthorizedError('Unable to verify timestamp');
  }

  return timestamp;
}

export async function getSecretKey(
  logger: Logger,
  pgClient: PoolClient,
  appPid: string,
  keyId: string
): Promise<string> {
  logger.debug(`Getting secret key for key id ${keyId}`);

  const { rows } = await db.getSecretKeybyKeyId(pgClient, appPid, keyId);

  if (!rows.length) {
    throw new UnauthorizedError('Secret key not found');
  }

  const secretKey = rows[0].secretKey;

  return secretKey;
}

export async function getPermissions(
  logger: Logger,
  pgClient: PoolClient,
  keyId: string
): Promise<DsPermissions | string[]> {
  logger.debug(`Getting permissions for key id ${keyId}`);

  const { rows } = await db.getPermissionsByKeyId(pgClient, keyId);

  if (!rows.length) {
    throw new ForbiddenError(`Permissions for key ${keyId} not found`);
  }

  return formatPermissions(rows);
}

export function formatPermissions(
  rows: { pattern: string; permission: string }[]
): DsPermissions | string[] {
  if (rows[0].pattern === null) {
    return rows.map((row) => row.permission);
  }

  const response = {} as Record<string, string[]>;

  for (const row of rows) {
    if (!response[row.pattern]) {
      response[row.pattern] = [];
    }

    response[row.pattern].push(row.permission);
  }

  return response;
}

export function getLatencyLog(createdAt: number): LatencyLog {
  const receivedAt = new Date().toISOString();

  return {
    createdAt: new Date(createdAt).toISOString(),
    receivedAt
  };
}

export function getRoomHistoryKey(nspRoomId: string, timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getUTCHours();

  date.setUTCHours(hours, 0, 0, 0);

  return `${KeyPrefix.HISTORY}:messages:${nspRoomId}:${date.toISOString().slice(0, 13)}h`;
}

export function getMessageData(systemEvent: any): any {
  const { data: body, timestamp, event, requestId } = systemEvent;

  const sender = {
    requestId
  };

  return {
    body,
    sender,
    timestamp,
    event
  };
}

export async function getUserByClientId(
  logger: Logger,
  pgClient: PoolClient,
  clientId: string
): Promise<any> {
  logger.debug(`Getting user by client id ${clientId}`);

  const { rows } = await db.getUserByClientId(pgClient, clientId);

  if (!rows.length) {
    return null;
  }

  return rows[0];
}
