import { mockQueue } from '../__mocks__/external/bullmq';
import { describe, expect, vi, it, beforeEach, MockInstance, afterEach } from 'vitest';
import {
  clearSessionMetrics,
  getReducedSession,
  initializeSession,
  markSessionForDeletion,
  markSessionUserActive,
  markSessionUserInactive,
  recordConnnectionEvent,
  restoreSession,
  setSessionActive,
  unmarkSessionForDeletion
} from '@/modules/session/session.service';
import { Session } from '@/types/session.types';
import { getMockSession } from 'test/__mocks__/internal/session.mock';
import { RedisClient } from '@/lib/redis';
import { WebSocket } from 'uWebSockets.js';
import { getLogger } from '@/util/logger';
import { SessionJobName } from '@/modules/session/session.queue';
import { SocketConnectionEventType } from '@/types/socket.types';
import { getSoftSessionDeleteJobId } from '@/util/helpers';

const logger = getLogger('');

const mockRoomService = vi.hoisted(() => ({
  restoreCachedRooms: vi.fn(),
  getCachedRooms: vi.fn()
}));

vi.mock('@/modules/room/room.service', () => mockRoomService);

const mockUserService = vi.hoisted(() => ({
  restoreCachedUsers: vi.fn()
}));

vi.mock('@/modules/user/user.service', () => mockUserService);

const mockMetricsService = vi.hoisted(() => ({
  pushRoomLeaveMetrics: vi.fn()
}));

vi.mock('@/modules/metrics/metrics.service', () => mockMetricsService);

const mockAuthService = vi.hoisted(() => ({
  verifyApiKey: vi.fn(),
  verifyAuthToken: vi.fn()
}));

vi.mock('@/modules/auth/auth.service', () => mockAuthService);

