#!/bin/bash

echo -n "Waiting for the Aztec Sandbox to load..."
until curl -s -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":"1","method":"pxe_getBlockNumber"}' http://aztec:8080 ; do
  echo -n "."
  sleep 2
done
echo

set -e


KEY_FILE=sandbox-keys.json
SANDBOX_DATA=/sandbox-data/sandbox-data.json
cp sandbox-data.json $SANDBOX_DATA

PXE_URL=http://aztec:8080
RPC_URL=http://ethereum:8545

echo "Running deploy-aztec-key"
turnstile-deploy deploy-aztec-key -k $KEY_FILE -p $PXE_URL

echo "Running fund-dev-account"
turnstile-deploy fund-dev-account -k $KEY_FILE --rpc $RPC_URL

echo "Running deploy-turnstile-contracts"
turnstile-deploy deploy-turnstile-contracts -k $KEY_FILE -d $SANDBOX_DATA --rpc $RPC_URL -p $PXE_URL

echo "Running deploy-dev-advance-block"
turnstile-deploy deploy-dev-advance-block -k $KEY_FILE -d $SANDBOX_DATA -p $PXE_URL

echo "Running deploy-dev-tokens"
turnstile-deploy deploy-dev-tokens -k $KEY_FILE -d $SANDBOX_DATA --rpc $RPC_URL -p $PXE_URL

#turnstile-deploy deploy-aztec-only-tokens -k $KEY_FILE -d $SANDBOX_DATA --rpc $RPC_URL -p $PXE_URL

cat $SANDBOX_DATA
