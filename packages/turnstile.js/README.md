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

## Core Utility Systems

### Error Handling

The library uses a single `TurnstileError` class with numeric error codes:

```typescript
import { ErrorCode, TurnstileError, createL1Error } from '@turnstile-portal/turnstile.js';

// Throwing errors with contextual information
try {
  // Operation that might fail
} catch (error) {
  throw new TurnstileError(
    ErrorCode.L1_TOKEN_OPERATION,
    `Failed to transfer tokens`,
    { tokenAddress: '0x1234...', amount: '1000' },
    error // Original cause
  );
}

// Using helper functions for domain-specific errors
try {
  // L1 operation that might fail
} catch (error) {
  throw createL1Error(
    ErrorCode.L1_INSUFFICIENT_BALANCE,
    'Insufficient balance for transfer',
    { tokenAddress: '0x1234...', amount: '1000' },
    error
  );
}

// Handling errors
try {
  await token.transfer(recipient, amount);
} catch (error) {
  if (error instanceof TurnstileError) {
    // Check specific error code
    if (error.code === ErrorCode.L1_INSUFFICIENT_BALANCE) {
      console.error('Not enough balance:', error.message);
      console.log('Context:', error.context);
    } else {
      console.error(`Error (${error.code}): ${error.message}`);
    }
  } else {
    console.error('Unknown error:', error);
  }
}
```

### Validation

The library provides a flexible validation system using predicates:

```typescript
import { 
  validate, 
  validateWallet, 
  validatePositiveAmount, 
  predicates 
} from '@turnstile-portal/turnstile.js';

// Validate wallet has connected account
const wallet = validateWallet(walletClient);

// Validate amount is positive
const amount = validatePositiveAmount(userAmount);

// Validate a value with a custom predicate
const value = validate(
  input,
  (n) => n > 10 && n < 100,
  ErrorCode.VALIDATION_RANGE,
  'Value must be between 10 and 100'
);

// Using predicate combinators
const isValidId = predicates.and(
  predicates.isNotEmpty,
  predicates.matchesPattern(/^[a-zA-Z0-9]{8,12}$/)
);

// Validate with the predicate
const id = validate(
  input,
  isValidId,
  ErrorCode.VALIDATION_FORMAT,
  'ID must be 8-12 alphanumeric characters'
);
```

### Utilities

The library includes generic utility functions:

```typescript
import { 
  formatTokenOperation, 
  safeAccess, 
  safeCall, 
  safePromise 
} from '@turnstile-portal/turnstile.js';

// Format error messages for token operations
const errorMessage = formatTokenOperation({
  operation: 'transfer',
  tokenAddress: '0x1234...',
  amount: 1000n,
  recipient: '0x5678...'
});
// "Failed to transfer amount 1000 to 0x5678... for token 0x1234..."

// Safely access nested properties
const value = safeAccess(
  obj,
  ['deeply', 'nested', 'property'],
  'default'
);

// Safely call functions with fallback value
const result = safeCall(
  () => JSON.parse(input),
  {} // Default if parsing fails
);

// Safely await promises
const data = await safePromise(
  fetch('https://api.example.com/data'),
  null // Default if fetch fails
);
```
