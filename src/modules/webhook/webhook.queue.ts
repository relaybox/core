import { Queue } from 'bullmq';
import { connectionOptionsIo } from '@/lib/redis';

const WEBHOOK_QUEUE_NAME = 'webhook';

const defaultQueueConfig = {
  streams: {
    events: {
      maxLen: 100
    }
  }
};

export enum WebhookJobName {
  WEBHOOK_DISPATCH = 'webhook:dispatch'
}

export const defaultJobConfig = { removeOnComplete: true, removeOnFail: false };

export const webhookQueue = new Queue(WEBHOOK_QUEUE_NAME, {
  connection: connectionOptionsIo,
  prefix: 'queue',
  ...defaultQueueConfig
});
