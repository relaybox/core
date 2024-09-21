import { WebSocket } from 'uWebSockets.js';
import { describe, expect, vi, it, beforeEach, afterEach } from 'vitest';
import { RedisClient } from 'src/lib/redis';
import { Session } from 'src/types/session.types';
import { KeyNamespace, KeyPrefix, KeySuffix } from 'src/types/state.types';
import { getLogger } from 'src/util/logger';
import {
  bindUserSubscription,
  getCachedUsers,
  getUserSubscriptions,
  pushUserSubscription,
  removeUserSubscription,
  restoreCachedUsers,
  restoreUserSubscriptions,
  unbindUserSubscription
} from './user.service';
import { getMockSession } from '../session/session.mock';
import ChannelManager from 'src/lib/channel-manager';

const logger = getLogger('');

const {
  mockPushUserSubscription,
  mockBindUserSubscription,
  mockRemoveUserSubscription,
  mockUnbindUserSubscription,
  mockGetUserSubscriptions,
  mockGetCachedUsers,
  mockGetUserSubscriptionCount
} = vi.hoisted(() => {
  return {
    mockPushUserSubscription: vi.fn(),
    mockBindUserSubscription: vi.fn(),
    mockRemoveUserSubscription: vi.fn(),
    mockUnbindUserSubscription: vi.fn(),
    mockGetUserSubscriptions: vi.fn(),
    mockGetCachedUsers: vi.fn(),
    mockGetUserSubscriptionCount: vi.fn()
  };
});

vi.mock('./user.repository', () => ({
  pushUserSubscription: mockPushUserSubscription,
  bindUserSubscription: mockBindUserSubscription,
  removeUserSubscription: mockRemoveUserSubscription,
  unbindUserSubscription: mockUnbindUserSubscription,
  getUserSubscriptions: mockGetUserSubscriptions,
  getCachedUsers: mockGetCachedUsers,
  getUserSubscriptionCount: mockGetUserSubscriptionCount
}));

const { mockRestoreUserSubscriptions } = vi.hoisted(() => {
  return {
    mockRestoreUserSubscriptions: vi.fn()
  };
});

vi.mock('./../subscription/subscription.service', () => ({
  restoreUserSubscriptions: mockRestoreUserSubscriptions
}));

