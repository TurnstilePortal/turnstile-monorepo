#!bin/bash

set -e

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <new version>"
  echo "Example: $0 0.54.0"
  exit 1
fi

new_version=$1

echo "Updating ts packages to $new_version..."
pnpm update-aztec-version $new_version

echo "Updating " aztec/{contracts,lib}/*/Nargo.toml "..."

sed -i -e 's/"aztec-packages-v[^"/]*"/"aztec-packages-v'$new_version'"/' aztec/contracts/*/Nargo.toml aztec/lib/*/Nargo.toml

echo "Updating .devcontainer/devcontainer.json..."

tmpfile=$(mktemp)
jq -r '.features."ghcr.io/ClarifiedLabs/devcontainer-features/aztec-sandbox:2".version = "'$new_version'"' .devcontainer/devcontainer.json > $tmpfile
mv $tmpfile .devcontainer/devcontainer.json

echo "Updating AztecProtocol/l1-contracts dependency to v$new_version..."
cd l1
forge install --root l1 AztecProtocol/l1-contracts@tag=v$new_version
cd -

echo "Updating docker/turnstile-sandbox/docker-compose.yaml..."
sed -i -e "s;image: aztecprotocol/aztec:.*$;image: aztecprotocol/aztec:${new_version};" docker/turnstile-sandbox/docker-compose.yaml
