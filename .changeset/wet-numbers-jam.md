---
"@turnstile-portal/l1-artifacts-bytecode": minor
"@turnstile-portal/l1-artifacts-abi": minor
"@turnstile-portal/l1-artifacts-dev": minor
"@turnstile-portal/aztec-artifacts": minor
"@turnstile-portal/turnstile-dev": minor
"@turnstile-portal/turnstile.js": minor
"@turnstile-portal/deploy": minor
"@turnstile-portal/repl": minor
---

Upgrade to Aztec v0.87.2

This is a major version upgrade from v0.85.0-alpha-testnet.11 to v0.87.2 that includes:

- **Breaking Changes**: Updated all Aztec contract imports and APIs to match v0.87.2, including changes to token contract balance management and test utilities
- **Artifacts**: Regenerated all Aztec artifacts with new ABI formats
- **Deployment**: Added sandbox-hosted environment configuration and simplified deployment scripts by removing deprecated commands
- **Dependencies**: Updated all package dependencies to match Aztec v0.87.2 requirements
- **Infrastructure**: Updated Docker configuration and added new deployment helper scripts for initial keys and test accounts

All contracts and packages have been updated to maintain compatibility with the new Aztec version.
