#!/bin/bash

set -x
set -e

export LOG_LEVEL=warn

pnpm tsx examples/src/index.ts deposit-and-claim -c ./config/sandbox-local
pnpm tsx examples/src/index.ts withdraw-tokens -c ./config/sandbox-local
pnpm tsx examples/src/index.ts shield-tokens -c ./config/sandbox-local
pnpm tsx examples/src/index.ts unshield-tokens -c ./config/sandbox-local
pnpm tsx examples/src/index.ts deploy-and-register-token -c config/sandbox-local
