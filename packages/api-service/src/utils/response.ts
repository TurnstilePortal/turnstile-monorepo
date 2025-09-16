import type { FastifyReply } from 'fastify';

export const CacheControl = {
  IMMUTABLE: 'public, max-age=31536000, immutable',
  PUBLIC_5MIN: 'public, max-age=300',
  NO_CACHE: 'no-cache',
} as const;

export function sendJsonResponse(reply: FastifyReply, data: unknown, cacheControl?: string): FastifyReply {
  return reply
    .header('Content-Type', 'application/json')
    .header('Cache-Control', cacheControl || CacheControl.PUBLIC_5MIN)
    .send(data);
}

export function sendError(reply: FastifyReply, statusCode: number, message: string): FastifyReply {
  return reply.code(statusCode).send({ error: message });
}

export function normalizeAddress(address: string): string {
  if (!address.startsWith('0x')) {
    throw new Error('Invalid address format: must start with 0x');
  }
  return address.toLowerCase();
}
