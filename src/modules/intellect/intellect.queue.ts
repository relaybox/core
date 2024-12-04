import { JobsOptions, Queue } from 'bullmq';
import { connectionOptionsIo } from '@/lib/redis';

const INTELLECT_QUEUE_NAME = 'intellect';

const defaultQueueConfig = {
  streams: {
    events: {
      maxLen: 100
    }
  }
};

export enum IntellectJobName {
  INTELLECT_INPUT_BASIC = 'intellect:input:basic'
}

export const defaultJobConfig: JobsOptions = {
  removeOnComplete: true,
  removeOnFail: false
};

export const intellectQueue = new Queue(INTELLECT_QUEUE_NAME, {
  connection: connectionOptionsIo,
  prefix: 'queue',
  ...defaultQueueConfig
});

intellectQueue.on('error', (err) => {
  console.log(`Itellect queue error`, { err });
});
