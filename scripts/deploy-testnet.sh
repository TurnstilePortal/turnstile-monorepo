#!/bin/bash

# Create config directory if it doesn't exist
mkdir -p config/testnet

# Copy example config if one doesn't exist
if [ ! -f "config/testnet/config.json" ]; then
  echo "Config file not found, copying example config..."
  cp packages/deploy/examples/config-examples/testnet/config.json config/testnet/
fi

# Check if keys file exists in the new location
if [ ! -f "config/testnet/keys.json" ]; then
  # Check if keys file exists in the old location
  if [ -f "keys/testnet-keys.json" ]; then
    echo "Copying keys from keys/testnet-keys.json..."
    cp keys/testnet-keys.json config/testnet/keys.json
  else
    echo "ERROR: You need to create config/testnet/keys.json with your testnet wallet keys first."
    echo "This file should contain L1 and L2 private keys with funds on the testnet."
    exit 1
  fi
fi

# Run the unified deploy command
echo "Running unified deploy command..."
pnpm tsx packages/deploy/src/cli.ts deploy --env testnet
