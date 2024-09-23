import { Queue } from 'bullmq';
import { connectionOptionsIo } from '@/lib/redis';

const PRESENCE_QUEUE_NAME = 'presence';

const defaultQueueConfig = {
  streams: {
    events: {
      maxLen: 100
    }
  }
};

export enum PresenceJobName {
  PRESENCE_JOIN = 'presence:join',
  PRESENCE_LEAVE = 'presence:leave',
  PRESENCE_UPDATE = 'presence:update'
}

export const defaultJobConfig = { removeOnComplete: true, removeOnFail: false };

export const presenceQueue = new Queue(PRESENCE_QUEUE_NAME, {
  connection: connectionOptionsIo,
  prefix: 'queue',
  ...defaultQueueConfig
});
