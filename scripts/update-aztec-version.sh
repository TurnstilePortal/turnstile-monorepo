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

echo "Updating pnpm-workspace.yaml @aztec/* overrides to $new_version..."
sed -i "s/\('@aztec\/[^']*':\) [0-9.]\+/\1 $new_version/g" pnpm-workspace.yaml

echo "Updating " aztec/{contracts,lib}/*/Nargo.toml "..."

sed -i -E -e 's;aztec-packages/", tag ?= ?"v[^"]*";aztec-packages/", tag = "v'$new_version'";' aztec/contracts/*/Nargo.toml aztec/lib/*/Nargo.toml


echo "Updating .devcontainer/devcontainer.json..."

tmpfile=$(mktemp)
jq -r '.features."ghcr.io/ClarifiedLabs/devcontainer-features/aztec-sandbox:4".aztec_version = "'$new_version'"' .devcontainer/devcontainer.json > $tmpfile

mv $tmpfile .devcontainer/devcontainer.json

echo "Updating AztecProtocol/l1-contracts dependency to v$new_version..."
cd l1 ; forge install AztecProtocol/l1-contracts@tag=v$new_version ; cd -