describe('user.service', () => {
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

  describe('pushUserSubscription', async () => {
    it('should add a user subscription to cached user by client id', async () => {
      const connectionId = '12345';
      const clientId = 'abcde';
      const userRoutingKey = 'user-routing-key';
      const expectedCacheKey = `${KeyPrefix.CONNECTION}:${connectionId}:${KeyNamespace.USERS}`;

      await pushUserSubscription(
        logger,
        redisClient,
        connectionId,
        clientId,
        userRoutingKey,
        socket
      );

      expect(mockPushUserSubscription).toHaveBeenCalledWith(
        redisClient,
        expectedCacheKey,
        clientId
      );

      expect(socket.subscribe).toHaveBeenCalledWith(userRoutingKey);
    });
  });

  describe('bindUserSubscription', async () => {
    it('should bind a user subscription to cached user subsciptions by client id', async () => {
      const connectionId = '12345';
      const nspClientId = 'nsp:abcde';
      const subscription = 'user:join';
      const expectedCacheKey = `${KeyPrefix.CONNECTION}:${connectionId}:${nspClientId}`;

      await bindUserSubscription(
        logger,
        redisClient,
        connectionId,
        nspClientId,
        subscription,
        socket
      );

      expect(mockBindUserSubscription).toHaveBeenCalledWith(
        redisClient,
        expectedCacheKey,
        subscription
      );

      expect(socket.subscribe).toHaveBeenCalledWith(subscription);
      expect(mockGetUserSubscriptionCount).toHaveBeenCalledWith(redisClient, expectedCacheKey);
    });
  });

  describe('removeUserSubscription', async () => {
    it('should remove a user subscription from cached user by client id', async () => {
      const connectionId = '12345';
      const clientId = 'abcde';
      const userRoutingKey = 'user-routing-key';
      const expectedCacheKey = `${KeyPrefix.CONNECTION}:${connectionId}:${KeyNamespace.USERS}`;

      await removeUserSubscription(
        logger,
        redisClient,
        connectionId,
        clientId,
        userRoutingKey,
        socket
      );

      expect(mockRemoveUserSubscription).toHaveBeenCalledWith(
        redisClient,
        expectedCacheKey,
        clientId
      );

      expect(socket.unsubscribe).toHaveBeenCalledWith(userRoutingKey);
    });
  });

  describe('unbindUserSubscription', async () => {
    it('should bind a user subscription to cached user subsciptions by client id', async () => {
      const connectionId = '12345';
      const nspClientId = 'nsp:abcde';
      const subscription = 'user:connect';
      const expectedCacheKey = `${KeyPrefix.CONNECTION}:${connectionId}:${nspClientId}`;

      await unbindUserSubscription(
        logger,
        redisClient,
        connectionId,
        nspClientId,
        subscription,
        socket
      );

      expect(mockUnbindUserSubscription).toHaveBeenCalledWith(
        redisClient,
        expectedCacheKey,
        subscription
      );

      expect(socket.unsubscribe).toHaveBeenCalledWith(subscription);
      expect(mockGetUserSubscriptionCount).toHaveBeenCalledWith(redisClient, expectedCacheKey);
    });
  });

  describe('getUserSubscriptions', async () => {
    it('should get all user subsciptions by namespaced client id', async () => {
      const connectionId = '12345';
      const nspClientId = 'nsp:abcde';
      const expectedCacheKey = `${KeyPrefix.CONNECTION}:${connectionId}:${nspClientId}`;

      mockGetUserSubscriptions.mockResolvedValueOnce({
        'user:connect': '2024-09-21T08:00:00.000Z',
        'user:disconnect': '2024-09-21T08:00:00.000Z'
      });

      const subscriptions = await getUserSubscriptions(
        logger,
        redisClient,
        connectionId,
        nspClientId
      );

      expect(mockGetUserSubscriptions).toHaveBeenCalledWith(redisClient, expectedCacheKey);
      expect(subscriptions).toEqual(['user:connect', 'user:disconnect']);
    });
  });

  describe('getCachedUsers', async () => {
    it('should get cahced users for connection id', async () => {
      const connectionId = '12345';
      const expectedCacheKey = `${KeyPrefix.CONNECTION}:${connectionId}:${KeySuffix.USERS}`;

      mockGetCachedUsers.mockResolvedValueOnce({
        'user:1': '2024-09-21T08:00:00.000Z',
        'user:2': '2024-09-21T08:00:00.000Z'
      });

      const users = await getCachedUsers(redisClient, connectionId);

      expect(mockGetCachedUsers).toHaveBeenCalledWith(redisClient, expectedCacheKey);
      expect(users).toEqual(['user:1', 'user:2']);
    });
  });

  describe('restoreCachedUsers', async () => {
    beforeEach(() => {
      session = getMockSession({ connectionId: '12345' });
    });

    it('should restore cached user subscriptions for a given session', async () => {
      mockGetCachedUsers.mockResolvedValueOnce({
        'user:1': '2024-09-21T08:00:00.000Z',
        'user:2': '2024-09-21T08:00:00.000Z'
      });

      mockGetUserSubscriptions.mockResolvedValueOnce({
        'user:1:connect': '2024-09-21T08:00:00.000Z',
        'user:1:disconnect': '2024-09-21T08:00:00.000Z'
      });

      mockGetUserSubscriptions.mockResolvedValueOnce({
        'user:2:connect': '2024-09-21T08:00:00.000Z',
        'user:2:disconnect': '2024-09-21T08:00:00.000Z'
      });

      const nspUser1 = 'users:user:1';
      const nspUser2 = 'users:user:2';
      const user1RoutingKey = ChannelManager.getRoutingKey(nspUser1);
      const user2RoutingKey = ChannelManager.getRoutingKey(nspUser2);

      await restoreCachedUsers(logger, redisClient, session, socket);

      expect(socket.subscribe).toHaveBeenCalledWith(user1RoutingKey);
      expect(socket.subscribe).toHaveBeenCalledWith(user2RoutingKey);
      expect(socket.subscribe).toHaveBeenCalledWith('user:1:connect');
      expect(socket.subscribe).toHaveBeenCalledWith('user:1:disconnect');
      expect(socket.subscribe).toHaveBeenCalledWith('user:2:connect');
      expect(socket.subscribe).toHaveBeenCalledWith('user:2:disconnect');
      expect(socket.subscribe).toHaveBeenCalledTimes(6);
    });
  });
});
