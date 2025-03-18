#!/bin/bash

if [ ! -z "$TURNSTILE_DEV_CONTAINER" ] ; then
  echo "Resetting the sandbox..."
  docker stop aztec-sandbox

  echo "Starting the sandbox..."
  FORCE_COLOR=0 aztec start --sandbox > /dev/null 2>&1 &

  echo -n "Waiting for the sandbox to start..."
  count=0
  until curl -s -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":"1","method":"pxe_getBlockNumber"}' http://localhost:8080 ; do
    echo -n "."
    count=$((count+1))
    if [ $count -gt 30 ]; then
      echo "Failed to start the sandbox"
      exit 1
    fi
    sleep 2
  done
  echo
elif [ -z "$(docker ps -q -f name=aztec-sandbox)" ] ; then
  echo 'Please run `aztec start --sandbox` first'
  exit 1
fi


echo "Initializing sandbox_deployment.json file..."
docker logs aztec-sandbox 2>&1 | grep 'Aztec L1 contracts initialized' | grep -o '{.*}' | jq -r 'del(.severity)' > sandbox_deployment.json
echo "Using sandbox_deployment.json:"
jq . sandbox_deployment.json

tmpdir=$(mktemp -d)

error() {
  echo "Error: $1"
  echo "Logs are in $tmpdir"
  exit 1
}



# TODO: workaround for https://github.com/AztecProtocol/aztec-packages/issues/9384
#if [ "$(uname -m)" = "aarch64" ] ; then
#  echo "Running deploy-dev-aztec-test-accounts"
#  pnpm tsx aztec/scripts/deploy_test_accounts.ts
#fi

KEY_FILE=docker/turnstile-sandbox/sandbox-keys.json

set -e

if [ ! -f $KEY_FILE ]; then
  echo "Generating keys..."
  pnpm tsx packages/deploy/src/cli.ts generate-key -k $KEY_FILE
else
  echo "Running deploy-aztec-key"
  pnpm tsx packages/deploy/src/cli.ts deploy-aztec-key -k $KEY_FILE
fi

echo "Running fund-dev-account"
pnpm tsx packages/deploy/src/cli.ts fund-dev-account -k $KEY_FILE

echo "Running deploy-turnstile-contracts"
pnpm tsx packages/deploy/src/cli.ts deploy-turnstile-contracts -k $KEY_FILE

echo "Running deploy-dev-advance-block"
pnpm tsx packages/deploy/src/cli.ts deploy-dev-advance-block -k $KEY_FILE

echo "Running deploy-dev-tokens"
pnpm tsx packages/deploy/src/cli.ts deploy-dev-tokens -k $KEY_FILE
