#!/bin/bash

set -e

DEPLOY_CONFIG_DIR=${DEPLOY_CONFIG_DIR:-"docker/sandbox-deploy-config"}

aztec_node=$(jq -r .connection.aztec.node ${DEPLOY_CONFIG_DIR}/config.json)

# Wait for the Aztec Sandbox to be ready
echo "turnstile: Waiting for Aztec node at ${aztec_node} to start..."
until curl -s --connect-timeout 1 ${aztec_node}/status ; do
  echo "turnstile: Still waiting for Aztec node to start..."
  sleep 3
done

echo "turnstile: Aztec node is up, starting Turnstile contract deployment"

deploy_dir=$(mktemp -d)
echo "OK" > ${deploy_dir}/status
echo "turnstile: Temporary deployment directory created at $deploy_dir"
cp -v ${DEPLOY_CONFIG_DIR}/*.json $deploy_dir

echo "turnstile: Running Turnstile Sandbox deployment"
node dist/cli.js deploy -c $deploy_dir --overwrite
echo "turnstile: Turnstile deployment completed"

echo "turnstile: Starting static file server for deployment data"
exec pnpm serve -n -l tcp://0.0.0.0:3000 --no-port-switching --cors ${deploy_dir}
