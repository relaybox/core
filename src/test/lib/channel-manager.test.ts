import ChannelManager from 'src/lib/channel-manager';
import { describe, expect, it } from 'vitest';

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
});
