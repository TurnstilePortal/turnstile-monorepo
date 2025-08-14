# Turnstile Examples

This directory contains examples of how to use the Turnstile Portal.

## Running the Examples

### Prerequisites

To run the examples, you will need to have the Turnstile Sandbox running.
You can do this by running `just sandbox` in the root of the Turnstile repository,
or by using the pre-built [Turnstile Sandbox Docker setup](https://github.com/TurnstilePortal/turnstile-contracts/tree/main/docker/turnstile-sandbox#readme).

### Configuration Setup

The examples now use a config-based approach similar to the deploy package. You'll need a configuration directory containing:

- `config.json` - Connection settings (RPC URLs, node endpoints)
- `keys.json` - Private keys and addresses
- `deployment.json` - Deployment data (contract addresses, tokens)

Example config directory structure:
```
config/sandbox-local/
├── config.json       # Connection configuration
├── keys.json         # Account keys
└── deployment.json   # Deployment results
```

### Commands

See `src/commands/` for all the available commands or run:
```bash
pnpm tsx examples/src/index.ts --help
```

### Usage

All commands require a `--config-dir` parameter. Most commands also have their own specific options:

```bash
# Basic usage pattern
pnpm tsx examples/src/index.ts <command> --config-dir <path-to-config> [command-specific-options]

# Examples with the provided sandbox config
CONFIG_DIR=config/sandbox-local

# Commands with token and amount options
pnpm tsx examples/src/index.ts deposit-and-claim \
  --config-dir $CONFIG_DIR \
  --token TT1 \
  --amount 1000000000 \
  --l2-recipient 0x...  # optional

pnpm tsx examples/src/index.ts withdraw-tokens \
  --config-dir $CONFIG_DIR \
  --token TT1 \
  --amount 1000 \
  --l1-recipient 0x...  # optional

pnpm tsx examples/src/index.ts shield-tokens \
  --config-dir $CONFIG_DIR \
  --token TT1 \
  --amount 10000

pnpm tsx examples/src/index.ts unshield-tokens \
  --config-dir $CONFIG_DIR \
  --token TT1 \
  --amount 10000

# Transfer commands require recipient address
pnpm tsx examples/src/index.ts aztec-transfer-public \
  --config-dir $CONFIG_DIR \
  --token TT1 \
  --amount 1000 \
  --recipient 0x1a9362afa47a9054beeffeac113a012be1216f1fb8b3df9cf86c9a4fd26b4896

pnpm tsx examples/src/index.ts aztec-transfer-private \
  --config-dir $CONFIG_DIR \
  --token TT1 \
  --amount 100 \
  --recipient 0x1a9362afa47a9054beeffeac113a012be1216f1fb8b3df9cf86c9a4fd26b4896

# Commands with no additional options
pnpm tsx examples/src/index.ts deploy-and-register-token --config-dir $CONFIG_DIR

pnpm tsx examples/src/index.ts lookup-aztec-tokens --config-dir $CONFIG_DIR
```

### Command-Specific Options

Each command has its own set of options. Use `--help` to see what's available:

```bash
# See all available commands
pnpm tsx examples/src/index.ts --help

# See options for a specific command
pnpm tsx examples/src/index.ts deposit-and-claim --help
pnpm tsx examples/src/index.ts aztec-transfer-public --help
```

**Common Options:**
- `--token <symbol>` - Token symbol (default varies by command, usually TT1)
- `--amount <amount>` - Amount for transactions (default varies by command)

**Transfer Commands Only:**
- `--recipient <address>` - **Required** recipient address for transfers

**Deposit/Withdraw Commands:**
- `--l2-recipient <address>` - Optional L2 recipient (defaults to sender)
- `--l1-recipient <address>` - Optional L1 recipient (defaults to sender)
