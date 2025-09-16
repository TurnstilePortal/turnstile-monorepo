import type { FastifyInstance } from 'fastify';
import {
  errorResponseSchema,
  paginatedTokenResponseSchema,
  paginationParamsJsonSchema,
  paginationParamsSchema,
  tokenAddressParamsSchema,
  tokenSchema,
  zodToJsonSchema,
} from '../schemas/index.js';
import { convertDbTokenToApi, isTokenComplete, type TokenService } from '../services/token-service.js';
import { createPaginatedResponse } from '../utils/pagination.js';
import { CacheControl, normalizeAddress, sendError, sendJsonResponse } from '../utils/response.js';

export async function registerTokenRoutes(fastify: FastifyInstance, tokenService: TokenService) {
  fastify.get<{
    Querystring: { limit?: string; cursor?: string };
  }>(
    '/tokens',
    {
      schema: {
        tags: ['Tokens'],
        summary: 'List all tokens',
        description: 'Get a paginated list of all tokens',
        querystring: zodToJsonSchema(paginationParamsJsonSchema),
        response: {
          200: zodToJsonSchema(paginatedTokenResponseSchema),
          500: zodToJsonSchema(errorResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const { limit, cursor } = paginationParamsSchema.parse(request.query);

      try {
        const dbTokens = await tokenService.getTokens(cursor, limit);
        const apiTokens = dbTokens.map((token) => convertDbTokenToApi(token, true));
        const response = createPaginatedResponse(apiTokens, limit, cursor, (token) => token.id || 0);

        sendJsonResponse(reply, response);
      } catch (_error) {
        fastify.log.error('Failed to query tokens');
        sendError(reply, 500, 'Database error');
      }
    },
  );

  fastify.get<{
    Params: { address: string };
  }>(
    '/tokens/:address',
    {
      schema: {
        tags: ['Tokens'],
        summary: 'Get token by address',
        description: 'Get a token by its L1 or L2 address',
        params: zodToJsonSchema(tokenAddressParamsSchema),
        response: {
          200: zodToJsonSchema(tokenSchema),
          400: zodToJsonSchema(errorResponseSchema),
          404: zodToJsonSchema(errorResponseSchema),
          500: zodToJsonSchema(errorResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const { address } = tokenAddressParamsSchema.parse(request.params);

      try {
        const normalized = normalizeAddress(address);
        const dbTokens = await tokenService.getTokenByAddress(normalized);

        if (dbTokens.length === 0 || !dbTokens[0]) {
          return sendError(reply, 404, 'Token not found');
        }

        const token = convertDbTokenToApi(dbTokens[0]);
        const cacheControl = isTokenComplete(token) ? CacheControl.IMMUTABLE : CacheControl.PUBLIC_5MIN;

        sendJsonResponse(reply, token, cacheControl);
      } catch (error) {
        if (error instanceof Error && error.message.includes('Invalid address format')) {
          return sendError(reply, 400, 'Invalid address format');
        }

        fastify.log.error('Failed to query token');
        sendError(reply, 500, 'Database error');
      }
    },
  );

  fastify.get<{
    Querystring: { limit?: string; cursor?: string };
  }>(
    '/tokens/proposed',
    {
      schema: {
        tags: ['Tokens'],
        summary: 'List proposed tokens',
        description: 'Get a paginated list of tokens with PROPOSED status',
        querystring: zodToJsonSchema(paginationParamsJsonSchema),
        response: {
          200: zodToJsonSchema(paginatedTokenResponseSchema),
          500: zodToJsonSchema(errorResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const { limit, cursor } = paginationParamsSchema.parse(request.query);

      try {
        const dbTokens = await tokenService.getProposedTokens(cursor, limit);
        const apiTokens = dbTokens.map((token) => convertDbTokenToApi(token, true));
        const response = createPaginatedResponse(apiTokens, limit, cursor, (token) => token.id || 0);

        sendJsonResponse(reply, response);
      } catch (_error) {
        fastify.log.error('Failed to query proposed tokens');
        sendError(reply, 500, 'Database error');
      }
    },
  );

  fastify.get<{
    Querystring: { limit?: string; cursor?: string };
  }>(
    '/tokens/rejected',
    {
      schema: {
        tags: ['Tokens'],
        summary: 'List rejected tokens',
        description: 'Get a paginated list of tokens with REJECTED status',
        querystring: zodToJsonSchema(paginationParamsJsonSchema),
        response: {
          200: zodToJsonSchema(paginatedTokenResponseSchema),
          500: zodToJsonSchema(errorResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const { limit, cursor } = paginationParamsSchema.parse(request.query);

      try {
        const dbTokens = await tokenService.getRejectedTokens(cursor, limit);
        const apiTokens = dbTokens.map((token) => convertDbTokenToApi(token, true));
        const response = createPaginatedResponse(apiTokens, limit, cursor, (token) => token.id || 0);

        sendJsonResponse(reply, response);
      } catch (_error) {
        fastify.log.error('Failed to query rejected tokens');
        sendError(reply, 500, 'Database error');
      }
    },
  );

  fastify.get<{
    Querystring: { limit?: string; cursor?: string };
  }>(
    '/tokens/accepted',
    {
      schema: {
        tags: ['Tokens'],
        summary: 'List accepted tokens',
        description: 'Get a paginated list of tokens with ACCEPTED status that are not yet fully bridged',
        querystring: zodToJsonSchema(paginationParamsJsonSchema),
        response: {
          200: zodToJsonSchema(paginatedTokenResponseSchema),
          500: zodToJsonSchema(errorResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const { limit, cursor } = paginationParamsSchema.parse(request.query);

      try {
        const dbTokens = await tokenService.getAcceptedTokens(cursor, limit);
        const apiTokens = dbTokens.map((token) => convertDbTokenToApi(token, true));
        const response = createPaginatedResponse(apiTokens, limit, cursor, (token) => token.id || 0);

        sendJsonResponse(reply, response);
      } catch (_error) {
        fastify.log.error('Failed to query accepted tokens');
        sendError(reply, 500, 'Database error');
      }
    },
  );

  fastify.get<{
    Querystring: { limit?: string; cursor?: string };
  }>(
    '/tokens/bridged',
    {
      schema: {
        tags: ['Tokens'],
        summary: 'List bridged tokens',
        description: 'Get a paginated list of fully bridged tokens (with both L1 and L2 addresses)',
        querystring: zodToJsonSchema(paginationParamsJsonSchema),
        response: {
          200: zodToJsonSchema(paginatedTokenResponseSchema),
          400: zodToJsonSchema(errorResponseSchema),
          500: zodToJsonSchema(errorResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const limitParam = request.query.limit;
      const cursorParam = request.query.cursor;

      const limit = limitParam ? Math.min(Math.max(1, Number.parseInt(limitParam, 10)), 1000) : 100;
      const cursor = cursorParam ? Number.parseInt(cursorParam, 10) : 0;

      if (Number.isNaN(limit) || Number.isNaN(cursor)) {
        return sendError(reply, 400, 'Invalid pagination parameters');
      }

      try {
        const dbTokens = await tokenService.getBridgedTokens(cursor, limit);
        const apiTokens = dbTokens.map((token) => convertDbTokenToApi(token, true));
        const response = createPaginatedResponse(apiTokens, limit, cursor, (token) => token.id || 0);

        sendJsonResponse(reply, response);
      } catch (_error) {
        fastify.log.error('Failed to query bridged tokens');
        sendError(reply, 500, 'Database error');
      }
    },
  );
}
