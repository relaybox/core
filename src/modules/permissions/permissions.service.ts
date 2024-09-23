import { DsPermission, DsPermissions } from '@/types/permissions.types';

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
    const keyParts = key.split(':');
    let matches = true;

    for (let i = 0; i < roomParts.length; i++) {
      const keyPart = keyParts[i] || keyParts[keyParts.length - 1];

      if (keyPart !== '*' && keyPart !== roomParts[i]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return permissions[key];
    }
  }

  return undefined;
}

export function hasPermission(
  permissions: string[],
  requiredPermission: DsPermission | string[]
): boolean {
  for (const permission of permissions) {
    if (permission === '*' || permission === requiredPermission) {
      return true;
    }
  }

  return false;
}
