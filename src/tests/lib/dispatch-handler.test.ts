import '@/tests/__mocks__/external/rabbitmq-client';
import Connection, { Publisher } from 'rabbitmq-client';
import PublisherManager from '@/lib/publisher-manager';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import ConnectionManager from '@/lib/connection-manager';
import DispatchHandler from '@/lib/dispatch-handler';
import { getMockSession } from '@/modules/session/session.mock';
import ChannelManager from '@/lib/channel-manager';

describe('dispatch-handler', () => {
  let publisher: Publisher;
  let connection: Connection;
  const session = getMockSession();

  beforeAll(() => {
    const connectionManager = ConnectionManager.getInstance();
    connection = connectionManager.connect('amqp://localhost');

    const publisherManager = new PublisherManager();
    publisher = publisherManager.createPublisher(connection);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();

    ConnectionManager.destroyInstance();
  });

  describe('to', () => {
    it('should dispatch a message using generated routing key', () => {
      const dispatchHandler = new DispatchHandler(publisher);

      const buildMessageSpy = vi.spyOn(dispatchHandler as any, 'buildMessage');
      const handleDispatchSpy = vi.spyOn(dispatchHandler as any, 'handleDispatch');

      const event = 'event';
      const nspRoomId = 'nsp:chat:one';
      const routingKey = ChannelManager.getRoutingKey(nspRoomId);
      const timestamp = new Date().toISOString();

      const data = {
        message: 'This is a test message body',
        timestamp
      };

      const latencyLog = {
        createdAt: '2023-09-21T08:00:00.000Z',
        receivedAt: '2023-09-21T08:00:00.000Z'
      };

      dispatchHandler.to(nspRoomId).dispatch(event, data, session, latencyLog);

      expect(buildMessageSpy).toHaveBeenCalledTimes(1);
      expect(handleDispatchSpy).toHaveBeenCalledTimes(1);

      expect(publisher.send).toHaveBeenCalledWith(
        expect.objectContaining({
          routingKey
        }),
        expect.objectContaining({
          event,
          nspRoomId,
          data,
          session,
          latencyLog
        })
      );
    });
  });
});
