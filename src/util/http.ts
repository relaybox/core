import { BadRequestError } from '@/lib/errors';
import { HttpRequest, HttpResponse } from 'uWebSockets.js';

interface ErrorResponseBody {
  statusCode: number;
  name: string;
  message?: string;
}

export function getJsonResponse(res: HttpResponse, status: string) {
  res.writeStatus(status);
  res.writeHeader('Content-Type', 'application/json');
  res.writeHeader('Access-Control-Allow-Origin', '*');

  return res;
}

export function getCorsResponse(res: HttpResponse) {
  res.writeHeader('Access-Control-Allow-Origin', '*');
  res.writeHeader('Access-Control-Allow-Headers', 'Content-Type');

  return res;
}

export function parseRequestBody(res: HttpResponse): any {
  return new Promise<string>((resolve) => {
    let buffer: Buffer;

    res.onData((chunk, isLast) => {
      const currentBuffer = Buffer.from(chunk);

      buffer = buffer
        ? Buffer.concat([buffer, currentBuffer])
        : isLast
        ? currentBuffer
        : Buffer.concat([currentBuffer]);

      if (isLast) {
        resolve(buffer.toString());
      }
    });
  });
}

export function getHeader(req: HttpRequest, key: string): string | undefined {
  return req.getHeader(key) || req.getHeader(key.toLowerCase());
}

export function getSuccessResponse(res: HttpResponse, body?: any): HttpResponse {
  return getJsonResponse(res, '200 OK').end(JSON.stringify(body));
}

export function getErrorResponse(res: HttpResponse, err: unknown): HttpResponse {
  if (err instanceof BadRequestError) {
    return getJsonResponse(res, '400 Bad Request').end(
      JSON.stringify(formatErrorResponseBody(400, err))
    );
  }

  return getJsonResponse(res, '500 Bad Request').end();
}

export function formatErrorResponseBody(statusCode: number, err: unknown): ErrorResponseBody {
  if (err instanceof Error) {
    return {
      statusCode,
      name: err.name,
      message: err.message
    };
  }

  return {
    statusCode: 500,
    name: 'InternalServerError'
  };
}
