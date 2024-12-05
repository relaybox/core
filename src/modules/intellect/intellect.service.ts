import { Job } from 'bullmq';
import { Logger } from 'winston';
import { v4 as uuid } from 'uuid';
import { defaultJobConfig, IntellectJobName, intellectQueue } from './intellect.queue';
import { IntellectPayloadOptions, IntellectPublishOptions } from './intellect.types';
import { Session } from '@/types/session.types';
import { getReducedSession } from '../session/session.service';

export async function enqueueIntellectEvent(
  logger: Logger,
  appPid: string,
  roomId: string,
  session: Session,
  opts: IntellectPublishOptions
): Promise<Job> {
  logger.debug(`Enqueuing intellect event`, { opts });

  const id = uuid();
  const timestamp = new Date().toISOString();
  const reducedSession = getReducedSession(session);

  try {
    const jobData: IntellectPayloadOptions = {
      ...opts,
      id,
      timestamp,
      appPid,
      roomId,
      session: reducedSession
    };

    return intellectQueue.add(IntellectJobName.INTELLECT_INPUT_BASIC, jobData, defaultJobConfig);
  } catch (err: any) {
    logger.error(`Failed to enqueue intellect event`, { err });
    throw err;
  }
}
