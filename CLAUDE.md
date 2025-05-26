# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Turnstile is a cross-chain bridge system connecting Ethereum L1 to Aztec L2. It enables users to bridge ERC20 tokens between chains through a portal system with built-in allowlist controls.

## Common Development Commands

### Initial Setup
```bash
make init  # Sets up git hooks and installs dependencies
```

### Building
```bash
make build            # Build everything (artifacts + packages)
make artifacts        # Build both L1 and Aztec contract artifacts
make l1-artifacts     # Build only L1 artifacts
make aztec-artifacts  # Build only Aztec artifacts
make packages         # Build TypeScript packages
```

### Testing
```bash
make test         # Run all tests (L1 + Aztec)
make test-l1      # Run only L1 tests (Foundry)
make test-aztec   # Run only Aztec tests

# Run specific L1 test
cd l1 && forge test --match-test test_functionName

# Run specific Aztec test
cd aztec && LOG_LEVEL="info; verbose: cli" aztec test --show-output
```

### Linting and Formatting
```bash
make lint             # Lint all code
biome lint --write    # Fix linting issues in TypeScript
biome format --write  # Format TypeScript code
cd l1 && forge fmt    # Format Solidity code
cd aztec && aztec-nargo fmt  # Format Noir code
```

### Local Development
```bash
make sandbox  # Start local Aztec sandbox with deployed contracts
pnpm repl     # Start interactive REPL for contract interaction
```

## Architecture Overview

### Cross-Chain Message Flow

The system uses a portal architecture to bridge tokens between L1 and L2:

1. **L1 Portal (ERC20TokenPortal)**: Holds deposited tokens and sends messages to L2
2. **L2 Portal (Portal contract)**: Receives messages and mints/burns L2 tokens
3. **Allowlist**: Controls which tokens can be bridged
4. **Shield Gateway**: Manages private token shielding on L2

### Key Contract Interactions

**Token Registration Flow:**
1. Token must be proposed and accepted on L1 Allowlist
2. L1 Portal sends registration message to L2
3. L2 token contract deployed with matching parameters
4. L2 Portal consumes message and completes registration

**Deposit Flow:**
1. User approves L1 Portal to transfer tokens
2. L1 Portal locks tokens and sends deposit message to L2
3. User claims deposit on L2 Portal
4. L2 Portal mints tokens to user

**Withdrawal Flow:**
1. User creates auth witness for burning L2 tokens
2. L2 Portal burns tokens and sends withdrawal message to L1
3. User claims withdrawal on L1 Portal
4. L1 Portal releases tokens to user

### Contract Dependencies

- L1 contracts use OpenZeppelin libraries and Aztec's core contracts
- L2 contracts use Aztec's standard libraries (authwit, token interfaces)
- Both layers share encoding/decoding logic for cross-chain messages

### Testing Approach

- **L1**: Foundry tests with test harnesses exposing internal functions
- **L2**: Noir native testing with `#[test]` attributes
- **Integration**: TypeScript tests using Vitest for full flow testing

## Key Technical Details

### Message Encoding
- Cross-chain messages use specific content hash functions (register, deposit, withdraw)
- Public messages use a known "public" secret hash
- L1->L2 messages go through Aztec Inbox
- L2->L1 messages go through Aztec Outbox

### Token Limits
- Deposits limited to uint128 max (Aztec's token balance type)
- L2 tokens must match L1 token parameters (name, symbol, decimals)

### Development Dependencies
- Aztec version: 0.87.2 (pinned in package.json)
- Solidity: 0.8.28
- Node: Latest LTS
- pnpm: 10.10.0