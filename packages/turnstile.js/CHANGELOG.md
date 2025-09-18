# @turnstile-portal/turnstile.js

## 0.4.11

### Patch Changes

- Updated dependencies [04d4f1b]
  - @turnstile-portal/api-client@0.0.14
  - @turnstile-portal/aztec-artifacts@0.4.11
  - @turnstile-portal/l1-artifacts-abi@0.4.11

## 0.4.10

### Patch Changes

- 50d318a: Moved api packages into the monorepo
- 50d318a: repo rename turnstile-contracts -> turnstile-monorepo
- Updated dependencies [50d318a]
- Updated dependencies [50d318a]
  - @turnstile-portal/api-client@0.0.13
  - @turnstile-portal/l1-artifacts-abi@0.4.10
  - @turnstile-portal/aztec-artifacts@0.4.10

## 0.4.9

### Patch Changes

- 19b74b1: Add turnstile-api support to turnstile.js
  - @turnstile-portal/aztec-artifacts@0.4.9
  - @turnstile-portal/l1-artifacts-abi@0.4.9

## 0.4.8

### Patch Changes

- 5e8c5ad: Add helpers to fetch token info from the turnstile API
  - @turnstile-portal/aztec-artifacts@0.4.8
  - @turnstile-portal/l1-artifacts-abi@0.4.8

## 0.4.7

### Patch Changes

- 9f3ee8f: fix l1->l2 fetching from l2 portal & add log fetching helpers
  - @turnstile-portal/aztec-artifacts@0.4.7
  - @turnstile-portal/l1-artifacts-abi@0.4.7

## 0.4.6

### Patch Changes

- bf5be96: fix l1->l2 isClaimed check
  - @turnstile-portal/aztec-artifacts@0.4.6
  - @turnstile-portal/l1-artifacts-abi@0.4.6

## 0.4.5

### Patch Changes

- a6a9fa2: Improve the turnstile factory & fix a bugs for withdrawals
  - @turnstile-portal/aztec-artifacts@0.4.5
  - @turnstile-portal/l1-artifacts-abi@0.4.5

## 0.4.4

### Patch Changes

- 2406552: fix `getL2Token` as the return type of the underlying contract call changed
  - @turnstile-portal/aztec-artifacts@0.4.4
  - @turnstile-portal/l1-artifacts-abi@0.4.4

## 0.4.3

### Patch Changes

- @turnstile-portal/aztec-artifacts@0.4.3
- @turnstile-portal/l1-artifacts-abi@0.4.3

## 0.4.2

### Patch Changes

- ce1599c: use turnstile factory for registering contracts in the PXE
  - @turnstile-portal/aztec-artifacts@0.4.2
  - @turnstile-portal/l1-artifacts-abi@0.4.2

## 0.4.1

### Patch Changes

- 2c135ea: bring back support for automatic configuration for sandbox/testnet/mainnet environments
  - @turnstile-portal/aztec-artifacts@0.4.1
  - @turnstile-portal/l1-artifacts-abi@0.4.1

## 0.4.0

### Minor Changes

- 684e307: Update to aztec-packages 1.2.1 & updated token standard

### Patch Changes

- Updated dependencies [684e307]
  - @turnstile-portal/l1-artifacts-abi@0.4.0
  - @turnstile-portal/aztec-artifacts@0.4.0

## 0.3.8

### Patch Changes

- e2a3147: Fix some examples & simplify error handling in turnstile.js
- Updated dependencies [e2a3147]
  - @turnstile-portal/l1-artifacts-abi@0.3.8
  - @turnstile-portal/aztec-artifacts@0.3.8

## 0.3.7

### Patch Changes

- ebadf60: add deployment/transaction options support for l2 transactions
  - @turnstile-portal/aztec-artifacts@0.3.7
  - @turnstile-portal/l1-artifacts-abi@0.3.7

## 0.3.6

### Patch Changes

- e6d1829: fix(turnstile.js): use AztecAddress.equal instead of ==
  - @turnstile-portal/aztec-artifacts@0.3.6
  - @turnstile-portal/l1-artifacts-abi@0.3.6

## 0.3.5

### Patch Changes

- 380dc52: feat: add l2BlockNumber to L1Portal.deposit() return value
  - @turnstile-portal/aztec-artifacts@0.3.5
  - @turnstile-portal/l1-artifacts-abi@0.3.5

