#!/bin/bash

# Create config directory if it doesn't exist
mkdir -p config/sandbox

# Copy example config if one doesn't exist
if [ ! -f "config/sandbox/config.json" ]; then
  echo "Config file not found, copying example config..."
  cp packages/deploy/examples/config-examples/sandbox/config.json config/sandbox/
fi

# Run the unified deploy command
echo "Running unified deploy command..."
pnpm tsx packages/deploy/src/cli.ts deploy --env sandbox --overwrite
