import { JobsOptions, Queue } from 'bullmq';
import { connectionOptionsIo } from '@/lib/redis';

const EVENTS_QUEUE_NAME = 'events';

const defaultQueueConfig = {
  streams: {
    events: {
      maxLen: 100
    }
  }
};

export enum EventsJobName {
  EVENT_PUBLISH = 'event:publish'
}

export const defaultJobConfig: JobsOptions = {
  removeOnComplete: true,
  removeOnFail: false
};

export const eventsQueue = new Queue(EVENTS_QUEUE_NAME, {
  connection: connectionOptionsIo,
  prefix: 'queue',
  ...defaultQueueConfig
});
