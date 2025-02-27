import '../__mocks__/external/rabbitmq-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChannelManager from '@/lib/amqp-manager/channel-manager';
import ConfigManager from '@/lib/amqp-manager/config-manager';
import { EventEmitter } from 'events';
import { SocketSubscriptionEvent } from '@/types/socket.types';
import ConnectionManager from '@/lib/amqp-manager/connection-manager';
import Connection from 'rabbitmq-client';

const mockEventEmitter = new EventEmitter();

vi.mock('@/lib/amqp-manager/config-manager', () => ({
  default: {
    getInt: vi.fn()
  }
}));

describe('ChannelManager', () => {
  describe('getRoutingKey', () => {
    it('should return the correct routing key for a given namespace with suffix', () => {
      const routingKey = ChannelManager.getRoutingKey('appPid:nsp:123:456');
      const [routingKeyprefix, appPid, hashedRoomId] = routingKey.split(':');

      expect(routingKeyprefix).toBe('$$');
      expect(appPid).toBe('appPid');
      expect(hashedRoomId).toEqual('10');
    });

    it('should return the correct routing key for a given namespace without suffix', () => {
      const routingKey = ChannelManager.getRoutingKey('appPid:nsp');
      const [routingKeyprefix, appPid, hashedRoomId] = routingKey.split(':');

      expect(routingKeyprefix).toBe('$$');
      expect(appPid).toBe('appPid');
      expect(hashedRoomId).toEqual('7');
    });
  });

  describe('gethashedRoomId', () => {
    it('should return the correct hash for a given value (roomId)', () => {
      vi.mocked(ConfigManager.getInt).mockReturnValue(20);

      const hashedRoomId1 = ChannelManager.gethashedRoomId('abracadabra');
      const hashedRoomId2 = ChannelManager.gethashedRoomId('zebraCrossing');

      expect(hashedRoomId1).toEqual(10);
      expect(hashedRoomId2).toEqual(16);

      vi.mocked(ConfigManager.getInt).mockReturnValue(10);

      const hashedRoomId3 = ChannelManager.gethashedRoomId('abracadabra');
      const hashedRoomId4 = ChannelManager.gethashedRoomId('zebraCrossing');

      expect(hashedRoomId3).toEqual(0);
      expect(hashedRoomId4).toEqual(6);
    });
  });

  describe('Room bindings', () => {
    let connection: Connection;

    beforeEach(() => {
      const connectionManager = ConnectionManager.getInstance();
      connection = connectionManager.connect('amqp://localhost');
    });

    afterEach(() => {
      ConnectionManager.destroyInstance();
    });

    describe('bindRoom', () => {
      it('should bind a room to a routing key', async () => {
        const routingKey = '$$:appPid:7';
        const channelManager = new ChannelManager('instanceId', mockEventEmitter);
        const channel = await channelManager.createChannel(connection);

        mockEventEmitter.emit(SocketSubscriptionEvent.SUBSCRIPTION_CREATE, routingKey);

        expect(channel.queueBind).toHaveBeenCalledWith(
          expect.objectContaining({
            routingKey
          })
        );

        await new Promise(process.nextTick);

        expect(channelManager['bindings'].get(routingKey)).toBeDefined();
      });
    });

    describe('unbindRoom', () => {
      it('should unbind a room from a routing key', async () => {
        const routingKey = '$$:appPid:7';
        const channelManager = new ChannelManager('instanceId', mockEventEmitter);
        const channel = await channelManager.createChannel(connection);

        mockEventEmitter.emit(SocketSubscriptionEvent.SUBSCRIPTION_CREATE, routingKey);

        await new Promise(process.nextTick);

        expect(channelManager['bindings'].get(routingKey)).toBeDefined();

        mockEventEmitter.emit(SocketSubscriptionEvent.SUBSCRIPTION_DELETE, routingKey);

        expect(channel.queueUnbind).toHaveBeenCalledWith(
          expect.objectContaining({
            routingKey
          })
        );

        await new Promise(process.nextTick);

        expect(channelManager['bindings'].get(routingKey)).toBeUndefined();
      });
    });
  });
});
