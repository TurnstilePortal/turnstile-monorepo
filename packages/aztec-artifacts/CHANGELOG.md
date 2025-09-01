# @turnstile-portal/aztec-artifacts

## 0.4.1

## 0.4.0

### Minor Changes

- 684e307: Update to aztec-packages 1.2.1 & updated token standard

## 0.3.8

## 0.3.7

## 0.3.6

## 0.3.5

## 0.3.4

## 0.3.3

## 0.3.2

## 0.3.1

### Patch Changes

- 3d56727: Add contract registration functionality & config system

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

## 0.2.4

### Patch Changes

- 26851cc: Add `get_portal()` method to the Token contract & a helper for creating public authwit for the burn transaction to turnstile.js

## 0.2.3

## 0.2.2

## 0.2.1

### Patch Changes

- 9cbbe25: aztec packages -> 0.87.8

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

## 0.1.0

### Minor Changes

- 215fc73: - Update to aztec-packages v0.85.0-alpha-testnet.4
  - Rework turnstile.js so that it can work with an external PXE / wallet

## 0.0.37

### Patch Changes

- a9f1e56: simplify contracts. On L1, combine to a single portal contract. On L2, remove public channels and only support verified ID style transfers

## 0.0.36

### Patch Changes

- 5b58fd8: aztec-packages -> 0.76.4

## 0.0.35

### Patch Changes

- 38f972d: aztec-packages -> v0.75.0

## 0.0.34

### Patch Changes

- 001dcbd: repackage

## 0.0.33

### Patch Changes

- 59befb9: aztec-packages -> v0.74.0

## 0.0.32

### Patch Changes

- 95fcea4: feat: Public Channels support in ShieldGateway

## 0.0.31

### Patch Changes

- 9fbe44c: aztec-packages -> 0.69.1

## 0.0.30

## 0.0.29

### Patch Changes

- 73893fd: Add unshield functionality & example on getting the list of aztec tokens

## 0.0.28

## 0.0.27

### Patch Changes

- f8a4e03: fix: use `Fr.fromHexString()` when intending to parse hex strings

## 0.0.26

### Patch Changes

- 70626ac: dependencies

## 0.0.25

### Patch Changes

- 8ec0cd7: chore: aztec-packages -> 0.68.2

## 0.0.24

### Patch Changes

- edaeb41: chore: update to aztec-packages-0.68.1
