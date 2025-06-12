#!/bin/bash

# This script is used to build the L1 artifacts for packages/l1-*

set -e

# List of main L1 contracts
CONTRACTS=$(find l1/src -name '*.sol' -exec basename {} .sol \;)
# # dev-only contracts
DEV_CONTRACTS=$(find l1/test -name '*.sol' -not -name '*.t.sol' -exec basename {} .sol \;)

# root of the repository
ROOTDIR=$(cd $(dirname "$0")/.. && pwd)

cd "${ROOTDIR}"

# Build the L1 contracts
make -C l1 build

get_abi() {
  jq -r .abi "l1/out/$1.sol/$1.json"
}

get_bytecode() {
  jq -r .bytecode.object "l1/out/$1.sol/$1.json"
}

# Generate the L1 artifacts
l1_abi_package=packages/l1-artifacts-abi/src/contracts
l1_bytecode_package=packages/l1-artifacts-bytecode/src/contracts
# Remove the old artifacts
rm -fr "${l1_abi_package}" "${l1_bytecode_package}"
mkdir -p "${l1_abi_package}" "${l1_bytecode_package}"
echo Generating L1 artifacts for l1-artifacts-abi and l1-artifacts-bytecode...
for contract in $CONTRACTS; do
  echo "- $contract"
  echo "export const ${contract}ABI = $(get_abi "$contract") as const;" > "${l1_abi_package}/${contract}.ts"
  echo "export * from './${contract}.js';" >> "${l1_abi_package}/index.ts"
  echo "export const ${contract}Bytecode = '$(get_bytecode "$contract")';" > "${l1_bytecode_package}/${contract}.ts"
  echo "export * from './${contract}.js';" >> "${l1_bytecode_package}/index.ts"
done

# Generate the L1 artifacts for dev-only contracts
l1_dev_package=packages/l1-artifacts-dev/src/contracts
rm -fr "${l1_dev_package}"
mkdir -p "${l1_dev_package}"
echo Generating L1 artifacts for l1-artifacts-dev...
for contract in $DEV_CONTRACTS; do
  echo "- $contract (DEV)"
  echo "export const ${contract}ABI = $(get_abi "$contract") as const;" > "${l1_dev_package}/${contract}.ts"
  echo >> "${l1_dev_package}/${contract}.ts"
  echo "export const ${contract}Bytecode = '$(get_bytecode "$contract")';" >> "${l1_dev_package}/${contract}.ts"
  echo "export * from './${contract}.js';" >> "${l1_dev_package}/index.ts"
done
