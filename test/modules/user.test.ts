import { WebSocket } from 'uWebSockets.js';
import { describe, expect, vi, it, beforeEach, afterEach } from 'vitest';
import { RedisClient } from '@/lib/redis';
import { Session } from '@/types/session.types';
import { KeyNamespace, KeyPrefix, KeySuffix } from '@/types/state.types';
import { getLogger } from '@/util/logger';
import {
  bindUserSubscription,
  getCachedUsers,
  getUserSubscriptions,
  pushUserSubscription,
  removeUserSubscription,
  restoreCachedUsers,
  unbindUserSubscription
} from '@/modules/user/user.service';
import { getMockSession } from '@/modules/session/session.mock';
import ChannelManager from '@/lib/amqp-manager/channel-manager';

const logger = getLogger('');

const mockUserRepository = vi.hoisted(() => ({
  pushUserSubscription: vi.fn(),
  bindUserSubscription: vi.fn(),
  removeUserSubscription: vi.fn(),
  unbindUserSubscription: vi.fn(),
  getUserSubscriptions: vi.fn(),
  getCachedUsers: vi.fn(),
  getUserSubscriptionCount: vi.fn()
}));

vi.mock('@/modules/user/user.repository', () => mockUserRepository);

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

      expect(mockUserRepository.pushUserSubscription).toHaveBeenCalledWith(
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

      expect(mockUserRepository.bindUserSubscription).toHaveBeenCalledWith(
        redisClient,
        expectedCacheKey,
        subscription
      );

      expect(socket.subscribe).toHaveBeenCalledWith(subscription);
      expect(mockUserRepository.getUserSubscriptionCount).toHaveBeenCalledWith(
        redisClient,
        expectedCacheKey
      );
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

      expect(mockUserRepository.removeUserSubscription).toHaveBeenCalledWith(
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

      expect(mockUserRepository.unbindUserSubscription).toHaveBeenCalledWith(
        redisClient,
        expectedCacheKey,
        subscription
      );

      expect(socket.unsubscribe).toHaveBeenCalledWith(subscription);
      expect(mockUserRepository.getUserSubscriptionCount).toHaveBeenCalledWith(
        redisClient,
        expectedCacheKey
      );
    });
  });

  describe('getUserSubscriptions', async () => {
    it('should get all user subsciptions by namespaced client id', async () => {
      const connectionId = '12345';
      const nspClientId = 'nsp:abcde';
      const expectedCacheKey = `${KeyPrefix.CONNECTION}:${connectionId}:${nspClientId}`;

      mockUserRepository.getUserSubscriptions.mockResolvedValueOnce({
        'user:connect': '2024-09-21T08:00:00.000Z',
        'user:disconnect': '2024-09-21T08:00:00.000Z'
      });

      const subscriptions = await getUserSubscriptions(
        logger,
        redisClient,
        connectionId,
        nspClientId
      );

      expect(mockUserRepository.getUserSubscriptions).toHaveBeenCalledWith(
        redisClient,
        expectedCacheKey
      );
      expect(subscriptions).toEqual(['user:connect', 'user:disconnect']);
    });
  });

  describe('getCachedUsers', async () => {
    it('should get cached users for connection id', async () => {
      const connectionId = '12345';
      const expectedCacheKey = `${KeyPrefix.CONNECTION}:${connectionId}:${KeySuffix.USERS}`;

      mockUserRepository.getCachedUsers.mockResolvedValueOnce({
        'user:1': '2024-09-21T08:00:00.000Z',
        'user:2': '2024-09-21T08:00:00.000Z'
      });

      const users = await getCachedUsers(redisClient, connectionId);

      expect(mockUserRepository.getCachedUsers).toHaveBeenCalledWith(redisClient, expectedCacheKey);
      expect(users).toEqual(['user:1', 'user:2']);
    });
  });

  describe('restoreCachedUsers', async () => {
    beforeEach(() => {
      session = getMockSession({ connectionId: '12345' });
    });

    it('should restore cached user subscriptions for a given session', async () => {
      mockUserRepository.getCachedUsers.mockResolvedValueOnce({
        'user:1': '2024-09-21T08:00:00.000Z'
      });

      mockUserRepository.getUserSubscriptions.mockResolvedValueOnce({
        'user:1:connect': '2024-09-21T08:00:00.000Z',
        'user:1:disconnect': '2024-09-21T08:00:00.000Z'
      });

      const nspUser = 'users:user:1';
      const userRoutingKey = ChannelManager.getRoutingKey(nspUser);

      await restoreCachedUsers(logger, redisClient, session, socket);

      expect(socket.subscribe).toHaveBeenCalledWith(userRoutingKey);
      expect(socket.subscribe).toHaveBeenCalledWith('user:1:connect');
      expect(socket.subscribe).toHaveBeenCalledWith('user:1:disconnect');
      expect(socket.subscribe).toHaveBeenCalledTimes(3);
    });
  });
});
