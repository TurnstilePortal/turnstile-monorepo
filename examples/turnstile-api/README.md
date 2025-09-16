# Turnstile API

Token bridge system for Ethereum L1 and Aztec L2 networks that now ships as part of the Turnstile contracts monorepo.

## Packages

- **`packages/api-service`** – Fastify REST API with OpenAPI generation
  - `/api/v1/tokens` – List tokens with optional `limit` and `offset`
  - `/api/v1/tokens/:address` – Look up a token by its L1 or L2 address
  - `/api/v1/tokens/bridged` – Cursor-paginated list of bridged tokens with complete metadata
  - `/health` – Liveness probe
  - `/ready` – Includes database connectivity checks
- **`packages/collector`** – Blockchain data collectors for Ethereum L1 and Aztec L2
- **`packages/api-common`** – Shared Drizzle ORM schema, migrations, and helpers
- **`packages/api-client`** – Type-safe client bindings generated from the OpenAPI spec

Database models live in `packages/api-common/src/schema.ts`. See `packages/api-common/README.md` for migration workflow details.

## Local Development

```bash
# Install dependencies for the full workspace
pnpm install

# Apply database migrations (requires DATABASE_URL)
cd packages/api-common
pnpm migrate

# Start the API server
DATABASE_URL=postgres://user:pass@localhost:5432/turnstile \
pnpm --filter @turnstile-portal/api-service dev

# Start the collector
pnpm --filter @turnstile-portal/collector dev
```

Run `pnpm test` from the repository root to execute the Vitest suites, or target a specific package with `pnpm --filter <package> test`.

## Environment Variables

Copy one of the sample files in this directory (`.env.sandbox`, `.env.testnet`, `.env.mainnet`) and adjust the connection details:

- `DATABASE_URL` – PostgreSQL connection string
- `PORT` – API server port (defaults to `8080`)
- Collector settings such as `NETWORK`, `L1_RPC_URL`, `L2_NODE_URL`, and polling configuration

## Docker Compose

A Compose setup for running Postgres, migrations, collectors, and the API together lives in `docker/turnstile-api/docker-compose.yml`. Use it from the repository root:

```bash
docker compose -f docker/turnstile-api/docker-compose.yml up --build
```

Pass `--profile` flags or override environment variables as needed to tailor the deployment.
