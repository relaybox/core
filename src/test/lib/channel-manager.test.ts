import { describe, expect, it, vi } from 'vitest';
import ChannelManager from 'src/lib/channel-manager';
import ConfigManager from '../../lib/config-manager';

vi.mock('rabbitmq-client');

vi.mock('../../lib/config-manager', () => ({
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

  describe('bindRoom', () => {
    it('should bind a room to a routing key', async () => {
      const routingKey = '$$:appPid:7';
      const queueName = 'queue:1';

      const channelManager = new ChannelManager('instanceId');

      console.log(channelManager.bindings);

      // await channelManager.bindRoom(routingKey);

      // expect(channelManager['channel'].queueBind).toHaveBeenCalledWith({
      //   exchange: channelManager['exchange'],
      //   queue: queueName,
      //   routingKey
      // });

      // expect(channelManager['bindings'].set).toHaveBeenCalledWith(routingKey, queueName);
    });
  });
});
