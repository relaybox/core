import winston, { format } from 'winston';

const { printf, combine, timestamp, errors, colorize: winstonColorize } = format;

export enum LogLevel {
  LOG = 'log',
  INFO = 'info',
  WARN = 'warn',
  DEBUG = 'debug'
}

const easyLogFormat = printf((info) => {
  const { level, service, message } = info;

  let baseLog = `[${level}]:${new Date().toISOString().slice(11)} ${service} - ${message}`;

  if (info.err && info.err.stack) {
    baseLog += `\n${info.err.stack}`;
  }

  return baseLog;
});

const easyPrint = new winston.transports.Console({
  level: process.env.LOG_LEVEL || LogLevel.INFO,
  format: combine(errors({ stack: true }), timestamp(), winstonColorize(), easyLogFormat)
});

const flatPrint = new winston.transports.Console({
  level: process.env.LOG_LEVEL || LogLevel.INFO,
  format: combine(timestamp(), errors({ stack: true }))
});

const transports = process.env.LOCALHOST === 'true' ? [easyPrint] : [flatPrint];

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || LogLevel.INFO,
  transports
});

export function getLogger(service: string) {
  return logger.child({ service });
}
