import { ForbiddenError } from '@/lib/errors';
import { DsPermission, DsPermissions } from '@/types/permissions.types';
import { PoolClient } from 'pg';
import { Logger } from 'winston';
import * as db from './permissions.db';

export function matchRoomPermissions(roomId: string, permissions: DsPermissions): string[] {
  if (Array.isArray(permissions)) {
    return permissions;
  }

  return permissions[roomId] || findWildcardMatch(roomId, permissions) || permissions['*'];
}

export function findWildcardMatch(
  roomId: string,
  permissions: DsPermissions
): string[] | undefined {
  const roomParts = roomId.split(':');

  for (const key of Object.keys(permissions)) {
    let matches = true;

    const keyParts = key.split(':');

    for (let i = 0; i < roomParts.length; i++) {
      // If keyParts[i] is undefined (e.g., fewer parts in the key), fall back to the last part.
      // Eg. `room:*` must match `room:one` and `room:one:two`
      const keyPart = keyParts[i] ?? keyParts[keyParts.length - 1];

      // If `keyPart` doesn't match `roomParts[i]` or its not a wildcard
      // Break and fail
      if (keyPart !== '*' && keyPart !== roomParts[i]) {
        matches = false;
        break;
      }
    }

    // Only return if the match is valid and doesn't overreach
    if (matches && keyParts.length <= roomParts.length) {
      return permissions[key];
    }
  }

  return undefined;
}

export function hasPermission(
  permissions: string[] = [],
  requiredPermission: DsPermission | string[]
): boolean {
  for (const permission of permissions) {
    if (permission === '*' || permission === requiredPermission) {
      return true;
    }
  }

  return false;
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
