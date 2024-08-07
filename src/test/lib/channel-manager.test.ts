import ChannelManager from 'src/lib/channel-manager';
import { describe, expect, it } from 'vitest';

describe('ChannelManager', () => {
  describe('getRoutingKey', () => {
    it('should return the correct routing key for a given namespace', () => {
      const routingKey = ChannelManager.getRoutingKey('appPid:nsp:123:456');
      const [routingKeyprefix, appPid, hashedNamespace] = routingKey.split(':');

      expect(hashedNamespace).toHaveLength(2);
      expect(appPid).toBe('appPid');
      expect(routingKeyprefix).toBe('$$');
    });
  });
});
