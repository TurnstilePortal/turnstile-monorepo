# @turnstile-portal/turnstile.js

`@turnstile-portal/turnstile.js` is a TypeScript/JavaScript library for interacting with the Turnstile Portal and related Aztec Token contracts.

## Installation

```bash
npm install @turnstile-portal/turnstile.js
```

## Quick Start with Configuration (Recommended)

The easiest way to use Turnstile is with the configuration system, which automatically provides contract addresses for different networks:

```typescript
import { TurnstileFactory } from '@turnstile-portal/turnstile.js';
import { createPXE } from '@aztec/aztec.js';
import { createAccount } from '@aztec/accounts';

// Create factory for sandbox environment
const factory = await TurnstileFactory.fromConfig('sandbox');

// Create L1 client with your private key
const l1Client = factory.createL1Client('0xYOUR_PRIVATE_KEY');

// Create L1 portal (address comes from config)
const l1Portal = factory.createL1Portal(l1Client);

// Create L1 token for DAI (address comes from config)
const daiToken = factory.createL1Token(l1Client, 'DAI');

// Create L2 client
const pxe = createPXE({ url: 'https://sandbox.aztec.walletmesh.com' });
const wallet = await createAccount(pxe);
const l2Client = factory.createL2Client(pxe, wallet);

// Create L2 portal (address comes from config)
const l2Portal = await factory.createL2Portal(l2Client);

// Create L2 token for DAI (address comes from config)
const l2DaiToken = await factory.createL2Token(l2Client, 'DAI');

// Deposit DAI to L2
const amount = 1000000000000000000n; // 1 DAI
const result = await l1Portal.deposit(
  daiToken.getAddress(),
  l2Client.getAddress().toString(),
  amount
);

// Claim deposit on L2
await l2Portal.claimDeposit(
  daiToken.getAddress(),
  l2Client.getAddress().toString(),
  amount,
  result.messageIndex
);
```

### Using Custom Tokens

For tokens not in the default configuration:

```typescript
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

const factory = await TurnstileFactory.fromConfig('sandbox', customTokens);
const myToken = factory.createL1Token(l1Client, 'MYTOKEN');
```

### Using URL Configuration

For frequently changing configurations (like sandbox):

```typescript
const factory = await TurnstileFactory.fromConfig(
  'https://sandbox.aztec.walletmesh.com/api/v1/turnstile/deployment.json'
);
```

## Manual Usage (Legacy)

If you prefer to specify addresses manually, you can still use the original approach:

### L1 (Ethereum) Operations

```typescript
import { 
  L1Client, 
  L1Token, 
  L1Portal 
} from '@turnstile-portal/turnstile.js';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

// Create L1 client
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http('https://sepolia.infura.io/v3/YOUR_API_KEY'),
});

const account = privateKeyToAccount('0xYOUR_PRIVATE_KEY');
const walletClient = createWalletClient({
  account,
  chain: sepolia,
  transport: http('https://sepolia.infura.io/v3/YOUR_API_KEY'),
});

const l1Client = new L1Client(publicClient, walletClient);

// Interact with ERC20 token
const tokenAddress = '0xYOUR_TOKEN_ADDRESS';
const token = new L1Token(tokenAddress, l1Client);

// Get token details
const symbol = await token.getSymbol();
const balance = await token.balanceOf(account.address);

// Interact with portal
const portalAddress = '0xYOUR_PORTAL_ADDRESS';
const portal = new L1Portal(portalAddress, l1Client);

// Deposit tokens to L2
const l2RecipientAddr = '0xYOUR_L2_RECIPIENT_ADDRESS';
const amount = 1000000000n; // 1 token with 9 decimals
const result = await portal.deposit(tokenAddress, l2RecipientAddr, amount);
```

### L2 (Aztec) Operations

```typescript
import { 
  L2Client, 
  L2Token, 
  L2Portal
} from '@turnstile-portal/turnstile.js';
import { createPXE, Fr } from '@aztec/aztec.js';
import { createAccount } from '@aztec/accounts';

// Create L2 client
const pxe = createPXE({ url: 'http://localhost:8080' });
const wallet = await createAccount(pxe);
const l2Client = new L2Client(pxe, wallet);

// Interact with L2 token
const l2TokenAddress = '0xYOUR_L2_TOKEN_ADDRESS';
const l2Token = await L2Token.fromAddress(l2TokenAddress, l2Client);

// Get token details
const symbol = await l2Token.getSymbol();
const publicBalance = await l2Token.balanceOfPublic(l2Client.getAddress());
const privateBalance = await l2Token.balanceOfPrivate(l2Client.getAddress());

// Transfer tokens publicly
const recipient = 'YOUR_RECIPIENT_AZTEC_ADDRESS';
const amount = 1000000000n; // 1 token with 9 decimals
await l2Token.transferPublic(recipient, amount);

// Shield tokens (convert public balance to private)
await l2Token.shield(amount);

// Unshield tokens (convert private balance to public)
await l2Token.unshield(amount);

// Interact with L2 Portal
const portalAddress = 'YOUR_L2_PORTAL_ADDRESS';
const portal = new L2Portal(portalAddress, l2Client);

// Claim a deposit from L1
const l1TokenAddress = '0xYOUR_L1_TOKEN_ADDRESS';
const l2RecipientAddress = l2Client.getAddress().toString();
const index = 5n; // Message index from L1 deposit
await portal.claimDeposit(l1TokenAddress, l2RecipientAddress, amount, index);

// Withdraw tokens to L1
const l1RecipientAddress = '0xYOUR_L1_RECIPIENT_ADDRESS';
const burnNonce = Fr.random();
const { tx, leaf } = await portal.withdrawPublic(
  l1TokenAddress,
  l1RecipientAddress,
  amount,
  burnNonce
);

// The leaf can be used later for the L1 withdrawal proof
```

## Supported Networks

The configuration system supports these networks out of the box:

- `sandbox` - Aztec Sandbox Environment
- `testnet` - Aztec Testnet Environment  
- `mainnet` - Aztec Mainnet Environment
- `local` - Local Development Environment

## Configuration System

For detailed information about the configuration system, see the [Deployment Configuration Documentation](./src/deployment/README.md).

## API Reference

For complete API documentation, see the generated TypeDoc documentation or explore the source code in the `src/` directory.
