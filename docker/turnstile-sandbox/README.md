# Turnstile Sandbox

The Turnstile Sandbox is based on the [Aztec Sandbox](https://docs.aztec.network/guides/developer_guides/getting_started#install-the-sandbox)
with an additional contract deployer image that deploys the Turnstile contracts and some test tokens.

## Usage

```bash
# from the root of the repo
docker-compose -f docker/turnstile-sandbox/docker-compose.yml up
```

When the `turnstile-sandbox-deployer` instance finishes running, the contracts are deployed and the sandbox is ready to use.
The contract addresses are output to the `sandbox-data/sandbox-data.json` file.

The `sandbox-keys.json` file contains the account keys used for deploying the sandbox contracts. The L1 key in that file
(address: `0x5c0a3e355Ecda348688221e1aEf02dd843DA2864`) has permission to approve token proposals.

## Updating the Sandbox Config

When updating to a new version of Aztec, the `base-sandbox-deployment.json` file must be updated
with the new contract addresses. To do this, run:

```bash
# from the root of the repo
bash scripts/update-base-aztec-addresses.sh
```
