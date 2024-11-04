import { HttpRequest, HttpResponse, WebSocket } from 'uWebSockets.js';
import {
  getErrorResponse,
  getHeaders,
  getPathParams,
  getQueryParams,
  parseRequestBody
} from '@/util/http';
import { EventHandler } from './handlers';
import { SocketAckHandler } from '@/types/socket.types';
import { getLogger } from '@/util/logger';
import { formatErrorResponse } from '@/util/format';
import { Session } from '@/types/session.types';

const logger = getLogger('middleware');

const DEFAULT_MIDDLEWARE_TIMEOUT_MS = 5000;

export interface ParsedHttpRequest {
  method: string;
  query: Record<string, string>;
  params: string[];
  headers: Record<string, string>;
  url: string;
  body: any;
  [key: string]: any;
}

export type HttpMiddleware = (
  res: HttpResponse,
  req: ParsedHttpRequest,
  next: HttpMiddlewareNext
) => Promise<void> | void;

export type HttpRequestHandler = (res: HttpResponse, req: HttpRequest) => Promise<void>;
export type HttpMiddlewareNext = (extendRequest?: Record<string, any>) => Promise<void> | void;

export function pipe(...middlewares: HttpMiddleware[]): HttpRequestHandler {
  return async (res: HttpResponse, req: HttpRequest) => {
    let aborted = false;

    res.onAborted(() => {
      res.cork(() => res.end());
    });

    // Capture all necessary request data (like headers) before introducing any async code.
    // Reference: https://github.com/uNetworking/uWebSockets.js/discussions/84

    const method = req.getMethod();
    const query = getQueryParams(req);
    const params = getPathParams(req);
    const headers = getHeaders(req);
    const url = req.getUrl();
    const body = await parseRequestBody(res);

    const parsedRequest: ParsedHttpRequest = {
      method,
      query,
      params,
      headers,
      url,
      body
    };

    async function dispatch(i: number, currentRequest: ParsedHttpRequest) {
      if (aborted) {
        return;
      }

      const nextMiddleware = middlewares[i];

      const { requestTimeout, clearRequestTimeout } = getMiddlewareTimeout();

      try {
        await Promise.race([
          requestTimeout,
          nextMiddleware(res, currentRequest, (nextRequest?: Record<string, any>) =>
            dispatch(i + 1, {
              ...currentRequest,
              ...(nextRequest || {})
            })
          )
        ]);

        return;
      } catch (err: unknown) {
        aborted = true;
        res.cork(() => getErrorResponse(res, err));
        return;
      } finally {
        clearRequestTimeout();
      }
    }

    dispatch(0, parsedRequest);
  };
}

export function compose(...middlewares: EventHandler[]): EventHandler {
  return async (
    socket: WebSocket<Session>,
    body: any,
    res: SocketAckHandler,
    createdAt?: string,
    byteLength?: number
  ): Promise<void> => {
    for (const middleware of middlewares) {
      const { requestTimeout, clearRequestTimeout } = getMiddlewareTimeout();

      try {
        await Promise.race([requestTimeout, middleware(socket, body, res, createdAt, byteLength)]);
      } catch (err: any) {
        logger.error(`Failed to handle socket message`, { err });

        if (res) {
          res(null, formatErrorResponse(err));
        }

        return;
      } finally {
        clearRequestTimeout();
      }
    }
  };
}

function getMiddlewareTimeout(duration = DEFAULT_MIDDLEWARE_TIMEOUT_MS) {
  let timeoutId: NodeJS.Timeout;

  const requestTimeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Timeout occurred'));
    }, duration);
  });

  return {
    requestTimeout,
    clearRequestTimeout: () => clearTimeout(timeoutId)
  };
}
