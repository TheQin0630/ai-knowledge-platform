import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export interface ContextualRequest extends Request {
  requestId: string;
}

export function requestContextMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const requestId = randomUUID();
  (request as ContextualRequest).requestId = requestId;
  response.setHeader('X-Request-Id', requestId);
  next();
}
