import { Queue } from 'bullmq';

const connectionOpts = {
  host: process.env.REDIS_HOST!,
  port: Number(process.env.REDIS_PORT!)
};

const SUBSCRIPTION_QUEUE_NAME = 'subscription';

const defaultQueueConfig = {
  streams: {
    events: {
      maxLen: 100
    }
  }
};

export enum SubscriptionJobName {
  SUBSCRIPTION_CREATE = 'subscription:create',
  SUBSCRIPTION_DELETE = 'subscription:delete',
  SUBSCRIPTION_DELETE_BATCH = 'subscription:delete:batch'
}

export const defaultJobConfig = { removeOnComplete: true, removeOnFail: false };

export const subscriptionQueue = new Queue(SUBSCRIPTION_QUEUE_NAME, {
  connection: connectionOpts,
  prefix: 'queue',
  ...defaultQueueConfig
});
