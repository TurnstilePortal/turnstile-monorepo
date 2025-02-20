#!/bin/bash

pnpm tsx examples/src/index.ts deposit-and-claim -k docker/turnstile-sandbox/sandbox-keys.json

pnpm tsx examples/src/index.ts shield-tokens -k docker/turnstile-sandbox/sandbox-keys.json

pnpm tsx examples/src/index.ts aztec-transfer-private-verified-id -k docker/turnstile-sandbox/sandbox-keys.json --recipient 0x06f24a5e873e56a5f0a363e5179e6d2f648fb4a1a294b9055c55c0a0594b5957

pnpm tsx examples/src/index.ts aztec-transfer-private-verified-id -k docker/turnstile-sandbox/sandbox-keys.json --recipient 0x06f24a5e873e56a5f0a363e5179e6d2f648fb4a1a294b9055c55c0a0594b5957
