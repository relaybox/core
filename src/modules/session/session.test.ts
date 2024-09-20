import { describe, expect, vi, it, beforeEach, MockInstance } from 'vitest';
import { initializeSession, restoreSession } from './session.service';
import * as authService from '../auth/auth.service';
import { Session } from 'src/types/session.types';
import { getMockSession } from './session.mock';
import { RedisClient } from 'src/lib/redis';
import { WebSocket } from 'uWebSockets.js';
import { restoreCachedRooms } from './../room/room.service';
import { restoreCachedUsers } from './../user/user.service';
import { getLogger } from 'src/util/logger';

const logger = getLogger('');

vi.mock('../metrics/metrics.service', () => ({
  pushRoomLeaveMetrics: vi.fn()
}));

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
  restoreCachedRooms: vi.fn()
}));

vi.mock('./../user/user.service', () => ({
  restoreCachedUsers: vi.fn()
}));

describe('sessionService', () => {
  describe('initializeSession', () => {
    let mockSession: Session;
    let verifyApiKeySpy: MockInstance<
      Parameters<typeof authService.verifyApiKey>,
      Promise<Session>
    >;
    let verifyAuthTokenSpy: MockInstance<
      Parameters<typeof authService.verifyAuthToken>,
      Promise<Session>
    >;

    beforeEach(() => {
      mockSession = getMockSession();

      verifyApiKeySpy = vi.spyOn(authService, 'verifyApiKey');
      verifyAuthTokenSpy = vi.spyOn(authService, 'verifyAuthToken');

      verifyApiKeySpy.mockReset();
      verifyAuthTokenSpy.mockReset();
    });

    it('should initialize a session with API key', async () => {
      verifyApiKeySpy.mockResolvedValue(mockSession);

      const result = await initializeSession({ apiKey: 'testKey', clientId: 'client1' });

      expect(verifyApiKeySpy).toHaveBeenCalledWith('testKey', 'client1', undefined);
      expect(result).toEqual(mockSession);
    });

    it('should throw an error on invalid API key', async () => {
      verifyApiKeySpy.mockRejectedValue(new Error('Invalid API Key'));

      await expect(
        initializeSession({ apiKey: 'invalidKey', clientId: 'client1' })
      ).rejects.toThrow('Invalid API Key');
    });

    it('should initialize session with Auth token', async () => {
      verifyAuthTokenSpy.mockResolvedValue(mockSession);

      const result = await initializeSession({ token: 'validToken', connectionId: 'conn123' });

      expect(verifyAuthTokenSpy).toHaveBeenCalledWith('validToken', 'conn123');
      expect(result).toEqual(mockSession);
    });
  });

  describe('restoreSession', () => {
    const redisClient = {} as RedisClient;
    const session = {} as Session;
    const socket = {} as WebSocket<Session>;

    it('should call necessary functions to restore session', async () => {
      const restoreCachedRoomsMock = vi.mocked(restoreCachedRooms);
      const restoreCachedUsersMock = vi.mocked(restoreCachedUsers);

      restoreCachedRoomsMock.mockResolvedValueOnce(undefined);
      restoreCachedUsersMock.mockResolvedValueOnce(undefined);

      await restoreSession(redisClient, session, socket);

      expect(restoreCachedRoomsMock).toHaveBeenCalledWith(logger, redisClient, session, socket);
      expect(restoreCachedUsersMock).toHaveBeenCalledWith(logger, redisClient, session, socket);
    });

    it('should log and throw an error if session restoration fails', async () => {
      const restoreCachedRoomsMock = vi.mocked(restoreCachedRooms);
      restoreCachedRoomsMock.mockRejectedValueOnce(new Error('Redis error'));

      await expect(restoreSession(redisClient, session, socket)).rejects.toThrow('Redis error');
    });
  });
});
