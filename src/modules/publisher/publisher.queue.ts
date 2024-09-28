import { Queue } from 'bullmq';
import { connectionOptionsIo } from '@/lib/redis';

const PUBLISHER_QUEUE_NAME = 'publisher';

const defaultQueueConfig = {
  streams: {
    events: {
      maxLen: 100
    }
  }
};

export enum PublisherJobName {
  PUBLISH_EVENT = 'publish:event'
}

export const defaultJobConfig = { removeOnComplete: true, removeOnFail: false };

export const publisherQueue = new Queue(PUBLISHER_QUEUE_NAME, {
  connection: connectionOptionsIo,
  prefix: 'queue',
  ...defaultQueueConfig
});
