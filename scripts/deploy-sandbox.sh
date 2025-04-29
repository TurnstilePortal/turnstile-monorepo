#!/bin/bash

echo "Running deploy command..."
pnpm tsx packages/deploy/src/cli.ts deploy -c config/sandbox --overwrite
