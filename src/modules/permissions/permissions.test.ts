import { describe, it, expect } from 'vitest';
import { DsPermission, DsPermissions } from 'src/types/permissions.types';
import { permissionsGuard } from '../guards/guards.service';

describe('permissionsGuard', () => {
  describe('success', () => {
    it('returns true if global permissions include the specific requested permission', () => {
      const permissions = ['subscribe'];

      expect(permissionsGuard('room1', DsPermission.SUBSCRIBE, permissions)).toBe(true);
    });

    it('returns true if global permissions include a wildcard allowing all permissions', () => {
      const permissions = ['*'];

      expect(permissionsGuard('room1', DsPermission.SUBSCRIBE, permissions)).toBe(true);
    });

    it('returns true if room-specific permissions include the requested permission', () => {
      const permissions: DsPermissions = {
        room1: ['subscribe', 'publish']
      };

      expect(permissionsGuard('room1', DsPermission.PUBLISH, permissions)).toBe(true);
      expect(permissionsGuard('room1', DsPermission.SUBSCRIBE, permissions)).toBe(true);
    });

    it('returns true if room-specific permissions include a wildcard allowing all permissions', () => {
      const permissions: DsPermissions = {
        room1: ['*']
      };

      expect(permissionsGuard('room1', DsPermission.SUBSCRIBE, permissions)).toBe(true);
    });

    it('returns true if global permissions include room-level wildcard permissions', () => {
      const permissions: DsPermissions = {
        '*': ['subscribe']
      };

      expect(permissionsGuard('room1', DsPermission.SUBSCRIBE, permissions)).toBe(true);
      expect(permissionsGuard('room2', DsPermission.SUBSCRIBE, permissions)).toBe(true);
    });

    it('returns true if room-specific wildcard permissions include the requested permission', () => {
      const permissions: DsPermissions = {
        'room1:*': ['subscribe', 'publish']
      };

      expect(permissionsGuard('room1', DsPermission.PUBLISH, permissions)).toBe(true);
    });

    it('returns true if nested room-specific wildcard permissions include the requested permission', () => {
      const permissions: DsPermissions = {
        'room1:*': ['subscribe', 'publish']
      };

      expect(permissionsGuard('room1:one', DsPermission.PUBLISH, permissions)).toBe(true);
      expect(permissionsGuard('room1:one:user:123', DsPermission.PUBLISH, permissions)).toBe(true);
    });

    it('returns true if complex room-specific wildcard permissions include the requested permission', () => {
      const permissions: DsPermissions = {
        'room1:*:user': ['subscribe', 'publish']
      };

      expect(permissionsGuard('room1:one:user', DsPermission.PUBLISH, permissions)).toBe(true);
    });

    it('returns true if deeply nested complex room-specific wildcard permissions include the requested permission', () => {
      const permissions: DsPermissions = {
        'room1:*:user:*': ['subscribe', 'publish'],
        'room2:*:*:admin': ['subscribe', 'publish']
      };

      expect(permissionsGuard('room1:one:user:123', DsPermission.PUBLISH, permissions)).toBe(true);
      expect(permissionsGuard('room2:one:user:admin', DsPermission.PUBLISH, permissions)).toBe(
        true
      );
    });

    it('should prioritize explict room matches over wildcard values', () => {
      const permissions: DsPermissions = {
        'room1:one:test': ['subscribe'],
        'room1:*:test': ['presence']
      };

      expect(permissionsGuard('room1:one:test', DsPermission.SUBSCRIBE, permissions)).toBe(true);
    });
  });

  describe('error', () => {
    it('throws an error if the wildcard pattern does not match the queried room structure', () => {
      const permissions: DsPermissions = {
        'room1:*:user': ['subscribe', 'publish']
      };

      expect(() =>
        permissionsGuard('room1:one:two:user', DsPermission.PUBLISH, permissions)
      ).toThrow(/not permitted/);
    });

    it('throws an error if the wildcard pattern does not match the queried room structure', () => {
      const permissions: DsPermissions = {
        'room1:*:user': ['subscribe', 'publish']
      };

      expect(() =>
        permissionsGuard('room1:one:user:123', DsPermission.PUBLISH, permissions)
      ).toThrow(/not permitted/);
    });

    it('throws an error if the wildcard pattern does not match the queried room structure', () => {
      const permissions: DsPermissions = {
        'room1:*:user': ['subscribe', 'publish']
      };

      expect(() => permissionsGuard('room1:one:admin', DsPermission.PUBLISH, permissions)).toThrow(
        /not permitted/
      );
    });

    it('throws an error if the client is not permitted to perform the action in the specified room', () => {
      const permissions: DsPermissions = {
        room1: ['subscribe']
      };

      expect(() => permissionsGuard('room1', DsPermission.PUBLISH, permissions)).toThrow(
        /not permitted/
      );
    });

    it('throws an error if the client is not permitted to perform the action even when global wildcard partially matches', () => {
      const permissions: DsPermissions = {
        '*': ['subscribe', 'publish'],
        room2: ['subscribe']
      };

      expect(() => permissionsGuard('room2', DsPermission.PUBLISH, permissions)).toThrow(
        /not permitted/
      );
    });

    it('throws an error if the client is not permitted to perform the action despite global wildcard matching other permissions', () => {
      const permissions: DsPermissions = {
        '*': ['subscribe', 'publish']
      };

      expect(() => permissionsGuard('room1', DsPermission.PRESENCE, permissions)).toThrow(
        /not permitted/
      );
    });

    it('throws an error if the client is not permitted to perform the action despite room-specific wildcard permissions', () => {
      const permissions: DsPermissions = {
        room1: ['*']
      };

      expect(() => permissionsGuard('room2', DsPermission.PRESENCE, permissions)).toThrow(
        /not permitted/
      );
    });

    it('should prioritize explict room matches over wildcard values', () => {
      const permissions: DsPermissions = {
        'room1:one:test': ['subscribe'],
        'room1:*:test': ['presence']
      };

      expect(() => permissionsGuard('room1:one:test', DsPermission.PRESENCE, permissions)).toThrow(
        /not permitted/
      );
    });
  });
});
