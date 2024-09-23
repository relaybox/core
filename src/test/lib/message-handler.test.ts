import 'src/test/__mocks__/external/rabbitmq-client';
import { mockApp } from 'src/test/__mocks__/external/uWebsockets';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MessageHandler from '@/lib/message-handler';
import { getMockSession } from '@/modules/session/session.mock';

vi.mock('uWebSockets.js');

describe('message-handler', () => {
  const enqueueDeliveryMetrics = vi.fn().mockResolvedValue({
    id: 'delivery-metrics-job-id'
  });

  const session = getMockSession();

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('handleMessage', () => {
    it('should handle incoming messages and distribute by event type', async () => {
      const messageHandler = new MessageHandler(mockApp, enqueueDeliveryMetrics);

      const event = 'custom';
      const data = {
        message: 'This is a test message body',
        timestamp: new Date().toISOString()
      };

      const message = {
        body: {
          nspRoomId: 'nsp:chat:one',
          event,
          data,
          requestId: '12345',
          session,
          latencyLog: {
            createdAt: '2023-09-21T08:00:00.000Z',
            receivedAt: '2023-09-21T08:00:00.000Z'
          }
        }
      };

      await messageHandler.handleMessage(message);

      expect(mockApp.publish).toHaveBeenCalledWith(
        event,
        JSON.stringify({
          type: event,
          body: data
        })
      );
    });
  });
});
