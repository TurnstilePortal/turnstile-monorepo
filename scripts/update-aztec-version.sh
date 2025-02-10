#!bin/bash

set -e

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <new version>"
  echo "Example: $0 0.54.0"
  exit 1
fi

new_version=$1

echo "Updating aztec version to $new_version..."

pkg_jsons=$(git ls-files | grep package.json | xargs grep -l @aztec/)

for pkg_json in $pkg_jsons; do
  echo "Updating $pkg_json..."

  aztec_pkgs=$(grep @aztec/ $pkg_json | cut -d: -f 1 | tr -d '" ' | xargs -I% echo %@^$new_version)
  pnpm add -C $(dirname $pkg_json) $aztec_pkgs
done


echo "Updating " aztec/{contracts,lib}/*/Nargo.toml "..."

sed -i -e 's/tag="aztec-packages-v[^"/]*"/tag="aztec-packages-v'$new_version'"/' aztec/contracts/*/Nargo.toml aztec/lib/*/Nargo.toml

echo "Updating .devcontainer/devcontainer.json..."

tmpfile=$(mktemp)
jq -r '.features."ghcr.io/ClarifiedLabs/devcontainer-features/aztec-sandbox:2".version = "'$new_version'"' .devcontainer/devcontainer.json > $tmpfile
mv $tmpfile .devcontainer/devcontainer.json

echo "Updating docker/turnstile-sandbox/docker-compose.yaml..."

sed -i -e "s;image: aztecprotocol/aztec:.*$;image: aztecprotocol/aztec:${new_version};" docker/turnstile-sandbox/docker-compose.yaml
