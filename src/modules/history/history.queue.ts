import { JobsOptions, Queue } from 'bullmq';
import { connectionOptionsIo } from '@/lib/redis';

const HISTORY_QUEUE_NAME = 'history';

const defaultQueueConfig = {
  streams: {
    events: {
      maxLen: 100
    }
  }
};

export enum HistoryJobName {
  HISTORY_TTL = 'history:ttl'
}

export const defaultJobConfig: JobsOptions = {
  removeOnComplete: true,
  removeOnFail: false
};

export const historyQueue = new Queue(HISTORY_QUEUE_NAME, {
  connection: connectionOptionsIo,
  prefix: 'queue',
  ...defaultQueueConfig
});