describe('session.service', () => {
  describe('initializeSession', () => {
    let session = getMockSession();

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should initialize a session with API key', async () => {
      mockAuthService.verifyApiKey.mockResolvedValue(session);

      const result = await initializeSession(logger, {
        apiKey: 'testKey',
        clientId: 'client1'
      });

      expect(mockAuthService.verifyApiKey).toHaveBeenCalledWith(
        logger,
        'testKey',
        'client1',
        undefined
      );
      expect(result).toEqual(session);
    });

    it('should throw an error on invalid API key', async () => {
      mockAuthService.verifyApiKey.mockRejectedValue(new Error('Invalid API Key'));

      await expect(
        initializeSession(logger, {
          apiKey: 'invalidKey',
          clientId: 'client1'
        })
      ).rejects.toThrow('Invalid API Key');
    });

    it('should initialize session with Auth token', async () => {
      mockAuthService.verifyAuthToken.mockResolvedValue(session);

      const result = await initializeSession(logger, {
        token: 'validToken',
        connectionId: 'conn123'
      });

      expect(mockAuthService.verifyAuthToken).toHaveBeenCalledWith(logger, 'validToken', 'conn123');
      expect(result).toEqual(session);
    });

    it('should throw an error on invalid Auth token', async () => {
      mockAuthService.verifyAuthToken.mockRejectedValue(new Error('Invalid Auth token'));

      await expect(
        initializeSession(logger, {
          token: 'invalidAuthToken',
          connectionId: '12345'
        })
      ).rejects.toThrow('Invalid Auth token');
    });
  });

  describe('restoreSession', () => {
    const redisClient = {} as RedisClient;
    const session = getMockSession();
    const socket = {} as WebSocket<Session>;

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should call necessary functions to restore session', async () => {
      mockRoomService.restoreCachedRooms.mockResolvedValueOnce(undefined);
      mockUserService.restoreCachedUsers.mockResolvedValueOnce(undefined);

      await restoreSession(logger, redisClient, session, socket);

      expect(mockRoomService.restoreCachedRooms).toHaveBeenCalledWith(
        logger,
        redisClient,
        session,
        socket
      );
      expect(mockUserService.restoreCachedUsers).toHaveBeenCalledWith(
        logger,
        redisClient,
        session,
        socket
      );
    });

    it('should log and throw an error if session restoration fails', async () => {
      mockRoomService.restoreCachedRooms.mockRejectedValueOnce(new Error('Redis error'));
      await expect(restoreSession(logger, redisClient, session, socket)).rejects.toThrow(
        'Redis error'
      );
    });
  });

  describe('clearSessionMetrics', () => {
    const redisClient = {} as RedisClient;
    const session = getMockSession();

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should retrieve rooms and push room leave metrics', async () => {
      const mockRooms = ['room1', 'room2'];

      mockRoomService.getCachedRooms.mockResolvedValueOnce(mockRooms);
      mockMetricsService.pushRoomLeaveMetrics.mockResolvedValueOnce(undefined);

      await clearSessionMetrics(logger, redisClient, session);

      expect(mockRoomService.getCachedRooms).toHaveBeenCalledWith(
        logger,
        redisClient,
        session.connectionId
      );
      expect(mockMetricsService.pushRoomLeaveMetrics).toHaveBeenCalledTimes(mockRooms.length);
      expect(mockMetricsService.pushRoomLeaveMetrics).toHaveBeenCalledWith(
        session.uid,
        'room1',
        session
      );
      expect(mockMetricsService.pushRoomLeaveMetrics).toHaveBeenCalledWith(
        session.uid,
        'room2',
        session
      );
    });

    it('should handle no rooms without pushing metrics', async () => {
      mockRoomService.getCachedRooms.mockResolvedValueOnce([]);

      await clearSessionMetrics(logger, redisClient, session);

      expect(mockRoomService.getCachedRooms).toHaveBeenCalledWith(
        logger,
        redisClient,
        session.connectionId
      );
      expect(mockMetricsService.pushRoomLeaveMetrics).not.toHaveBeenCalled();
    });

    it('should log and throw an error if getCachedRooms fails', async () => {
      mockRoomService.getCachedRooms.mockRejectedValueOnce(new Error('Redis error'));
      await expect(clearSessionMetrics(logger, redisClient, session)).rejects.toThrow(
        'Redis error'
      );
    });
  });

  describe('markSessionForDeletion', () => {
    const connectionId = '12345';
    const instanceId = 'instance-1';
    const session = getMockSession({ connectionId });

    afterEach(() => {
      vi.resetAllMocks();
    });

    it('should add a session destroy job when no existing job is found', async () => {
      mockQueue.getJob.mockResolvedValueOnce(null);

      const reducedSession = getReducedSession(session);

      const jobData = {
        ...reducedSession,
        instanceId
      };

      await markSessionForDeletion(logger, session, instanceId);

      expect(mockQueue.getJob).toHaveBeenCalledWith(connectionId);

      expect(mockQueue.add).toHaveBeenCalledWith(
        SessionJobName.SESSION_DESTROY,
        jobData,
        expect.objectContaining({
          jobId: connectionId,
          delay: expect.any(Number)
        })
      );
    });

    it('should remove an existing job and add a new one', async () => {
      const existingJob = {
        remove: vi.fn()
      };

      mockQueue.getJob.mockResolvedValueOnce(existingJob);

      const reducedSession = getReducedSession(session);

      const jobData = {
        ...reducedSession,
        instanceId
      };

      await markSessionForDeletion(logger, session, instanceId);

      expect(existingJob.remove).toHaveBeenCalled();

      expect(mockQueue.add).toHaveBeenCalledWith(
        SessionJobName.SESSION_DESTROY,
        jobData,
        expect.objectContaining({
          jobId: connectionId,
          delay: expect.any(Number)
        })
      );
    });

    it('should throw an error if adding a new job fails', async () => {
      mockQueue.getJob.mockResolvedValueOnce(null);
      mockQueue.add.mockRejectedValueOnce(new Error('Failed to add job'));

      await expect(markSessionForDeletion(logger, session, instanceId)).rejects.toThrow(
        'Failed to add job'
      );
    });
  });

  describe('markSessionUserInactive', () => {
    const connectionId = '12345';
    const instanceId = 'instance-1';
    const session = getMockSession({ connectionId });

    afterEach(() => {
      vi.resetAllMocks();
    });

    it('should add a delayed job to mark session user inactive when no existing job is found', async () => {
      const reducedSession = getReducedSession(session);

      const jobData = {
        ...reducedSession,
        instanceId
      };

      await markSessionUserInactive(logger, session, instanceId);

      const jobId = getSoftSessionDeleteJobId(session.connectionId);

      expect(mockQueue.add).toHaveBeenCalledWith(
        SessionJobName.SESSION_USER_INACTIVE,
        jobData,
        expect.objectContaining({
          jobId,
          delay: expect.any(Number)
        })
      );
    });

    it('should throw an error if adding a new job fails', async () => {
      mockQueue.getJob.mockResolvedValueOnce(null);
      mockQueue.add.mockRejectedValueOnce(new Error('Failed to add job'));

      await expect(markSessionUserInactive(logger, session, instanceId)).rejects.toThrow(
        'Failed to add job'
      );
    });
  });

  describe('unmarkSessionForDeletion', () => {
    const connectionId = '12345';

    afterEach(() => {
      vi.resetAllMocks();
    });

    it('should remove a session destroy job by connection id when one is found', async () => {
      const existingJob = {
        remove: vi.fn()
      };

      mockQueue.getJob.mockResolvedValueOnce(existingJob);

      await unmarkSessionForDeletion(logger, connectionId);

      expect(existingJob.remove).toHaveBeenCalled();
    });

    it('should throw an error if removing a session destroy job fails', async () => {
      mockQueue.getJob.mockRejectedValueOnce(new Error('Failed to add job'));

      await expect(unmarkSessionForDeletion(logger, connectionId)).rejects.toThrow(
        'Failed to add job'
      );
    });
  });

  describe('markSessionUserActive', () => {
    const connectionId = '12345';
    const session = getMockSession({ connectionId });

    afterEach(() => {
      vi.resetAllMocks();
    });

    it('should remove a session destroy job by connectionId when one is found', async () => {
      const existingJob = {
        remove: vi.fn()
      };

      mockQueue.getJob.mockResolvedValueOnce(existingJob);

      const jobId = getSoftSessionDeleteJobId(connectionId);

      await markSessionUserActive(logger, connectionId);

      expect(mockQueue.getJob).toHaveBeenCalledWith(jobId);
      expect(existingJob.remove).toHaveBeenCalled();
    });

    it('should throw an error if adding mark session user active job fails', async () => {
      mockQueue.getJob.mockRejectedValueOnce(new Error('Failed to add job'));

      const appPid = session.appPid;

      await expect(markSessionUserActive(logger, connectionId)).rejects.toThrow(
        'Failed to add job'
      );
    });
  });

  describe('setSessionActive', () => {
    let socket: WebSocket<Session>;

    const session = getMockSession();

    beforeEach(() => {
      socket = {
        getUserData: vi.fn().mockReturnValue({
          socketId: 'mocked-socket-id'
        })
      } as unknown as WebSocket<Session>;
    });

    afterEach(() => {
      vi.resetAllMocks();
      vi.clearAllMocks();
    });

    it('should add a session active job when active connection is established', async () => {
      await setSessionActive(logger, session, socket);

      const { permissions, ...rest } = session;

      const jobData = {
        ...rest,
        timestamp: expect.any(String),
        socketId: 'mocked-socket-id'
      };

      expect(mockQueue.add).toHaveBeenCalledWith(
        SessionJobName.SESSION_ACTIVE,
        expect.objectContaining(jobData),
        expect.any(Object)
      );
    });

    it('should throw an error if adding set session active job fails', async () => {
      mockQueue.add.mockRejectedValueOnce(new Error('Failed to add job'));

      await expect(setSessionActive(logger, session, socket)).rejects.toThrow('Failed to add job');
    });
  });

  describe('recordConnnectionEvent', () => {
    let socket: WebSocket<Session>;
    const session = getMockSession({
      socketId: 'mocked-socket-id'
    });

    beforeEach(() => {
      socket = {
        getUserData: vi.fn().mockReturnValue({
          socketId: 'mocked-socket-id'
        })
      } as unknown as WebSocket<Session>;

      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.resetAllMocks();
      vi.clearAllMocks();
      vi.useRealTimers();
    });

    it('should add a socket connection event job when a connection is established', async () => {
      const reducedSession = getReducedSession(session);
      const connectionEventType = SocketConnectionEventType.CONNECT;
      const connectionEventTimestamp = new Date().toISOString();

      const connectionEvent = {
        connectionEventType,
        connectionEventTimestamp
      };

      const jobData = {
        ...reducedSession,
        ...connectionEvent
      };

      await recordConnnectionEvent(logger, session, socket, connectionEventType);

      expect(mockQueue.add).toHaveBeenCalledWith(
        SessionJobName.SESSION_SOCKET_CONNECTION_EVENT,
        jobData,
        expect.any(Object)
      );
    });

    it('should throw an error if removing a session destroy job fails', async () => {
      mockQueue.add.mockRejectedValueOnce(new Error('Failed to add job'));

      await expect(setSessionActive(logger, session, socket)).rejects.toThrow('Failed to add job');
    });
  });
});