## 0.3.4

### Patch Changes

- fd8d634: feat(l1-artifacts): add AllowList contract helper to check if an address is an approver
- Updated dependencies [fd8d634]
  - @turnstile-portal/l1-artifacts-abi@0.3.4
  - @turnstile-portal/aztec-artifacts@0.3.4

## 0.3.3

### Patch Changes

- e455c25: fix(deploy): deploy contracts with correct salt & universal deploy
  - @turnstile-portal/aztec-artifacts@0.3.3
  - @turnstile-portal/l1-artifacts-abi@0.3.3

## 0.3.2

### Patch Changes

- 93bca89: Export constants
  - @turnstile-portal/aztec-artifacts@0.3.2
  - @turnstile-portal/l1-artifacts-abi@0.3.2

## 0.3.1

### Patch Changes

- 3d56727: Add contract registration functionality & config system
- Updated dependencies [3d56727]
  - @turnstile-portal/aztec-artifacts@0.3.1
  - @turnstile-portal/l1-artifacts-abi@0.3.1

## 0.3.0

### Minor Changes

- 2f3fe9e: feat: Overhaul deployment and upgrade to Aztec 0.87.9

  This release includes a significant number of breaking changes and new features.

  **BREAKING CHANGES**

  - **Architecture**: The L2 `Beacon` contract has been removed to simplify the architecture. The `Token` contract now directly stores the `ShieldGateway` address.
  - **Deployment**: The deployment scripts and process have been completely overhauled. A new CLI in `@turnstile-portal/deploy` is now the canonical way to deploy the system.
  - **L1 Contracts**: The L1 contracts have been updated to use the official Aztec interface packages, which may affect downstream integrations.
  - **Dependencies**: All Aztec dependencies have been upgraded to version `0.87.9`.

  **Features**

  - **CI/CD**: New GitHub Actions workflow to build and publish a `turnstile-sandbox-deployer` Docker image.
  - **DX**: Improved REPL, dev utilities, and a more robust local sandbox setup.
  - **Refactoring**: L2 contracts have been refactored for clarity and gas efficiency, such as the `Portal` contract now using a `Config` struct.

### Patch Changes

- Updated dependencies [2f3fe9e]
  - @turnstile-portal/aztec-artifacts@0.3.0
  - @turnstile-portal/l1-artifacts-abi@0.3.0

## 0.2.4

### Patch Changes

- 26851cc: Add `get_portal()` method to the Token contract & a helper for creating public authwit for the burn transaction to turnstile.js
- Updated dependencies [26851cc]
  - @turnstile-portal/l1-artifacts-abi@0.2.4
  - @turnstile-portal/aztec-artifacts@0.2.4

## 0.2.3

### Patch Changes

- 190d0f3: fix(turnstile.js): attempt 2 at removing PXE from the L2Client
  - @turnstile-portal/aztec-artifacts@0.2.3
  - @turnstile-portal/l1-artifacts-abi@0.2.3

## 0.2.2

### Patch Changes

- 69da996: Remove PXE from turnstile.js L2Client
  - @turnstile-portal/aztec-artifacts@0.2.2
  - @turnstile-portal/l1-artifacts-abi@0.2.2

## 0.2.1

### Patch Changes

- 9cbbe25: aztec packages -> 0.87.8
- Updated dependencies [9cbbe25]
  - @turnstile-portal/l1-artifacts-abi@0.2.1
  - @turnstile-portal/aztec-artifacts@0.2.1

## 0.2.0

### Minor Changes

- 23e4579: Upgrade to Aztec v0.87.2

  This is a major version upgrade from v0.85.0-alpha-testnet.11 to v0.87.2 that includes:

  - **Breaking Changes**: Updated all Aztec contract imports and APIs to match v0.87.2, including changes to token contract balance management and test utilities
  - **Artifacts**: Regenerated all Aztec artifacts with new ABI formats
  - **Deployment**: Added sandbox-hosted environment configuration and simplified deployment scripts by removing deprecated commands
  - **Dependencies**: Updated all package dependencies to match Aztec v0.87.2 requirements
  - **Infrastructure**: Updated Docker configuration and added new deployment helper scripts for initial keys and test accounts

  All contracts and packages have been updated to maintain compatibility with the new Aztec version.

### Patch Changes

