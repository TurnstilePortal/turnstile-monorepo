# Turnstile monorepo

This is the Turnstile monorepo containing L1 and L2 contracts for the Turnstile Portal and associated libraries & services.

## Repository Structure

- [l1/](l1): L1 contracts
- [aztec/](aztec): Aztec/L2 contracts
- [packages/](packages): Typescript packages containing SDKs, services, and tooling
  - [packages/api-client](packages/api-client): Type-safe API client bindings
  - [packages/api-common](packages/api-common): Shared database schema, migrations, and helpers
  - [packages/api-init-contracts](packages/api-init-contracts): Seed the API database with contract metadata
  - [packages/api-service](packages/api-service): Fastify REST API service
  - [packages/aztec-artifacts](packages/aztec-artifacts): Generated Aztec contract artifacts
  - [packages/collector](packages/collector): L1/L2 blockchain data collectors
  - [packages/deploy](packages/deploy): Deployment CLI and Docker entrypoint
  - [packages/l1-artifacts-abi](packages/l1-artifacts-abi): Published L1 ABIs
  - [packages/l1-artifacts-bytecode](packages/l1-artifacts-bytecode): Published L1 bytecode blobs
  - [packages/l1-artifacts-dev](packages/l1-artifacts-dev): Dev-only L1 contract artifacts
  - [packages/repl](packages/repl): Interactive Turnstile REPL
  - [packages/turnstile-dev](packages/turnstile-dev): Local Aztec & L1 development helpers
  - [packages/turnstile.js](packages/turnstile.js): Public SDK for interacting with Turnstile
- [examples/](examples): Example scripts for interacting with Turnstile (API samples live under [examples/turnstile-api](examples/turnstile-api))
- [scripts/](scripts): Scripts for deploying and interacting with the contracts
- [hooks/](hooks): Git hooks for the repository
- [docker/common](docker/common): Shared Dockerfile for deployer and service images
- [docker/turnstile-api](docker/turnstile-api): Docker Compose setup for the API service and collector

## Development Environment

The recommended development environment is to use VS Code with the devcontainer configuration
in this repository, otherwise you'll need to install the following:

