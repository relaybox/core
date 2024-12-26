import { mockQueue } from '../__mocks__/external/bullmq';
import { Session } from '@/types/session.types';
import { getLogger } from '@/util/logger';
import { WebSocket } from 'uWebSockets.js';
import { describe, expect, vi, it, beforeEach, afterEach } from 'vitest';
import { getMockSession } from 'test/__mocks__/internal/session.mock';
import {
  getCachedRooms,
  joinRoom,
  leaveRoom,
  restoreCachedRooms,
  validateRoomAccess,
  validateRoomCreatePermissions,
  validateRoomId
} from '@/modules/room/room.service';
import { RedisClient } from '@/lib/redis';
import { KeyNamespace } from '@/types/state.types';
import { Room, RoomMemberType, RoomVisibility } from '@/types/room.types';
import { getMockRoom } from 'test/__mocks__/internal/room.mock';
import { ForbiddenError } from '@/lib/errors';

const logger = getLogger('');

const mockRoomRepository = vi.hoisted(() => ({
  setRoomJoin: vi.fn(),
  setRoomLeave: vi.fn(),
  getCachedRooms: vi.fn()
}));

vi.mock('@/modules/room/room.cache', () => mockRoomRepository);

const mockSubscriptionService = vi.hoisted(() => ({
  restoreRoomSubscriptions: vi.fn()
}));

vi.mock('@/modules/subscription/subscription.service', () => mockSubscriptionService);

