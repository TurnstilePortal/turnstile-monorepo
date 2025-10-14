# Turnstile Deploy Package

This package provides tools for deploying Turnstile contracts to various environments including local sandbox and testnets.

## Architecture

The deploy package is designed with an environment-based architecture that makes it easy to support different deployment environments. The main components are:

- **Environment Configuration** - JSON files that specify how to connect to different environments
- **Environment Implementations** - Code specific to each environment (local, testnet, etc.)
- **Common Deployment Workflow** - Shared deployment logic for all environments

## Usage

### Deploying to Local Sandbox

```bash
# Start a fresh deployment to local sandbox
pnpm tsx packages/deploy/src/scripts/deploy-sandbox.ts

# Or use the CLI directly
pnpm tsx packages/deploy/src/cli.ts deploy -e packages/deploy/examples/local.json \
  -k docker/turnstile-sandbox/sandbox-keys.json \
  -d sandbox_deployment.json \
  --with-tokens \
  --setup-sandbox
```

### Deploying to Testnet

```bash
# Deploy to testnet using environment variables for configuration
TESTNET_KEYS=keys/testnet-keys.json \
TESTNET_CONFIG=packages/deploy/examples/testnet.json \
DEPLOYMENT_FILE=testnet_deployment.json \
WITH_TOKENS=true \
pnpm tsx packages/deploy/src/scripts/deploy-testnet.ts

# Or use the CLI directly
pnpm tsx packages/deploy/src/cli.ts deploy -e packages/deploy/examples/testnet.json \
  -k keys/testnet-keys.json \
  -d testnet_deployment.json \
  --with-tokens
```

## Configuration

### Environment Configuration

Each environment is configured using a JSON file. Example configuration files are provided in the `examples` directory:

- `local.json` - Configuration for local sandbox development
- `testnet.json` - Configuration for testnet deployment

### Key Files

Private keys and account information are stored in separate JSON files:

```json
{
  "l1PrivateKey": "0x...",
  "l2PrivateKey": "0x...",
  "l2SecretKey": "0x...",
  "l1Address": "0x...",
  "l2Address": "0x..."
}
```

## Adding New Environments

To add support for a new environment:

1. Create a new implementation class in `src/environments/`
2. Register the implementation in `src/environments/index.ts`
3. Create a configuration file for the new environment

## Core Components

- `DeploymentEnvironment` - Base class that defines the interface for all environments
- `LocalEnvironment` - Implementation for local sandbox environments
- `TestnetEnvironment` - Implementation for testnet environments

### Configuration File Structure

The `config.json` file uses a unified format for all environments:

```json
{
  "name": "Environment Name",
  "connection": {
    "ethereum": {
      "rpc": "http://example.com/eth-rpc",
      "chainId": 31337
    },
    "aztec": {
      "pxe": "http://example.com/pxe",
      "registryAddress": "0x1234...",  // Required for deployment
      "rollupAddress": "0x5678..."     // Additional Aztec addresses
    }
  },
  "deployment": {
    "overwrite": false,           // Whether to overwrite existing deployment data
    "generateKeysIfMissing": true, // Auto-generate keys if not found
    "tokens": {                   // Tokens to deploy (empty = no tokens)
      "DAI": { "name": "DAI", "symbol": "DAI", "decimals": 18 },
      "USDC": { "name": "USD Coin", "symbol": "USDC", "decimals": 6 }
    }
  }
}
```

### Usage

```bash
# Basic deployment with environment name
pnpm tsx packages/deploy/src/cli.ts deploy --env sandbox

# Using a custom config directory
pnpm tsx packages/deploy/src/cli.ts deploy --env devnet --config-dir ./my-configs

# Force overwrite of existing deployments
pnpm tsx packages/deploy/src/cli.ts deploy --env testnet --overwrite
```

### Environment Examples

Example configuration files for different environments are provided in `packages/deploy/examples/config-examples/`:

- `sandbox/config.json` - Local sandbox environment configuration
- `devnet/config.json` - Devnet environment configuration
- `testnet/config.json` - Testnet environment configuration

To get started, copy these examples to your config directory:

```bash
mkdir -p config/sandbox
cp packages/deploy/examples/config-examples/sandbox/config.json config/sandbox/
```

The deployment command will use these configuration files to deploy all necessary contracts and tokens.
