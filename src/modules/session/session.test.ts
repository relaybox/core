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
} from './session.service';
import { Session } from 'src/types/session.types';
import { getMockSession } from './session.mock';
import { RedisClient } from 'src/lib/redis';
import { WebSocket } from 'uWebSockets.js';
import { getCachedRooms, restoreCachedRooms } from './../room/room.service';
import { restoreCachedUsers } from './../user/user.service';
import { getLogger } from 'src/util/logger';
import { pushRoomLeaveMetrics } from '../metrics/metrics.service';
import { verifyApiKey, verifyAuthToken } from '../auth/auth.service';
import { SessionJobName } from './session.queue';
import { SocketConnectionEventType } from 'src/types/socket.types';

const logger = getLogger('');

const { mockBullMQAdd, mockBullMQGetJob } = vi.hoisted(() => {
  return {
    mockBullMQAdd: vi.fn(),
    mockBullMQGetJob: vi.fn()
  };
});

vi.mock('bullmq', () => {
  return {
    Queue: vi.fn().mockImplementation(() => ({
      add: mockBullMQAdd,
      getJob: mockBullMQGetJob
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

describe('session.service', () => {
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

      const result = await initializeSession({
        apiKey: 'testKey',
        clientId: 'client1'
      });

      expect(verifyApiKeyMock).toHaveBeenCalledWith('testKey', 'client1', undefined);
      expect(result).toEqual(session);
    });

    it('should throw an error on invalid API key', async () => {
      verifyApiKeyMock.mockRejectedValue(new Error('Invalid API Key'));

      await expect(
        initializeSession({
          apiKey: 'invalidKey',
          clientId: 'client1'
        })
      ).rejects.toThrow('Invalid API Key');
    });

    it('should initialize session with Auth token', async () => {
      verifyAuthTokenMock.mockResolvedValue(session);

      const result = await initializeSession({
        token: 'validToken',
        connectionId: 'conn123'
      });

      expect(verifyAuthTokenMock).toHaveBeenCalledWith('validToken', 'conn123');
      expect(result).toEqual(session);
    });

    it('should throw an error on invalid Auth token', async () => {
      verifyAuthTokenMock.mockRejectedValue(new Error('Invalid Auth token'));

      await expect(
        initializeSession({
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
      expect(pushRoomLeaveMetricsMock).not.toHaveBeenCalled();
    });

    it('should log and throw an error if getCachedRooms fails', async () => {
      getCachedRoomsMock.mockRejectedValueOnce(new Error('Redis error'));
      await expect(clearSessionMetrics(redisClient, session)).rejects.toThrow('Redis error');
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
      mockBullMQGetJob.mockResolvedValueOnce(null);

      const reducedSession = getReducedSession(session);

      const jobData = {
        ...reducedSession,
        instanceId
      };

      await markSessionForDeletion(session, instanceId);

      expect(mockBullMQGetJob).toHaveBeenCalledWith(connectionId);

      expect(mockBullMQAdd).toHaveBeenCalledWith(
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

      mockBullMQGetJob.mockResolvedValueOnce(existingJob);

      const reducedSession = getReducedSession(session);

      const jobData = {
        ...reducedSession,
        instanceId
      };

      await markSessionForDeletion(session, instanceId);

      expect(existingJob.remove).toHaveBeenCalled();

      expect(mockBullMQAdd).toHaveBeenCalledWith(
        SessionJobName.SESSION_DESTROY,
        jobData,
        expect.objectContaining({
          jobId: connectionId,
          delay: expect.any(Number)
        })
      );
    });

    it('should throw an error if adding a new job fails', async () => {
      mockBullMQGetJob.mockResolvedValueOnce(null);
      mockBullMQAdd.mockRejectedValueOnce(new Error('Failed to add job'));

      await expect(markSessionForDeletion(session, instanceId)).rejects.toThrow(
        'Failed to add job'
      );
    });
  });

  describe('markSessionUserInactive', () => {
    const uid = '12345';
    const instanceId = 'instance-1';
    const session = getMockSession({ uid });

    afterEach(() => {
      vi.resetAllMocks();
    });

    it('should add a delayed job to mark session user inactive when no existing job is found', async () => {
      const reducedSession = getReducedSession(session);

      const jobData = {
        ...reducedSession,
        instanceId
      };

      await markSessionUserInactive(session, instanceId);

      expect(mockBullMQAdd).toHaveBeenCalledWith(
        SessionJobName.SESSION_USER_INACTIVE,
        jobData,
        expect.objectContaining({
          jobId: uid,
          delay: expect.any(Number)
        })
      );
    });

    it('should throw an error if adding a new job fails', async () => {
      mockBullMQGetJob.mockResolvedValueOnce(null);
      mockBullMQAdd.mockRejectedValueOnce(new Error('Failed to add job'));

      await expect(markSessionUserInactive(session, instanceId)).rejects.toThrow(
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

      mockBullMQGetJob.mockResolvedValueOnce(existingJob);

      await unmarkSessionForDeletion(connectionId);

      expect(existingJob.remove).toHaveBeenCalled();
    });

    it('should throw an error if removing a session destroy job fails', async () => {
      mockBullMQGetJob.mockRejectedValueOnce(new Error('Failed to add job'));

      await expect(unmarkSessionForDeletion(connectionId)).rejects.toThrow('Failed to add job');
    });
  });

  describe('markSessionUserActive', () => {
    const uid = '12345';

    afterEach(() => {
      vi.resetAllMocks();
    });

    it('should remove a session destroy job by uid when one is found', async () => {
      const existingJob = {
        remove: vi.fn()
      };

      mockBullMQGetJob.mockResolvedValueOnce(existingJob);

      await markSessionUserActive(uid);

      expect(existingJob.remove).toHaveBeenCalled();
    });

    it('should throw an error if adding a session user active job fails', async () => {
      mockBullMQGetJob.mockRejectedValueOnce(new Error('Failed to add job'));

      await expect(markSessionUserActive(uid)).rejects.toThrow('Failed to add job');
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
      await setSessionActive(session, socket);

      const { permissions, ...rest } = session;

      const jobData = {
        ...rest,
        timestamp: expect.any(String),
        socketId: 'mocked-socket-id'
      };

      expect(mockBullMQAdd).toHaveBeenCalledWith(
        SessionJobName.SESSION_ACTIVE,
        expect.objectContaining(jobData),
        expect.any(Object)
      );
    });

    it('should throw an error if adding a session active job fails', async () => {
      mockBullMQAdd.mockRejectedValueOnce(new Error('Failed to add job'));

      await expect(setSessionActive(session, socket)).rejects.toThrow('Failed to add job');
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

      await recordConnnectionEvent(session, socket, connectionEventType);

      expect(mockBullMQAdd).toHaveBeenCalledWith(
        SessionJobName.SESSION_SOCKET_CONNECTION_EVENT,
        jobData,
        expect.any(Object)
      );
    });

    it('should throw an error if removing a session destroy job fails', async () => {
      mockBullMQAdd.mockRejectedValueOnce(new Error('Failed to add job'));

      await expect(setSessionActive(session, socket)).rejects.toThrow('Failed to add job');
    });
  });
});
