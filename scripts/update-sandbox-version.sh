#!/bin/bash

VERSION="v$(jq -r '.version' packages/deploy/package.json)"
sed -i "s|ghcr.io/turnstileportal/turnstile-sandbox-deployer:.*|ghcr.io/turnstileportal/turnstile-sandbox-deployer:${VERSION}|" docker/turnstile-sandbox/docker-compose.yaml
