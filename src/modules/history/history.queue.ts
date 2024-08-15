import { Queue } from 'bullmq';

const HISTORY_QUEUE_NAME = 'history';

const connectionOpts = {
  host: process.env.REDIS_HOST!,
  port: Number(process.env.REDIS_PORT!)
};

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

export const defaultJobConfig = {
  removeOnComplete: true,
  removeOnFail: false
};

export const historyQueue = new Queue(HISTORY_QUEUE_NAME, {
  connection: connectionOpts,
  prefix: 'queue',
  ...defaultQueueConfig
});
