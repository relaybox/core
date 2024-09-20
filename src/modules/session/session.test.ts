import { describe, expect, vi, it, beforeEach, MockInstance, afterEach } from 'vitest';
import { clearSessionMetrics, initializeSession, restoreSession } from './session.service';
import { Session } from 'src/types/session.types';
import { getMockSession } from './session.mock';
import { RedisClient } from 'src/lib/redis';
import { WebSocket } from 'uWebSockets.js';
import { getCachedRooms, restoreCachedRooms } from './../room/room.service';
import { restoreCachedUsers } from './../user/user.service';
import { getLogger } from 'src/util/logger';
import { pushRoomLeaveMetrics } from '../metrics/metrics.service';
import { verifyApiKey, verifyAuthToken } from '../auth/auth.service';

const logger = getLogger('');

const { mockBullMQAdd } = vi.hoisted(() => {
  return {
    mockBullMQAdd: vi.fn()
  };
});

vi.mock('bullmq', () => {
  return {
    Queue: vi.fn().mockImplementation(() => ({
      add: mockBullMQAdd
    }))
  };
});

vi.mock('./../room/room.service', () => ({
  restoreCachedRooms: vi.fn(),
  getCachedRooms: vi.fn()
}));

vi.mock('./../user/user.service', () => ({
  restoreCachedUsers: vi.fn()
}));

vi.mock('./../metrics/metrics.service', () => ({
  pushRoomLeaveMetrics: vi.fn()
}));

vi.mock('./../auth/auth.service', () => ({
  verifyApiKey: vi.fn(),
  verifyAuthToken: vi.fn()
}));

describe('sessionService', () => {
  describe('initializeSession', () => {
    let session = getMockSession();

    let verifyApiKeyMock: MockInstance<Parameters<typeof verifyApiKey>, Promise<Session>>;
    let verifyAuthTokenMock: MockInstance<Parameters<typeof verifyAuthToken>, Promise<Session>>;

    beforeEach(() => {
      verifyApiKeyMock = vi.mocked(verifyApiKey);
      verifyAuthTokenMock = vi.mocked(verifyAuthToken);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should initialize a session with API key', async () => {
      verifyApiKeyMock.mockResolvedValue(session);

      const result = await initializeSession({ apiKey: 'testKey', clientId: 'client1' });

      expect(verifyApiKeyMock).toHaveBeenCalledWith('testKey', 'client1', undefined);
      expect(result).toEqual(session);
    });

    it('should throw an error on invalid API key', async () => {
      verifyApiKeyMock.mockRejectedValue(new Error('Invalid API Key'));

      await expect(
        initializeSession({ apiKey: 'invalidKey', clientId: 'client1' })
      ).rejects.toThrow('Invalid API Key');
    });

    it('should initialize session with Auth token', async () => {
      verifyAuthTokenMock.mockResolvedValue(session);

      const result = await initializeSession({ token: 'validToken', connectionId: 'conn123' });

      expect(verifyAuthTokenMock).toHaveBeenCalledWith('validToken', 'conn123');
      expect(result).toEqual(session);
    });
  });

  describe('restoreSession', () => {
    const redisClient = {} as RedisClient;
    const session = getMockSession();
    const socket = {} as WebSocket<Session>;

    let restoreCachedRoomsMock: MockInstance<Parameters<typeof restoreCachedRooms>, Promise<any>>;
    let restoreCachedUsersMock: MockInstance<Parameters<typeof restoreCachedUsers>, Promise<any>>;

    beforeEach(() => {
      restoreCachedRoomsMock = vi.mocked(restoreCachedRooms);
      restoreCachedUsersMock = vi.mocked(restoreCachedUsers);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should call necessary functions to restore session', async () => {
      restoreCachedRoomsMock.mockResolvedValueOnce(undefined);
      restoreCachedUsersMock.mockResolvedValueOnce(undefined);

      await restoreSession(redisClient, session, socket);

      expect(restoreCachedRoomsMock).toHaveBeenCalledWith(logger, redisClient, session, socket);
      expect(restoreCachedUsersMock).toHaveBeenCalledWith(logger, redisClient, session, socket);
    });

    it('should log and throw an error if session restoration fails', async () => {
      restoreCachedRoomsMock.mockRejectedValueOnce(new Error('Redis error'));
      await expect(restoreSession(redisClient, session, socket)).rejects.toThrow('Redis error');
    });
  });

  describe('clearSessionMetrics', () => {
    const redisClient = {} as RedisClient;
    const session = getMockSession();

    let getCachedRoomsMock: MockInstance<Parameters<typeof getCachedRooms>, Promise<any>>;
    let pushRoomLeaveMetricsMock: MockInstance<
      Parameters<typeof pushRoomLeaveMetrics>,
      Promise<any>
    >;

    beforeEach(() => {
      getCachedRoomsMock = vi.mocked(getCachedRooms);
      pushRoomLeaveMetricsMock = vi.mocked(pushRoomLeaveMetrics);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should retrieve rooms and push room leave metrics', async () => {
      const mockRooms = ['room1', 'room2'];

      getCachedRoomsMock.mockResolvedValueOnce(mockRooms);
      pushRoomLeaveMetricsMock.mockResolvedValueOnce(undefined);

      await clearSessionMetrics(redisClient, session);

      expect(getCachedRoomsMock).toHaveBeenCalledWith(logger, redisClient, session.connectionId);
      expect(pushRoomLeaveMetricsMock).toHaveBeenCalledTimes(mockRooms.length);
      expect(pushRoomLeaveMetricsMock).toHaveBeenCalledWith(session.uid, 'room1', session);
      expect(pushRoomLeaveMetricsMock).toHaveBeenCalledWith(session.uid, 'room2', session);
    });

    it('should handle no rooms without pushing metrics', async () => {
      getCachedRoomsMock.mockResolvedValueOnce([]);

      await clearSessionMetrics(redisClient, session);

      expect(getCachedRoomsMock).toHaveBeenCalledWith(logger, redisClient, session.connectionId);
      expect(vi.mocked(pushRoomLeaveMetrics)).not.toHaveBeenCalled();
    });

    it('should log and throw an error if getCachedRooms fails', async () => {
      getCachedRoomsMock.mockRejectedValueOnce(new Error('Redis error'));
      await expect(clearSessionMetrics(redisClient, session)).rejects.toThrow('Redis error');
    });
  });
});
