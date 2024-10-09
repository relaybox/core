import { JobsOptions, Queue } from 'bullmq';
import { connectionOptionsIo } from '@/lib/redis';

const METRICS_QUEUE_NAME = 'metrics';

const defaultQueueConfig = {
  streams: {
    events: {
      maxLen: 100
    }
  }
};

export enum MetricsJobName {
  METRICS_PUSH = 'metrics:push',
  METRICS_SHIFT = 'metrics:shift',
  METRICS_DELIVERY_DATA = 'metrics:delivery:data',
  METRICS_CLIENT_ROOM_JOIN = 'metrics:client:room:join',
  METRICS_CLIENT_ROOM_LEAVE = 'metrics:client:room:leave'
}

export const defaultJobConfig: JobsOptions = {
  removeOnComplete: true,
  removeOnFail: false
};

export const metricsQueue = new Queue(METRICS_QUEUE_NAME, {
  connection: connectionOptionsIo,
  prefix: 'queue',
  ...defaultQueueConfig
});
