# Turnstile Deployment Configuration

This module provides a configuration system for Turnstile that allows you to easily specify network configurations and contract addresses without manually providing them each time.

## Overview

The deployment configuration system consists of:

1. **Types** (`types.ts`) - TypeScript interfaces for configuration data
2. **Configuration Manager** (`config.ts`) - Functions to load configurations from various sources
3. **Factory** (`factory.ts`) - A factory class that creates Turnstile objects using configuration
4. **Static Configurations** (`deployments/`) - JSON files containing network-specific configurations (except sandbox)

## Quick Start

### Using Network Names

```typescript
import { TurnstileFactory } from '@turnstile-portal/turnstile.js';

// Create a factory for the sandbox environment (loaded dynamically from API)
const factory = await TurnstileFactory.fromConfig('sandbox');

// Create L1 client with your private key
const l1Client = factory.createL1Client('0xYOUR_PRIVATE_KEY');

// Create L1 portal (address comes from config)
const l1Portal = factory.createL1Portal(l1Client);

// Create L1 token for DAI (address comes from config)
const daiToken = factory.createL1Token(l1Client, 'DAI');

// Create L2 client
const l2Client = factory.createL2Client(node, wallet);

// Create L2 portal (address comes from config)
const l2Portal = await factory.createL2Portal(l2Client);

// Create L2 token for DAI (address comes from config)
const l2DaiToken = await factory.createL2Token(l2Client, 'DAI');
```

### Using Custom Tokens

```typescript
import { TurnstileFactory } from '@turnstile-portal/turnstile.js';

// Define custom token information
const customTokens = {
  MYTOKEN: {
    name: 'My Custom Token',
    symbol: 'MYTOKEN',
    decimals: 18,
    l1Address: '0x1234567890123456789012345678901234567890',
    l2Address: '0x1234567890123456789012345678901234567890123456789012345678901234',
    serializedL2TokenInstance: '0x...'
  }
};

// Create factory with custom tokens
const factory = await TurnstileFactory.fromConfig('sandbox', customTokens);

// Use custom token
const myToken = factory.createL1Token(l1Client, 'MYTOKEN');
```

### Using URL Configuration

```typescript
import { TurnstileFactory } from '@turnstile-portal/turnstile.js';

// Load configuration from URL (e.g., sandbox API)
const factory = await TurnstileFactory.fromConfig(
  'https://sandbox.aztec.walletmesh.com/api/v1/turnstile/deployment.json'
);
```

## Supported Networks

The following network names are supported out of the box:

- `sandbox` - Aztec Sandbox Environment (loaded dynamically from API)
- `testnet` - Aztec Testnet Environment  
- `mainnet` - Aztec Mainnet Environment
- `local` - Local Development Environment

## Configuration Sources

The system supports multiple configuration sources:

1. **Network Names** - Use predefined network names like `'sandbox'` (sandbox loads from API)
2. **URLs** - Load configuration from a URL endpoint
3. **Static Files** - Load from JSON files in the `deployments/` directory

## Configuration Structure

```typescript
interface NetworkConfig {
  name: string;
  description?: string;
  l1ChainId: number;
  l2ChainId: number;
  rpc: {
    l1: string;
    l2: string;
  };
  deployment: DeploymentData;
}

interface DeploymentData {
  l1Portal: Hex;
  l1AllowList: Hex;
  aztecTokenContractClassID: Hex;
  aztecPortal: Hex;
  serializedAztecPortalInstance: Hex;
  aztecShieldGateway: Hex;
  serializedShieldGatewayInstance: Hex;
  tokens: Record<string, DeploymentDataToken>;
}

interface DeploymentDataToken {
  name: string;
  symbol: string;
  decimals: number;
  l1Address: Hex;
  l2Address: Hex;
  serializedL2TokenInstance: Hex;
}
```

## Factory Methods

The `TurnstileFactory` provides the following methods:

### Client Creation
- `createL1Client(privateKey, customRpcUrl?)` - Creates L1 client with configured RPC
- `createL2Client(node, wallet)` - Creates L2 client

### Portal Creation
- `createL1Portal(l1Client)` - Creates L1 portal using configured address
- `createL2Portal(l2Client)` - Creates L2 portal using configured address

### Token Creation
- `createL1Token(l1Client, tokenSymbol, customTokenInfo?)` - Creates L1 token
- `createL2Token(l2Client, tokenSymbol, customTokenInfo?)` - Creates L2 token

### Allow List Creation
- `createL1AllowList(l1Client, approverL1Client?)` - Creates L1 allow list

### Utility Methods
- `getTokenInfo(tokenSymbol)` - Gets token information
- `getAvailableTokens()` - Gets list of available token symbols
- `getNetworkConfig()` - Gets network configuration
- `getDeploymentData()` - Gets deployment data

## Adding Custom Networks

To add a custom network configuration:

1. Create a JSON file in `src/deployments/` (e.g., `custom-network.json`)
2. Follow the `NetworkConfig` interface structure
3. Use the filename as the network name: `TurnstileFactory.fromConfig('custom-network')`

**Note:** The `sandbox` network is handled specially and loads its configuration dynamically from the live API endpoint at `https://sandbox.aztec.walletmesh.com/api/v1/turnstile/deployment.json`. This ensures that sandbox users always get the most up-to-date configuration without needing to update the codebase.

## Error Handling

The system provides comprehensive error handling with specific error codes:

- `CONFIG_MISSING_PARAMETER` - Required configuration parameter is missing
- `CONFIG_INVALID_PARAMETER` - Configuration parameter is invalid
- `CONFIG_INCOMPATIBLE_VERSION` - Configuration version is incompatible

## Caching

Configurations are cached to avoid repeated network requests. Use `clearConfigCache()` to clear the cache if needed.

**Note:** Sandbox configuration is cached like other configurations, but since it's loaded from a live API, you may want to clear the cache periodically to get the latest deployment data.

## Migration from Manual Address Specification

### Before (Manual)
```typescript
const portalAddress = '0xa15bb66138824a1c7167f5e85b957d04dd34e468';
const l1Portal = new L1Portal(portalAddress, l1Client);

const tokenAddress = '0x8ce361602b935680e8dec218b820ff5056beb7af';
const daiToken = new L1Token(tokenAddress, l1Client);
```

### After (Configuration)
```typescript
const factory = await TurnstileFactory.fromConfig('sandbox');
const l1Portal = factory.createL1Portal(l1Client);
const daiToken = factory.createL1Token(l1Client, 'DAI');
```

## Best Practices

1. **Use Network Names** - Prefer network names over URLs for better reliability
2. **Custom Tokens** - Use the custom tokens parameter for tokens not in the default configuration
3. **Error Handling** - Always handle configuration errors gracefully
4. **Caching** - The system caches configurations automatically, but clear cache if needed
5. **Type Safety** - Use TypeScript for better type safety and IntelliSense support
6. **Sandbox Updates** - Sandbox configuration is automatically updated via API, so you don't need to update the codebase for sandbox changes
