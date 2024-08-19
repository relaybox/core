import { Queue } from 'bullmq';
import { connectionOptionsIo } from '../../lib/redis';

const SESSION_QUEUE_NAME = 'session';

const defaultQueueConfig = {
  streams: {
    events: {
      maxLen: 100
    }
  }
};

export enum SessionJobName {
  SESSION_DESTROY = 'session:destroy',
  SESSION_ACTIVE = 'session:active',
  SESSION_DISCONNECTED = 'session:disconnected',
  SESSION_USER_INACTIVE = 'session:user:inactive',
  SESSION_SOCKET_CONNECTION_EVENT = 'session:socket:connection_event',
  SESSION_HEARTBEAT = 'session:heartbeat'
}

export const defaultJobConfig = { removeOnComplete: true, removeOnFail: false };

export const sessionQueue = new Queue(SESSION_QUEUE_NAME, {
  connection: connectionOptionsIo,
  prefix: 'queue',
  ...defaultQueueConfig
});
