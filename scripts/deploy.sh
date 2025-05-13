#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: $0 <environment>"
  exit 1
fi
ENVIRONMENT=$1
echo "Deploying to $ENVIRONMENT environment..."

pnpm tsx packages/deploy/src/cli.ts deploy -c config/${ENVIRONMENT} --overwrite
