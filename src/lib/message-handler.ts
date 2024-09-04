import { getLogger } from '../util/logger';
import { Logger } from 'winston';
import { ReducedSession } from '../types/session.types';
import { LatencyLog } from '../types/request.types';
import { TemplatedApp } from 'uWebSockets.js';

export default class MessageHandler {
  private app: TemplatedApp;
  private enqueueDeliveryMetrics: Function;

  private logger: Logger = getLogger('message-handler');

  constructor(app: TemplatedApp, enqueueDeliveryMetrics: Function) {
    this.app = app;
    this.enqueueDeliveryMetrics = enqueueDeliveryMetrics;

    this.logger.info(`Message handler initialized`);
  }

  public async handleMessage(msg: any) {
    this.logger.debug(`Received message from queue, preparing to distribute`, { msg });

    const { nspRoomId, event, data, requestId, session, latencyLog, service } = msg.body;

    try {
      this.emitAndLogMetrics(event, data, nspRoomId, requestId, session, latencyLog);
      this.emitAndLogMetrics(
        `${nspRoomId}:${service ? '$' : ''}:$:subscribe:all`,
        data,
        nspRoomId,
        requestId,
        session,
        latencyLog,
        event
      );
    } catch (err) {
      this.logger.error(`Message handler failed`, { msg, err });
      throw err;
    }
  }

  private formatMessageEventData(event: string, data: any): string {
    this.logger.debug(`Formatting message event data`, { event });

    const messageEventData = {
      type: event,
      body: data
    };

    return JSON.stringify(messageEventData);
  }

  private emitAndLogMetrics(
    event: string,
    data: any,
    nspRoomId: string,
    requestId: string,
    session: any,
    latencyLog: any,
    forEvent?: string
  ) {
    this.logger.debug(`Emitting log metrics`, { event });
    const messageEventData = this.formatMessageEventData(event, data);
    this.app.publish(event, messageEventData);
    this.handleDeliveryMetrics(nspRoomId, event, data, requestId, session, latencyLog, forEvent);
  }

  private async handleDeliveryMetrics(
    nspRoomId: string,
    event: string,
    data: any,
    requestId: string,
    session: ReducedSession,
    latencyLog: LatencyLog,
    forEvent?: string
  ): Promise<void> {
    try {
      const recipientCount = this.app.numSubscribers(event);

      if (!recipientCount) {
        return;
      }

      const job = await this.enqueueDeliveryMetrics(
        nspRoomId,
        forEvent || event,
        data,
        requestId,
        session,
        latencyLog,
        event,
        recipientCount
      );

      this.logger.info(`Message dispatched to ${recipientCount} sockets`, {
        nspRoomId,
        event,
        jobId: job.id
      });
    } catch (err) {
      this.logger.error(`Failed to enqueue delivery metrics`, {
        nspRoomId,
        event,
        err
      });

      throw err;
    }
  }
}