describe('room.service', async () => {
  let redisClient: RedisClient;
  let socket: WebSocket<Session>;
  let session: Session;

  beforeEach(() => {
    redisClient = {} as RedisClient;
    socket = {
      subscribe: vi.fn(),
      unsubscribe: vi.fn()
    } as unknown as WebSocket<Session>;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('joinRoom', () => {
    beforeEach(() => {
      session = getMockSession({ connectionId: '12345' });
    });

    it('should add a connection to cached rooms when a join event is received', async () => {
      const connectionId = '12345';
      const nspRoomId = 'room1';

      await joinRoom(logger, redisClient, session, nspRoomId, socket);

      expect(mockRoomRepository.setRoomJoin).toHaveBeenCalledWith(
        redisClient,
        connectionId,
        nspRoomId
      );
      expect(socket.subscribe).toHaveBeenCalledWith(nspRoomId);
    });

    it('should throw an error if adding a connection to cached rooms fails', async () => {
      mockRoomRepository.setRoomJoin.mockRejectedValueOnce(new Error('Failed to add room'));

      await expect(joinRoom(logger, redisClient, session, 'room1', socket)).rejects.toThrow(
        'Failed to add room'
      );
    });
  });

  describe('leaveRoom', () => {
    beforeEach(() => {
      session = getMockSession({ connectionId: '12345' });
    });

    it('should remove a connection from cached rooms when a leave event is received', async () => {
      const connectionId = '12345';
      const nspRoomId = 'room1';

      await leaveRoom(logger, redisClient, session, nspRoomId, socket);

      expect(mockRoomRepository.setRoomLeave).toHaveBeenCalledWith(
        redisClient,
        connectionId,
        nspRoomId
      );
      expect(socket.unsubscribe).toHaveBeenCalledWith(nspRoomId);
    });

    it('should throw an error if removing a connection from cached rooms fails', async () => {
      mockRoomRepository.setRoomLeave.mockRejectedValueOnce(new Error('Failed to add room'));

      await expect(leaveRoom(logger, redisClient, session, 'room1', socket)).rejects.toThrow(
        'Failed to add room'
      );
    });
  });

  describe('getCachedRooms', () => {
    const connectionId = '12345';

    beforeEach(() => {
      beforeEach(() => {
        session = getMockSession({ connectionId });
      });
    });

    it("should return an array of cached room id's by connection id", async () => {
      mockRoomRepository.getCachedRooms.mockResolvedValueOnce({
        room1: '2024-09-21T08:00:00.000',
        room2: '2024-09-21T08:00:00.000'
      });

      const cachedRooms = await getCachedRooms(logger, redisClient, connectionId);

      expect(mockRoomRepository.getCachedRooms).toHaveBeenCalledWith(redisClient, connectionId);
      expect(cachedRooms).toEqual(['room1', 'room2']);
    });

    it('should throw an error if retreiving cached rooms by connection id fails', async () => {
      mockRoomRepository.getCachedRooms.mockRejectedValueOnce(new Error('Failed to add room'));

      await expect(getCachedRooms(logger, redisClient, connectionId)).rejects.toThrow(
        'Failed to add room'
      );
    });
  });

  describe('restoreCachedRooms', () => {
    beforeEach(() => {
      session = getMockSession({ connectionId: '12345' });
    });

    it('should retrieve cached rooms, join and bind subscriptions', async () => {
      mockRoomRepository.getCachedRooms.mockResolvedValueOnce({
        room1: '2024-09-21T08:00:00.000',
        room2: '2024-09-21T08:00:00.000'
      });

      await restoreCachedRooms(logger, redisClient, session, socket);

      expect(mockSubscriptionService.restoreRoomSubscriptions).toHaveBeenCalledWith(
        logger,
        redisClient,
        session.connectionId,
        'room1',
        KeyNamespace.SUBSCRIPTIONS,
        socket
      );

      expect(mockSubscriptionService.restoreRoomSubscriptions).toHaveBeenCalledWith(
        logger,
        redisClient,
        session.connectionId,
        'room1',
        KeyNamespace.PRESENCE,
        socket
      );

      expect(mockSubscriptionService.restoreRoomSubscriptions).toHaveBeenCalledWith(
        logger,
        redisClient,
        session.connectionId,
        'room1',
        KeyNamespace.METRICS,
        socket
      );

      expect(mockSubscriptionService.restoreRoomSubscriptions).toHaveBeenCalledWith(
        logger,
        redisClient,
        session.connectionId,
        'room1',
        KeyNamespace.INTELLECT,
        socket
      );

      expect(mockSubscriptionService.restoreRoomSubscriptions).toHaveBeenCalledTimes(8);
      expect(mockRoomRepository.setRoomJoin).toHaveBeenCalledTimes(2);
      expect(socket.subscribe).toHaveBeenCalledTimes(2);
    });
  });

  describe('validateRoomAccess', () => {
    it('should allow client access to a public room', () => {
      const mockSession = getMockSession();

      const mockRoom = getMockRoom({
        visibility: RoomVisibility.PUBLIC
      });

      expect(validateRoomAccess(logger, mockRoom, mockSession)).toBe(true);
    });

    it('should allow client access to a private room', () => {
      const mockSession = getMockSession({
        // @ts-ignore
        permissions: ['privacy']
      });

      const mockRoom = getMockRoom({
        visibility: RoomVisibility.PRIVATE,
        memberCreatedAt: new Date().toISOString()
      });

      expect(validateRoomAccess(logger, mockRoom, mockSession)).toBe(true);
    });

    it('should deny client access to a private room if the client is not a member', () => {
      const mockSession = getMockSession({
        // @ts-ignore
        permissions: ['privacy']
      });

      const mockRoom = getMockRoom({
        visibility: RoomVisibility.PRIVATE,
        memberCreatedAt: undefined
      });

      expect(() => validateRoomAccess(logger, mockRoom, mockSession)).toThrow(ForbiddenError);
    });

    it('should deny client access to a private room if the client does not have this required "privacy" permission', () => {
      const mockSession = getMockSession();

      const mockRoom = getMockRoom({
        visibility: RoomVisibility.PRIVATE
      });

      expect(() => validateRoomAccess(logger, mockRoom, mockSession)).toThrow(ForbiddenError);
    });
  });

  describe('validateRoomCreatePermissions', () => {
    const requiredPermission = 'privacy';
    const irrelevantPermission = 'subscribe';

    it('should allow client to create a public room', () => {
      const mockSession = getMockSession({
        // @ts-ignore
        permissions: [irrelevantPermission]
      });

      expect(
        validateRoomCreatePermissions(logger, 'testRoom', RoomVisibility.PUBLIC, mockSession)
      ).toBe(true);
    });

    it('should allow client to create a private room', () => {
      const mockSession = getMockSession({
        // @ts-ignore
        permissions: [requiredPermission]
      });

      expect(
        validateRoomCreatePermissions(logger, 'testRoom', RoomVisibility.PRIVATE, mockSession)
      ).toBe(true);
    });

    it('should deny client to create a private room when reuired permission is missing', () => {
      const mockSession = getMockSession({
        // @ts-ignore
        permissions: [irrelevantPermission]
      });

      expect(() =>
        validateRoomCreatePermissions(logger, 'testRoom', RoomVisibility.PRIVATE, mockSession)
      ).toThrow(ForbiddenError);
    });
  });

  describe('validateRoomId', () => {
    it('should throw an error if room id is invalid', () => {
      const invalidRoomId1 = '1*2';
      expect(() => validateRoomId(invalidRoomId1)).toThrow(Error);

      const invalidRoomId2 = '1&2';
      expect(() => validateRoomId(invalidRoomId2)).toThrow(Error);

      const invalidRoomId3 = '1 2';
      expect(() => validateRoomId(invalidRoomId3)).toThrow(Error);
    });
  });
});
