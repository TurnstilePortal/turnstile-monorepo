# @turnstile-portal/turnstile.js

`@turnstile-portal/turnstile.js` is a lightweight collection of workflow helpers for coordinating Turnstile bridge operations.
Instead of wrapping blockchain clients, the library focuses on preparing calldata, fetching metadata, and waiting for cross-layer
messages so that you can interact with contracts using your preferred Viem or Aztec tooling.

## Installation

```bash
npm install @turnstile-portal/turnstile.js
```

## Workflow helpers

All helpers accept explicit dependencies (Viem public clients, wallet accounts, Aztec message clients, etc.) and return the
data required to drive transactions with your own signer.

### Prepare a deposit on L1

```ts
import { prepareDeposit } from '@turnstile-portal/turnstile.js';
import { createPublicClient, encodeFunctionData, http } from 'viem';
import { sepolia } from 'viem/chains';

const publicClient = createPublicClient({ chain: sepolia, transport: http('https://sepolia.example') });

const { request, tokenRegistered } = await prepareDeposit({
  l1PublicClient: publicClient,
  portalAddress: '0xPORTAL',
  tokenAddress: '0xTOKEN',
  amount: 1_000_000_000_000_000_000n,
  l2Recipient: '0xL2RECIPIENT',
});

// request contains { to, data, value } and can be passed directly to viem's wallet client.
// tokenRegistered indicates whether the portal already knows about the token.
```

### Parse the deposit receipt and wait for finalization

```ts
import { finalizeDeposit, parseDepositReceipt } from '@turnstile-portal/turnstile.js';
import { AztecAddress } from '@aztec/aztec.js';

const receipt = await publicClient.getTransactionReceipt({ hash: requestHash });
const { messageHash, messageIndex, l2BlockNumber } = parseDepositReceipt(receipt);

const status = await finalizeDeposit({
  messageClient: aztecNode,
  messageHash,
  isFinalized: (status) => status.status === 'CONSUMED',
  pollIntervalMs: 2_000,
});
```

`finalizeDeposit` polls any object that exposes `getL1ToL2MessageStatus(messageHash)`. Bring your own Aztec PXE or node client
and define what "finalized" means by providing a predicate via `isFinalized`.

### Register a token for bridging

```ts
import { registerToken } from '@turnstile-portal/turnstile.js';

const { metadata, request } = await registerToken({
  l1PublicClient: publicClient,
  portalAddress: '0xPORTAL',
  tokenAddress: '0xTOKEN',
});

// metadata contains the token name/symbol/decimals read from the ERC-20 contract.
// request contains the calldata for `portal.register(token)`.
```

### Prepare an L1 withdrawal transaction

```ts
import { withdrawToL1 } from '@turnstile-portal/turnstile.js';

const prepared = withdrawToL1({
  portalAddress: '0xPORTAL',
  message: '0x...encodedOutboxMessage',
  l2BlockNumber: 123,
  leafIndex: 5n,
  siblingPath: proof.siblingPath,
});

await walletClient.writeContract(prepared.request);
```

## Turnstile API helpers

The library also ships thin wrappers around the public Turnstile API so you can enumerate tokens without instantiating a custom
client class. Supply the L1 chain ID (mainnet `1`, testnet `11155111`, or sandbox `31337`) and optional fetch configuration.

```ts
import { getAllBridgedTokens, getTokenByAddress } from '@turnstile-portal/turnstile.js';

const bridged = await getAllBridgedTokens(11155111, { limit: 25 });
const token = await getTokenByAddress('0xTOKEN', 11155111);
```

To point at a bespoke API deployment, pass `client: { baseUrl: 'https://api.example.com' }` in the options object.

## Deployment metadata

For scenarios where you still want to load the canonical deployment manifest, the `deployment` module exposes the configuration
loader used by the Turnstile CLI:

```ts
import { loadConfig } from '@turnstile-portal/turnstile.js/deployment';

const config = await loadConfig('sandbox');
console.log(config.network.deployment.l1Portal);
```

## Migration guide

Version 1.0.0 replaces the object-oriented clients with stateless helpers. The following exports were removed:

- `L1Client`, `L2Client`, `L1Portal`, `L2Portal`, `L1Token`, `L2Token`, `ContractBatchBuilder`, and related interaction classes.
- `TurnstileFactory` and the deployment factory helpers.
- `validator` utilities and bespoke error wrappers around client instantiation.

Use Viem public/wallet clients or Aztec.js wallets directly, feed them into the new `workflows/*` helpers, and send transactions
with the tooling you already depend on.
