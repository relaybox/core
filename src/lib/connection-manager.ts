import { Logger } from 'winston';
import { Connection } from 'rabbitmq-client';
import { getLogger } from '@/util/logger';

export default class ConnectionManager {
  private static instance: ConnectionManager | null;
  private connection: Connection | null;
  private logger: Logger = getLogger('connection-manager');

  private constructor() {}

  public static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }

    return ConnectionManager.instance;
  }

  public static destroyInstance() {
    if (ConnectionManager.instance) {
      ConnectionManager.instance.connection = null;
    }

    ConnectionManager.instance = null;
  }

  public connect(connectionString: string): Connection {
    this.connection = new Connection(connectionString);

    this.connection.on('error', (err: any) => {
      this.logger.error(`Connection error`, { err });
    });

    return this.connection;
  }

  public getConnection(): Connection | null {
    return this.connection;
  }
}
