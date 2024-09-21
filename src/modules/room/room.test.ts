import { Session } from 'src/types/session.types';
import { getLogger } from 'src/util/logger';
import { WebSocket } from 'uWebSockets.js';
import { describe, expect, vi, it, beforeEach, afterEach } from 'vitest';
import { getMockSession } from '../session/session.mock';
import { getCachedRooms, joinRoom, leaveRoom, restoreCachedRooms } from './room.service';
import { RedisClient } from 'src/lib/redis';
import { KeyNamespace } from 'src/types/state.types';

const logger = getLogger('');

const { mockSetRoomJoin, mockSetRoomLeave, mockGetCachedRooms } = vi.hoisted(() => {
  return {
    mockSetRoomJoin: vi.fn(),
    mockSetRoomLeave: vi.fn(),
    mockGetCachedRooms: vi.fn()
  };
});

vi.mock('./room.repository', () => ({
  setRoomJoin: mockSetRoomJoin,
  setRoomLeave: mockSetRoomLeave,
  getCachedRooms: mockGetCachedRooms
}));

const { mockRestoreRoomSubscriptions } = vi.hoisted(() => {
  return {
    mockRestoreRoomSubscriptions: vi.fn()
  };
});

vi.mock('./../subscription/subscription.service', () => ({
  restoreRoomSubscriptions: mockRestoreRoomSubscriptions
}));

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

  describe('joinRoom', async () => {
    beforeEach(() => {
      session = getMockSession({ connectionId: '12345' });
    });

    it('should add a connection to cached rooms when a join event is received', async () => {
      const connectionId = '12345';
      const nspRoomId = 'room1';

      await joinRoom(redisClient, session, nspRoomId, socket);

      expect(mockSetRoomJoin).toHaveBeenCalledWith(redisClient, connectionId, nspRoomId);
      expect(socket.subscribe).toHaveBeenCalledWith(nspRoomId);
    });

    it('should throw an error if adding a connection to cached rooms fails', async () => {
      mockSetRoomJoin.mockRejectedValueOnce(new Error('Failed to add room'));

      await expect(joinRoom(redisClient, session, 'room1', socket)).rejects.toThrow(
        'Failed to add room'
      );
    });
  });

  describe('leaveRoom', async () => {
    beforeEach(() => {
      session = getMockSession({ connectionId: '12345' });
    });

    it('should remove a connection from cached rooms when a leave event is received', async () => {
      const connectionId = '12345';
      const nspRoomId = 'room1';

      await leaveRoom(redisClient, session, nspRoomId, socket);

      expect(mockSetRoomLeave).toHaveBeenCalledWith(redisClient, connectionId, nspRoomId);
      expect(socket.unsubscribe).toHaveBeenCalledWith(nspRoomId);
    });

    it('should throw an error if removing a connection from cached rooms fails', async () => {
      mockSetRoomLeave.mockRejectedValueOnce(new Error('Failed to add room'));

      await expect(leaveRoom(redisClient, session, 'room1', socket)).rejects.toThrow(
        'Failed to add room'
      );
    });
  });

  describe('getCachedRooms', async () => {
    const connectionId = '12345';

    beforeEach(() => {
      beforeEach(() => {
        session = getMockSession({ connectionId });
      });
    });

    it("should return an array of cached room id's by connection id", async () => {
      mockGetCachedRooms.mockResolvedValueOnce({
        room1: '2024-09-21T08:00:00.000',
        room2: '2024-09-21T08:00:00.000'
      });

      const cachedRooms = await getCachedRooms(logger, redisClient, connectionId);

      expect(mockGetCachedRooms).toHaveBeenCalledWith(redisClient, connectionId);
      expect(cachedRooms).toEqual(['room1', 'room2']);
    });

    it('should throw an error if retreiving cached rooms by connection id fails', async () => {
      mockGetCachedRooms.mockRejectedValueOnce(new Error('Failed to add room'));

      await expect(getCachedRooms(logger, redisClient, connectionId)).rejects.toThrow(
        'Failed to add room'
      );
    });
  });

  describe('restoreCachedRooms', async () => {
    beforeEach(() => {
      session = getMockSession({ connectionId: '12345' });
    });

    it('should retrieve cached rooms, join and bind subscriptions', async () => {
      mockGetCachedRooms.mockResolvedValueOnce({
        room1: '2024-09-21T08:00:00.000',
        room2: '2024-09-21T08:00:00.000'
      });

      await restoreCachedRooms(logger, redisClient, session, socket);

      expect(mockRestoreRoomSubscriptions).toHaveBeenCalledWith(
        redisClient,
        session.connectionId,
        'room1',
        KeyNamespace.SUBSCRIPTIONS,
        socket
      );

      expect(mockRestoreRoomSubscriptions).toHaveBeenCalledWith(
        redisClient,
        session.connectionId,
        'room1',
        KeyNamespace.PRESENCE,
        socket
      );

      expect(mockRestoreRoomSubscriptions).toHaveBeenCalledWith(
        redisClient,
        session.connectionId,
        'room1',
        KeyNamespace.METRICS,
        socket
      );

      expect(mockRestoreRoomSubscriptions).toHaveBeenCalledTimes(6);
      expect(mockSetRoomJoin).toHaveBeenCalledTimes(2);
      expect(socket.subscribe).toHaveBeenCalledTimes(2);
    });
  });
});
