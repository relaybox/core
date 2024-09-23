import '@/test/__mocks__/external/rabbitmq-client';
import ConnectionManager from '@/lib/connection-manager';
import { describe, expect, it } from 'vitest';

describe('connection-manager', () => {
  describe('connect', () => {
    it('should connect to a RabbitMQ server', async () => {
      const connectionManager = ConnectionManager.getInstance();
      const connection = connectionManager.connect('amqp://localhost');

      expect(connection.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('destroyInstance', () => {
    it('should destroy the singleton instance of ConnectionManager', () => {
      const connectionManager = ConnectionManager.getInstance();

      ConnectionManager.destroyInstance();

      expect(connectionManager.getConnection()).toBeNull();
    });
  });
});
