# @turnstile-portal/turnstile.js

`@turnstile-portal/turnstile.js` is a TypeScript/JavaScript library for interacting with the Turnstile Portal and related Aztec Token contracts.

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
import { createPXE, Fr } from '@aztec/aztec.js';
import { createAccount } from '@aztec/accounts';

// Create L2 client
const pxe = createPXE({ url: 'http://localhost:8080' });
const wallet = await createAccount(pxe);
const l2Client = new AztecL2Client(pxe, wallet);

// Interact with L2 token
const l2TokenAddress = '0xYOUR_L2_TOKEN_ADDRESS';
const l2Token = await L2TokenImpl.fromAddress(l2TokenAddress, l2Client);

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
const portal = new L2TokenPortal(portalAddress, l2Client);

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
