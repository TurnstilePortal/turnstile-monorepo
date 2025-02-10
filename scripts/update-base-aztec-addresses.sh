#!/bin/bash

if [ ! -z "$TURNSTILE_DEV_CONTAINER" ] ; then
  # COMPOSE_PROJECT_NAME and COMPOSE_FILE are set in the dev container

  echo "Resetting the sandbox..."
  docker-compose down

  echo "Starting the sandbox..."
  docker-compose up -d

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
elif ! docker-compose ls | grep -q sandbox ; then
  echo 'Please run `aztec start --sandbox` first'
  exit 1
fi

echo "Initializing sandbox_deployment.json file..."
docker-compose logs aztec | grep 'Aztec L1 contracts initialized' | grep -o '{.*}' | jq -r 'del(.severity)' > docker/turnstile-sandbox/base-sandbox-deployment.json

docker-compose down
