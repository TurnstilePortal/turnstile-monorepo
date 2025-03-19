# @turnstile-portal/turnstile.js

`@turnstile-portal/turnstile.js` is a TypeScript/JavaScript library for interacting with the Turnstile Portal and related Aztec Token contracts.

## Features

- **Type-safe interfaces**: Well-defined TypeScript interfaces for all components
- **Error handling**: Comprehensive error handling with specific error types
- **L1 (Ethereum) support**: Interact with Ethereum contracts using Viem
- **L2 (Aztec) support**: Interact with Aztec contracts using Aztec.js
- **Bridging operations**: Easily move tokens between L1 and L2

## Installation

```bash
npm install @turnstile-portal/turnstile.js
```

## Usage

### L1 (Ethereum) Operations

```typescript
import { 
  ViemL1Client, 
  ERC20Token, 
  L1TokenPortal 
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

const l1Client = new ViemL1Client(publicClient, walletClient);

// Interact with ERC20 token
const tokenAddress = '0xYOUR_TOKEN_ADDRESS';
const token = new ERC20Token(tokenAddress, l1Client);

// Get token details
const symbol = await token.getSymbol();
const balance = await token.balanceOf(account.address);

// Interact with portal
const portalAddress = '0xYOUR_PORTAL_ADDRESS';
const portal = new L1TokenPortal(portalAddress, l1Client);

// Deposit tokens to L2
const l2RecipientAddr = '0xYOUR_L2_RECIPIENT_ADDRESS';
const amount = 1000000000n; // 1 token with 9 decimals
const result = await portal.deposit(tokenAddress, l2RecipientAddr, amount);
```

### L2 (Aztec) Operations

```typescript
import { 
  AztecL2Client, 
  L2TokenImpl, 
  L2TokenPortal 
} from '@turnstile-portal/turnstile.js';
import { 
  createPXEClient, 
  getSandboxAccountsWallets, 
  AztecAddress 
} from '@aztec/aztec.js';

// Create L2 client
const pxe = createPXEClient('http://localhost:8080');
const wallets = await getSandboxAccountsWallets(pxe);
const l2Client = new AztecL2Client(pxe, wallets[0]);

// Interact with Aztec token
const tokenAddress = AztecAddress.fromString('0xYOUR_L2_TOKEN_ADDRESS');
const token = await L2TokenImpl.fromAddress(tokenAddress, l2Client);

// Get token details
const symbol = await token.getSymbol();
const publicBalance = await token.balanceOfPublic(l2Client.getAddress());
const privateBalance = await token.balanceOfPrivate(l2Client.getAddress());

// Shield tokens (convert public to private)
await token.shield(1000000000n);

// Interact with portal
const portalAddress = AztecAddress.fromString('0xYOUR_L2_PORTAL_ADDRESS');
const portal = new L2TokenPortal(portalAddress, l2Client);

// Withdraw tokens to L1
const l1TokenAddr = '0xYOUR_L1_TOKEN_ADDRESS';
const l1RecipientAddr = '0xYOUR_L1_RECIPIENT_ADDRESS';
const amount = 1000000000n; // 1 token with 9 decimals

// First burn the tokens
const { action, nonce } = await token.createBurnAction(l2Client.getAddress(), amount);

// Then withdraw
const result = await portal.withdrawPublic(l1TokenAddr, l1RecipientAddr, amount, nonce);
```

## Documentation

For more detailed documentation, see the [TypeDoc generated documentation](https://turnstile-portal.github.io/turnstile.js/).

## Examples

See the [examples](https://github.com/TurnstilePortal/turnstile-contracts/tree/main/examples/src) for more examples of how to use this library.

## License

Apache-2.0
