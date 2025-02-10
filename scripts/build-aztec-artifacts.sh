#!/bin/bash

# This script is used to build the Aztec artifacts for packages/aztec-artifacts

set -e

# root of the repository
ROOTDIR=$(cd $(dirname "$0")/.. && pwd)

cd "${ROOTDIR}"

# Build the aztec contracts
make -C aztec build

ARTIFACTS=$(find aztec/target -name '*.json')

aztec_package=packages/aztec-artifacts/src/
# Remove the old artifacts
rm -fr "${aztec_package}/artifacts"
mkdir -p "${aztec_package}/artifacts"

echo Generating artifacts for aztec-artifacts...
for artifact in $ARTIFACTS; do
  echo "- $artifact"
  ## strip debug symbols from the artifacts
  #jq '.functions |= map(.debug_symbols = "")'  $artifact > "${aztec_package}/artifacts/$(basename $artifact)"
  cp $artifact "${aztec_package}/artifacts"
  shortname=$(basename $artifact)
  aztec codegen --force "${aztec_package}/artifacts/${shortname}" -o "${aztec_package}/artifacts"
done

# Generate index.ts
find ${aztec_package}/artifacts -type f -name '*.ts' -exec basename {} .ts \; | xargs -I % echo "export * from './%.js';" > "${aztec_package}/artifacts/index.ts"
