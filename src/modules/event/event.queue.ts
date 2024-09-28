import { Queue } from 'bullmq';
import { connectionOptionsIo } from '@/lib/redis';

const EVENT_QUEUE_NAME = 'event';

const defaultQueueConfig = {
  streams: {
    events: {
      maxLen: 100
    }
  }
};

export enum BroadcastJobName {
  EVENT_PUBLISH = 'event:publish'
}

export const defaultJobConfig = { removeOnComplete: true, removeOnFail: false };

export const eventQueue = new Queue(EVENT_QUEUE_NAME, {
  connection: connectionOptionsIo,
  prefix: 'queue',
  ...defaultQueueConfig
});
