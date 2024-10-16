import { WebhookJobName, defaultJobConfig, webhookQueue } from './webhook.queue';
import { getLogger } from '@/util/logger';
import { Session } from '@/types/session.types';
import { v4 as uuid } from 'uuid';
import { ReducedWebhookSessionData, WebhookEvent, WebhookPayload } from '@/types/webhook.types';
import { Job } from 'bullmq';
import { getExternalClientId } from '@/util/helpers';

const logger = getLogger('webhook');

function getReducedWebhookSessionData(session: Session): ReducedWebhookSessionData {
  const { appPid, keyId, clientId, connectionId, socketId, timestamp, user, exp } = session;

  const externalClientId = getExternalClientId(clientId);

  return {
    appPid,
    keyId,
    clientId: externalClientId,
    connectionId,
    socketId,
    timestamp,
    exp,
    user: user || null
  };
}

export async function enqueueWebhookEvent(
  event: WebhookEvent,
  data: any,
  session: Session,
  filterAttributes?: Record<string, unknown>
): Promise<Job> {
  const id = uuid();
  const timestamp = new Date().toISOString();

  logger.debug(`Enqueuing webhook event ${id}, "${event}"`, { id, event, session });

  const reducedWebhookSessionData = getReducedWebhookSessionData(session);

  const jobData: WebhookPayload = {
    id,
    event,
    timestamp,
    data,
    session: reducedWebhookSessionData,
    filterAttributes
  };

  return webhookQueue.add(WebhookJobName.WEBHOOK_PROCESS, jobData, defaultJobConfig);
}