- Updated dependencies [23e4579]
  - @turnstile-portal/l1-artifacts-abi@0.2.0
  - @turnstile-portal/aztec-artifacts@0.2.0

## 0.1.0

### Minor Changes

- 215fc73: - Update to aztec-packages v0.85.0-alpha-testnet.4
  - Rework turnstile.js so that it can work with an external PXE / wallet

### Patch Changes

- Updated dependencies [215fc73]
  - @turnstile-portal/l1-artifacts-abi@0.1.0
  - @turnstile-portal/aztec-artifacts@0.1.0

## 0.0.37

### Patch Changes

- a9f1e56: simplify contracts. On L1, combine to a single portal contract. On L2, remove public channels and only support verified ID style transfers
- Updated dependencies [a9f1e56]
  - @turnstile-portal/l1-artifacts-abi@0.0.37
  - @turnstile-portal/aztec-artifacts@0.0.37

## 0.0.36

### Patch Changes

- 5b58fd8: aztec-packages -> 0.76.4
- Updated dependencies [5b58fd8]
  - @turnstile-portal/aztec-artifacts@0.0.36
  - @turnstile-portal/l1-artifacts-abi@0.0.36

## 0.0.35

### Patch Changes

- 38f972d: aztec-packages -> v0.75.0
- Updated dependencies [38f972d]
  - @turnstile-portal/aztec-artifacts@0.0.35
  - @turnstile-portal/l1-artifacts-abi@0.0.35

## 0.0.34

### Patch Changes

- 001dcbd: repackage
- Updated dependencies [001dcbd]
  - @turnstile-portal/aztec-artifacts@0.0.34
  - @turnstile-portal/l1-artifacts-abi@0.0.34

## 0.0.33

### Patch Changes

- 59befb9: aztec-packages -> v0.74.0
- Updated dependencies [59befb9]
  - @turnstile-portal/l1-artifacts-abi@0.0.33
  - @turnstile-portal/aztec-artifacts@0.0.33

## 0.0.32

### Patch Changes

- 95fcea4: feat: Public Channels support in ShieldGateway
- Updated dependencies [95fcea4]
  - @turnstile-portal/aztec-artifacts@0.0.32
  - @turnstile-portal/l1-artifacts-abi@0.0.32

## 0.0.31

### Patch Changes

- 9fbe44c: aztec-packages -> 0.69.1
- Updated dependencies [9fbe44c]
  - @turnstile-portal/aztec-artifacts@0.0.31
  - @turnstile-portal/l1-artifacts-abi@0.0.31

## 0.0.30

### Patch Changes

- 3c321cd: Add noUncheckedIndexedAccess compile option
  - @turnstile-portal/aztec-artifacts@0.0.30
  - @turnstile-portal/l1-artifacts-abi@0.0.30

## 0.0.29

### Patch Changes

- 73893fd: Add unshield functionality & example on getting the list of aztec tokens
- Updated dependencies [73893fd]
  - @turnstile-portal/aztec-artifacts@0.0.29
  - @turnstile-portal/l1-artifacts-abi@0.0.29

## 0.0.28

### Patch Changes

- d7f370e: Update getL2Token to return AztecAddress
  - @turnstile-portal/aztec-artifacts@0.0.28
  - @turnstile-portal/l1-artifacts-abi@0.0.28

## 0.0.27

### Patch Changes

- f8a4e03: fix: use `Fr.fromHexString()` when intending to parse hex strings
- Updated dependencies [f8a4e03]
  - @turnstile-portal/aztec-artifacts@0.0.27
  - @turnstile-portal/l1-artifacts-abi@0.0.27

## 0.0.26

### Patch Changes

- 70626ac: dependencies
- Updated dependencies [70626ac]
  - @turnstile-portal/l1-artifacts-abi@0.0.26
  - @turnstile-portal/aztec-artifacts@0.0.26

## 0.0.25

### Patch Changes

- 8ec0cd7: chore: aztec-packages -> 0.68.2
- Updated dependencies [8ec0cd7]
  - @turnstile-portal/aztec-artifacts@0.0.25
  - @turnstile-portal/l1-artifacts-abi@0.0.25

## 0.0.24

### Patch Changes

- edaeb41: chore: update to aztec-packages-0.68.1
- Updated dependencies [edaeb41]
  - @turnstile-portal/l1-artifacts-abi@0.0.24
  - @turnstile-portal/aztec-artifacts@0.0.24
