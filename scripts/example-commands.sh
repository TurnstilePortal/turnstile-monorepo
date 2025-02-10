#!/bin/bash

pnpm tsx examples/src/index.ts deposit-and-claim -k docker/turnstile-sandbox/sandbox-keys.json

pnpm tsx examples/src/index.ts shield-tokens -k docker/turnstile-sandbox/sandbox-keys.json

pnpm tsx examples/src/index.ts aztec-transfer-private-channel -k docker/turnstile-sandbox/sandbox-keys.json --recipient 0x07acd8488b0598d4e282414ed40b4f7151043f03897a689d082c0765c732fdd8

pnpm tsx examples/src/index.ts aztec-transfer-private-channel -k docker/turnstile-sandbox/sandbox-keys.json --recipient 0x07acd8488b0598d4e282414ed40b4f7151043f03897a689d082c0765c732fdd8
