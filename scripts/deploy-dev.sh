#!/bin/bash

L1_CHAIN=devnet
KEY_FILE=devnet/keys.json
DEPLOYMENT_DATA=devnet/deployment.json
L1_RPC=http://34.83.148.196:8545
PXE=http://34.82.76.226:8081
#PXE=http://localhost:8080
#L2_RPC=http://34.83.184.137:8080

set -e

echo "Generating keys..."
rm -f $KEY_FILE
pnpm tsx packages/deploy/src/cli.ts generate-key -k $KEY_FILE --rpc $L1_RPC --pxe $PXE --l1-chain $L1_CHAIN

echo "Funding L1 account"
L1_ACCOUNT=$(jq -r .l1Address $KEY_FILE)
cast send --rpc-url $L1_RPC --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --value 100000ether $L1_ACCOUNT

echo "Running deploy-turnstile-contracts"
pnpm tsx packages/deploy/src/cli.ts deploy-turnstile-contracts -k $KEY_FILE -d $DEPLOYMENT_DATA --rpc $L1_RPC --pxe $PXE --l1-chain $L1_CHAIN

echo "Running deploy-dev-advance-block"
pnpm tsx packages/deploy/src/cli.ts deploy-dev-advance-block -k $KEY_FILE -d $DEPLOYMENT_DATA --pxe $PXE

echo "Running deploy-dev-tokens"
pnpm tsx packages/deploy/src/cli.ts deploy-dev-tokens -k $KEY_FILE -d $DEPLOYMENT_DATA --pxe $PXE --rpc $L1_RPC --l1-chain $L1_CHAIN

