---
'@turnstile-portal/aztec-artifacts': minor
'@turnstile-portal/deploy': minor
'@turnstile-portal/l1-artifacts-abi': minor
'@turnstile-portal/l1-artifacts-bytecode': minor
'@turnstile-portal/l1-artifacts-dev': minor
'@turnstile-portal/repl': minor
'@turnstile-portal/turnstile-dev': minor
'@turnstile-portal/turnstile.js': minor
---

feat: Overhaul deployment and upgrade to Aztec 0.87.9

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
