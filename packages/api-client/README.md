# @turnstile-portal/api-client

Type-safe API client for Turnstile API, generated from OpenAPI specification.

## Installation

```bash
npm install @turnstile-portal/api-client
# or
pnpm add @turnstile-portal/api-client
# or
yarn add @turnstile-portal/api-client
```

## Usage

### Basic Usage

```typescript
import { TurnstileApiClient } from '@turnstile-portal/api-client';

const client = new TurnstileApiClient({
  baseUrl: 'https://api.turnstile.xyz',
});
// or use predefined base URLs / helpers:
// const client = createSandboxClient();
// const client = new TurnstileApiClient({ baseUrl: SANDBOX_BASE_URL });

// Check service health
const health = await client.getHealth();

// Get a single token by address
const token = await client.getTokenByAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');

// Get paginated tokens
const response = await client.getTokens({ limit: 100, cursor: 0 });
console.log(response.data); // Array of tokens
console.log(response.pagination); // Pagination info
```

### Auto-pagination

```typescript
// Fetch all tokens (automatically handles pagination)
const allTokens = await client.getAllTokens();

// Fetch all bridged tokens
const bridgedTokens = await client.getAllBridgedTokens();

// Manual pagination with async iterator
for await (const token of client.getAllPages(
  (params) => client.getTokens(params),
  100 // limit per page
)) {
  console.log(token);
}
```

### Token Status Filters

```typescript
// Get proposed tokens
const proposed = await client.getProposedTokens({ limit: 50 });

// Get rejected tokens
const rejected = await client.getRejectedTokens({ limit: 50 });

// Get accepted tokens (not yet fully bridged)
const accepted = await client.getAcceptedTokens({ limit: 50 });

// Get fully bridged tokens
const bridged = await client.getBridgedTokens({ limit: 50 });
```

### Contract Operations

```typescript
// Get a contract instance by address
const contract = await client.getContract('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');

// Get a contract instance with artifact data included
const contractWithArtifact = await client.getContract(
  '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  true // includeArtifact
);

// Get a contract artifact by contract class ID or artifact hash
const artifact = await client.getArtifact('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');

// Get all contract instance addresses for a specific contract class
const instances = await client.getContractInstancesByClassId(
  '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  { match: 'any' },
);
console.log(instances.data); // Array of contract addresses
```

### Custom Headers and Fetch

```typescript
const client = new TurnstileApiClient({
  baseUrl: 'https://api.turnstile.xyz',
  headers: {
    'X-API-Key': 'your-api-key',
  },
  // Use custom fetch implementation (e.g., for Node.js < 18)
  fetch: customFetch,
});
```

## API Reference

### TurnstileApiClient

#### Constructor

```typescript
new TurnstileApiClient(config: ClientConfig)
```

**ClientConfig:**
- `baseUrl: string` - Base URL of the API
- `headers?: Record<string, string>` - Optional custom headers
- `fetch?: typeof fetch` - Optional custom fetch implementation

#### Methods

**Health & Status:**
- `getHealth()` - Check service health
- `getReady()` - Check service readiness (including database)

**Token Operations:**
- `getTokens(params?)` - Get paginated list of all tokens
- `getTokenByAddress(address)` - Get token by L1 or L2 address
- `getProposedTokens(params?)` - Get proposed tokens
- `getRejectedTokens(params?)` - Get rejected tokens
- `getAcceptedTokens(params?)` - Get accepted tokens
- `getBridgedTokens(params?)` - Get fully bridged tokens
- `getAllTokens(limit?)` - Get all tokens (auto-paginated)
- `getAllBridgedTokens(limit?)` - Get all bridged tokens (auto-paginated)

**Contract Operations:**
- `getContract(address, includeArtifact?)` - Get contract instance by address
- `getArtifact(identifier)` - Get contract artifact by contract class ID or artifact hash
- `getContractInstancesByClassId(contractClassId, query?)` - Get contract instance addresses with optional match scope (`current`, `original`, `any`)

**Utilities:**
- `getAllPages(fetcher, limit?)` - Async iterator for pagination

## Types

The client exports all necessary types:

```typescript
import type {
  Token,
  TokensResponse,
  ContractInstance,
  ContractArtifact,
  ContractInstancesResponse,
  HealthResponse,
  ReadyResponse,
  ErrorResponse,
  PaginationParams,
  ClientConfig,
} from '@turnstile-portal/api-client';
```

## Development

```bash
# Install dependencies
pnpm install

# Generate types from OpenAPI schema
pnpm generate

# Build the package
pnpm build

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Check code quality
pnpm check
```

## License

MIT
