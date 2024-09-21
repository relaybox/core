import { DsPermission, DsPermissions } from '../../types/permissions.types';
import { matchRoomPermissions } from '../permissions/permissions.service';
import { Session } from '../../types/session.types';
import { RedisClient } from 'src/lib/redis';
import { isActiveMember } from '../presence/presence.service';
import { getRoomByConnectionId } from '../room/room.service';

export function authenticatedSessionGuard(session: Session): boolean {
  if (!session.clientId) {
    throw new Error(`No client id provided`);
  }

  return true;
}

export async function activeMemberGuard(
  redisClient: RedisClient,
  uid: string,
  nspRoomId: string
): Promise<boolean> {
  const activeMember = await isActiveMember(redisClient, uid, nspRoomId);

  if (!activeMember) {
    throw new Error(`Client not member of presence set for ${nspRoomId}`);
  }

  return true;
}

export function permissionsGuard(
  roomId: string,
  permission: DsPermission,
  permissions: DsPermissions | string[]
): boolean {
  if (Array.isArray(permissions)) {
    if (permissions.includes(permission) || permissions.includes('*')) {
      return true;
    }
  } else {
    const roomPermissions = matchRoomPermissions(roomId, permissions);

    if (
      roomPermissions &&
      (roomPermissions.includes('*') || roomPermissions.includes(permission))
    ) {
      return true;
    }
  }

  throw new Error(`Client not permitted to perform "${permission}" in "${roomId}"`);
}

export async function roomMemberGuard(
  redisClient: RedisClient,
  connectionId: string,
  nspRoomId: string
): Promise<boolean> {
  const roomJoinedTimestamp = await getRoomByConnectionId(redisClient, connectionId, nspRoomId);

  if (!roomJoinedTimestamp) {
    throw new Error(`Client not active in room`);
  }

  return true;
}
