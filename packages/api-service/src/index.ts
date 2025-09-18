import cors from '@fastify/cors';
import env from '@fastify/env';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { createDbClient } from '@turnstile-portal/api-common';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { registerContractRoutes } from './routes/contracts.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerTokenRoutes } from './routes/tokens.js';
import { ContractService } from './services/contract-service.js';
import { TokenService } from './services/token-service.js';

function normalizePrefix(input?: string): string {
  if (!input) return '';
  const withLeading = input.startsWith('/') ? input : `/${input}`;
  return withLeading.endsWith('/') ? withLeading.slice(0, -1) : withLeading;
}

async function createServer() {
  const fastify = Fastify({
    logger: true,
  });

  // Register plugins
  await fastify.register(env, {
    schema: {
      type: 'object',
      required: ['DATABASE_URL'],
      properties: {
        DATABASE_URL: { type: 'string' },
        PORT: { type: 'string', default: '8080' },
        API_ROUTE_PREFIX: { type: 'string', default: '' },
      },
    },
  });

  await fastify.register(cors, {
    origin: true,
  });

  // Create database client
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  const db = createDbClient(databaseUrl);
  const tokenService = new TokenService(db);
  const contractService = new ContractService(db);

  const apiPrefix = normalizePrefix(process.env.API_ROUTE_PREFIX);
  let getSwagger: (() => unknown) | undefined;

  // Register prefixed routes and Swagger under a child instance
  await fastify.register(
    async (app: FastifyInstance) => {
      await app.register(swagger, {
        openapi: {
          openapi: '3.0.0',
          info: {
            title: 'Turnstile API',
            description: 'Token bridge system for Ethereum L1 and Aztec L2 networks',
            version: '1.0.0',
          },
          servers: [
            {
              url: apiPrefix || '/',
              description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
            },
          ],
          tags: [
            { name: 'Tokens', description: 'Token operations' },
            { name: 'Contracts', description: 'Contract operations' },
          ],
          components: {
            securitySchemes: {},
          },
        },
      });

      await app.register(swaggerUi, {
        routePrefix: '/documentation',
        indexPrefix: apiPrefix || '',
        uiConfig: {
          docExpansion: 'list',
          deepLinking: false,
        },
        staticCSP: true,
        transformSpecificationClone: true,
      });

      await registerTokenRoutes(app, tokenService);
      await registerContractRoutes(app, contractService);

      getSwagger = () => app.swagger();
    },
    { prefix: apiPrefix },
  );

  // Register unprefixed routes
  await registerHealthRoutes(fastify, tokenService);

  // Generate OpenAPI spec file if requested
  if (process.env.GENERATE_OPENAPI === 'true') {
    await fastify.ready();
    const spec = typeof getSwagger === 'function' ? getSwagger() : fastify.swagger();
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const specPath = path.join(process.cwd(), 'openapi.generated.json');
    await fs.writeFile(specPath, JSON.stringify(spec, null, 2));
    console.log(`OpenAPI spec generated at: ${specPath}`);
    process.exit(0);
  }

  return fastify;
}

async function start() {
  try {
    const fastify = await createServer();

    const port = Number.parseInt(process.env.PORT || '8080', 10);
    const host = '0.0.0.0';

    await fastify.listen({ port, host });
    console.log(`Server running on http://${host}:${port}`);
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

// Start the server
start();
