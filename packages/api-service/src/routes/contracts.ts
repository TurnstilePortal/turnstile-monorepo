import type { FastifyInstance } from 'fastify';
import {
  type ContractClassInstanceMatch,
  contractAddressParamsSchema,
  contractArtifactParamsSchema,
  contractArtifactSchema,
  contractClassIdParamsSchema,
  contractClassInstancesQueryParamsJsonSchema,
  contractClassInstancesQueryParamsSchema,
  contractInstanceSchema,
  contractInstancesResponseSchema,
  contractQueryParamsJsonSchema,
  contractQueryParamsSchema,
  errorResponseSchema,
  zodToJsonSchema,
} from '../schemas/index.js';
import {
  type ContractService,
  convertDbArtifactToApi,
  convertDbContractInstanceToApi,
} from '../services/contract-service.js';
import { CacheControl, normalizeAddress, sendError, sendJsonResponse } from '../utils/response.js';

export async function registerContractRoutes(fastify: FastifyInstance, contractService: ContractService) {
  fastify.get<{
    Params: { address: string };
    Querystring: { includeArtifact?: string };
  }>(
    '/contract/:address',
    {
      schema: {
        tags: ['Contracts'],
        summary: 'Get contract instance by address',
        description: 'Get a contract instance by its address, optionally including artifact data',
        params: zodToJsonSchema(contractAddressParamsSchema),
        querystring: zodToJsonSchema(contractQueryParamsJsonSchema),
        response: {
          200: zodToJsonSchema(contractInstanceSchema),
          400: zodToJsonSchema(errorResponseSchema),
          404: zodToJsonSchema(errorResponseSchema),
          500: zodToJsonSchema(errorResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const { address } = contractAddressParamsSchema.parse(request.params);
      const { includeArtifact } = contractQueryParamsSchema.parse(request.query);

      try {
        const normalized = normalizeAddress(address);
        const dbInstance = await contractService.getContractInstance(normalized);

        if (!dbInstance) {
          return sendError(reply, 404, 'Contract instance not found');
        }

        let artifact = null;
        if (includeArtifact) {
          artifact = await contractService.getContractArtifactByInstance(dbInstance);
        }

        const instance = convertDbContractInstanceToApi(dbInstance, includeArtifact, artifact || undefined);

        // Contract instances are immutable once deployed
        sendJsonResponse(reply, instance, CacheControl.IMMUTABLE);
      } catch (error) {
        if (error instanceof Error && error.message.includes('Invalid address format')) {
          return sendError(reply, 400, 'Invalid address format');
        }

        fastify.log.error('Failed to query contract instance');
        sendError(reply, 500, 'Database error');
      }
    },
  );

  fastify.get<{
    Params: { identifier: string };
  }>(
    '/artifact/:identifier',
    {
      schema: {
        tags: ['Contracts'],
        summary: 'Get contract artifact by identifier',
        description: 'Get a contract artifact by contract class ID or artifact hash',
        params: zodToJsonSchema(contractArtifactParamsSchema),
        response: {
          200: zodToJsonSchema(contractArtifactSchema),
          400: zodToJsonSchema(errorResponseSchema),
          404: zodToJsonSchema(errorResponseSchema),
          500: zodToJsonSchema(errorResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const { identifier } = contractArtifactParamsSchema.parse(request.params);

      try {
        // Validate identifier format (should be 66 character hex string)
        if (!/^0x[a-fA-F0-9]{64}$/.test(identifier)) {
          return sendError(reply, 400, 'Invalid identifier format - must be a 66 character hex string');
        }

        const dbArtifact = await contractService.getContractArtifact(identifier);

        if (!dbArtifact) {
          return sendError(reply, 404, 'Contract artifact not found');
        }

        const artifact = convertDbArtifactToApi(dbArtifact);

        // Contract artifacts are immutable
        sendJsonResponse(reply, artifact, CacheControl.IMMUTABLE);
      } catch (_error) {
        fastify.log.error('Failed to query contract artifact');
        sendError(reply, 500, 'Database error');
      }
    },
  );

  fastify.get<{
    Params: { contractClassId: string };
    Querystring: { match?: 'current' | 'original' | 'any' };
  }>(
    '/contracts/by-class/:contractClassId/addresses',
    {
      schema: {
        tags: ['Contracts'],
        summary: 'Get contract addresses for a class',
        description:
          'Get all contract instance addresses that match the given contract class ID with configurable match scope',
        params: zodToJsonSchema(contractClassIdParamsSchema),
        querystring: zodToJsonSchema(contractClassInstancesQueryParamsJsonSchema),
        response: {
          200: zodToJsonSchema(contractInstancesResponseSchema),
          400: zodToJsonSchema(errorResponseSchema),
          500: zodToJsonSchema(errorResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const { contractClassId } = contractClassIdParamsSchema.parse(request.params);
      const { match } = contractClassInstancesQueryParamsSchema.parse(request.query);
      const matchScope: ContractClassInstanceMatch = match ?? 'current';

      try {
        // Validate contractClassId format
        if (!/^0x[a-fA-F0-9]{64}$/.test(contractClassId)) {
          return sendError(reply, 400, 'Invalid contract class ID format - must be a 66 character hex string');
        }

        const addresses = await contractService.getContractInstancesByClassId(contractClassId, matchScope);

        // Contract instances are immutable, cache for a reasonable time
        sendJsonResponse(reply, addresses, CacheControl.PUBLIC_5MIN);
      } catch (_error) {
        fastify.log.error('Failed to query contract instances by class ID');
        sendError(reply, 500, 'Database error');
      }
    },
  );
}