- [Foundry](https://book.getfoundry.sh/)
- [Aztec Sandbox](https://docs.aztec.network/guides/developer_guides/getting_started/quickstart#install-the-sandbox)
- [pnpm](https://pnpm.io)

### Devcontainer

#### Ports Forwarded

- `8080`: [Aztec PXE Service](https://docs.aztec.network/aztec/concepts/pxe)
- `8545`: Local Ethereum Node [(Anvil)](https://book.getfoundry.sh/anvil/)

## Turnstile Sandbox

The Turnstile Sandbox is a modified version of the
[Aztec Sandbox](https://docs.aztec.network/guides/developer_guides/getting_started/quickstart#install-the-sandbox)
that includes pre-deployed Turnstile contracts and test tokens. It is intended for use in local development.

Images are built from [docker/common/Dockerfile](docker/common/Dockerfile); see `packages/deploy` for sandbox deployment helpers.

## Development

Before you start, run:

```bash
make init
```

### Building

**Everything:**

```bash
make build
```

**Contract Artifacts:**

These commands update the contract artifacts under [packages/](packages):

```bash
make artifacts
# or
make l1-artifacts
make aztec-artifacts
```

**Node Packages:**

```bash
make packages
# or
pnpm run build
```

### Unit Tests

```bash
make test
```

### REPL environment

```bash
pnpm repl
```

### Running the sandbox within the devcontainer

```bash
make sandbox
```

This starts up the [Aztec Sandbox](https://docs.aztec.network/reference/developer_references/sandbox_reference)
and deploys the L1 and L2 contracts to it along with some test tokens. The addresses of deployed contracts will
be stored in the `config/sandbox-local/deployment.json` file.

### Token Registration

The Token Registration flow is as follows:

```mermaid
sequenceDiagram
    autonumber
    actor Alice
    actor Approver
    box Layer 1 (Ethereum)
        participant AllowList
        participant L1P as L1 TokenPortal
    end
    box Layer 2 (Aztec)
        participant L2I as L2 Inbox
        participant L2T as L2 Token
        participant L2P as L2 Portal
    end

    Alice->>AllowList: Propose TokenX
    note over AllowList: emit Proposed(TokenX)
    Approver->>AllowList: Accept TokenX
    note over AllowList: emit Accepted(TokenX)
    Alice->>L1P: Register(TokenX)
    L1P->>L2I: Message: to: L2Portal(Register(TokenX))
    note right of L1P: Sent via the L1 Aztec Inbox
    Alice->>L2T: Deploy L2TokenX
    note over L1P,L2P: The token contract must be manually deployed <br/> on L2 with parameters matching the L1 Token
    note over Alice,L2I: Alice must wait for the L1->L2 Message<br/>to be available on L2 before registration
    Alice->>L2P: Execute Register(L1TokenX, L2TokenX)
    L2P->>L2T: Verify & Consume Message:<br/>Registration(TokenX)
    L2P->>L2P: Register TokenX
```

1. Alice proposes a token address for the allow list.
2. The proposed address can be accepted or rejected by the allow list approver.
3. Once accepted, the proposed address must be registered with both the L1 and L2 Portals.
4. The L1 Token Portal sends a registration message to the L2 Portal via the Aztec Inbox.
5. Alice must deploy the an L2 token contract with the same parameters as the L1 token contract and with the L2 Portal as the minter.
6. After the L2 contract is deployed, Alice waits for the registration message to be available on L2, then calls the `register` function on the L2 Portal.
7. The L2 Portal verifies the token contract matches the registration message and consumes the registration message.
8. The L2 Portal registers the L2 token contract as the paired token for the L1 token contract.

### Deposit

The Deposit flow requires that a token first be registered with the L1 and L2 Portals
following the [Token Registration](#token-registration) flow. Once registered, users
can deposit the token into the L1 Portal, which will then mint the equivalent amount
of the token on the L2 network.

The Deposit flow is as follows:

```mermaid
sequenceDiagram
    autonumber
    actor Alice
    box Layer 1 (Ethereum)
        participant L1T as L1 Token
        participant L1P as L1 Portal
    end
    box Layer 2 (Aztec)
        participant L2I as L2 Inbox
        participant L2P as L2 Portal
        participant L2T as L2 Token
    end

    Alice->>L1T: Approve(Portal, TokenX)
    Alice->>L1P: Deposit(TokenX)
    L1P->>L1T: Transfer Alice's TokenX to L1 Portal
    L1P->L2I: Message: L2Portal(Deposit(TokenX))
    note right of L1P: Message sent to the L2 Portal via the Aztec Inbox
    Alice->>L2P: Claim Deposit(X)
    L2P->>L2I: Verify & Consume Message: <br/>Deposit(TokenX)
    L2P->>L2T: Mint TokenX for Alice
```

1. Alice calls the `approve()` function on the L1 Token contract to authorize the L1 Portal to transfer tokens on her behalf.
2. Alice calls the `deposit()` function on the L1 Portal with the token address and amount to deposit.
3. The L1 Portal transfers Alice's tokens to itself.
4. The L1 Portal sends a message to the L2 Portal via the Aztec Rollup Inbox informing it of the deposit.
5. After waiting for the L1->L2 deposit message to be available on L2, Alice calls the L2 Portal to claim the deposit.
6. The L2 Portal verifies the claim against the L1->L2 deposit message and consumes it.
7. The L2 Portal tells the L2 Token contract to mint the equivalent amount of tokens for Alice.

### Token Withdrawal

```mermaid
sequenceDiagram
    autonumber
    actor Alice
    box Layer 2 (Aztec)
        participant L2P as L2 TokenPortal
        participant L2T as L2 Token
    end
    box Layer 1 (Ethereum)
        participant L1I as L1 Inbox
        participant L1P as L1 Portal
        participant L1T as L1 Token
    end

    Alice->>Alice: Create Authentication Witness<br/> to enable burning L2TokenX
    Alice->>L2P: Submit Authentication Witness to the chain
    Alice->>L2P: Execute Withdraw(L2TokenX)
    L2P->>L2T: Burn Alice's L2TokenX
    L2P->>L1I: Message: L1Portal(Withdraw(L2TokenX))
    note right of L2P: Sent to L1 via the Aztec Outbox
    note over Alice,L1I: Alice must wait for the L2->L1 Message<br/>to be available on L1 before withdrawal
    Alice->>L1P: Claim Withdrawal(L2TokenX)
    L1P->>L1I: Verify & Consume Message:<br/>Withdraw(L2TokenX)
    L1P->>L1T: Transfer tokens to Alice
```

1. Alice creates an authentication witness to enable the L2 Portal to burn tokens on her behalf.
2. Alice publicly submits the authentication witness to the chain.
3. Alice calls the `withdraw` function on the L2 Portal with the token & withdrawal amount.
4. The L2 Portal burns Alice's L2 tokens, using the authentication witness to prove her permission.
5. The L2 Portal sends a message to the L1 Portal via the Aztec Outbox to withdraw the equivalent amount of tokens.
6. Alice waits for the withdrawal message to be available on L1, then submits the withdrawal proof to the L1 Portal.
7. The L1 Portal verifies and consumes the withdrawal message
8. The L1 Portal transfers the tokens to Alice.

## Releases

Releases are managed with [Changesets](https://github.com/changesets/changesets):

1. Run `pnpm changeset` with any user-visible updates before opening a PR.
2. When the PR merges to `main`, the `Release` workflow runs `pnpm run version`, publishes via `pnpm changeset publish`, and builds Docker images from [docker/common/Dockerfile](docker/common/Dockerfile).
3. If you need to trigger the workflow manually, use the `Release` action's `workflow_dispatch` entry.

## Notes

- The [Docker-in-Docker Devcontainer Feature](https://github.com/devcontainers/features/tree/main/src/docker-in-docker)
  is used for running the [Aztec Sandbox](https://docs.aztec.network/reference/developer_references/sandbox_reference)
  within the dev container.
- The Aztec Sandbox is installed via [this unofficial devcontainer feature](https://github.com/ClarifiedLabs/devcontainer-features/tree/main/src/aztec-sandbox)
  which may break in the future if the Aztec Sandbox is updated. The Aztec
  Sandbox version specified by the `version` option must match the aztec-packages
  version used by the Turnstile Aztec contracts.
