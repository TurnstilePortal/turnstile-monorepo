# Turnstile Examples

This directory contains examples of how to use the Turnstile Portal.

## Running the Examples

### Prerequisites

To run the examples, you will need to have the Turnstile Sandbox running.
You can do this by running `just sandbox` in the root of the Turnstile repository,
or by using the pre-built [Turnstile Sandbox Docker setup](https://github.com/TurnstilePortal/turnstile-contracts/tree/main/docker/turnstile-sandbox#readme).


### Commands

See `src/commands/` for all the available commands or run:
```bash
pnpm tsx examples/src/index.ts --help
```

Example usage:

```bash
KEY_DATA=docker/turnstile-sandbox/sandbox-keys.json
DEPLOYMENT_DATA=sandbox_deployment.json

pnpm tsx examples/src/index.ts deposit-and-claim -k $KEY_DATA -d $DEPLOYMENT_DATA

pnpm tsx examples/src/index.ts withdraw-tokens -k $KEY_DATA -d $DEPLOYMENT_DATA

pnpm tsx examples/src/index.ts shield-and-redeem -k $KEY_DATA -d $DEPLOYMENT_DATA

pnpm tsx examples/src/index.ts deploy-and-register-token -k $KEY_DATA -d $DEPLOYMENT_DATA

pnpm tsx examples/src/index.ts aztec-transfer-public -k $KEY_DATA -d $DEPLOYMENT_DATA --recipient 0x1a9362afa47a9054beeffeac113a012be1216f1fb8b3df9cf86c9a4fd26b4896

pnpm tsx examples/src/index.ts aztec-transfer-private -k $KEY_DATA -d $DEPLOYMENT_DATA --recipient 0x1a9362afa47a9054beeffeac113a012be1216f1fb8b3df9cf86c9a4fd26b4896
```
