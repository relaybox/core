import { HttpResponse } from 'uWebSockets.js';

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
      const curBuf = Buffer.from(chunk);

      buffer = buffer ? Buffer.concat([buffer, curBuf]) : isLast ? curBuf : Buffer.concat([curBuf]);

      if (isLast) {
        resolve(buffer.toString());
      }
    });
  });
}
