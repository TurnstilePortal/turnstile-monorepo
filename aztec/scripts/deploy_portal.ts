import { createPXEClient } from '@aztec/aztec.js';
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing';
import { EthAddress } from '@aztec/foundation/eth-address';
import { AztecAddress } from '@aztec/foundation/aztec-address';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fs from 'node:fs';
import { createPublicClient, createWalletClient, http } from 'viem';
import { anvil } from 'viem/chains';

import {
  PortalContract,
  ShieldGatewayContract,
} from '@turnstile-portal/aztec-artifacts';
import { L1TokenPortal } from '@turnstile-portal/turnstile.js';

const {
  PXE_URL = 'http://localhost:8080',
  // L1 ETH RPC
  RPC_URL = 'http://localhost:8545',
} = process.env;

const argv = await yargs(hideBin(process.argv))
  .env('PORTAL') // Use environment variables prefixed with PORTAL_
  .option('l1Portal', {
    alias: 'p',
    type: 'string',
    description: 'L1 portal address',
    demandOption: true,
  })
  .option('deploymentData', {
    alias: 'dd',
    type: 'string',
    description: 'Deployment Data',
    demandOption: true,
    default: 'sandbox_deployment.json',
  }).argv;

const pxe = createPXEClient(PXE_URL);
const [wallet] = await getInitialTestAccountsWallets(pxe);

async function deployShieldGateway() {
  const shieldGateway = await ShieldGatewayContract.deploy(
    wallet,
    AztecAddress.ZERO, // Manager address. TODO: set this once we actually use it
  )
    .send()
    .deployed();
  console.log(`Shield Gateway deployed at ${shieldGateway.address.toString()}`);
  return shieldGateway;
}

async function main() {
  const deploymentData = JSON.parse(
    fs.readFileSync(argv.deploymentData, 'utf8'),
  );

  const tokenContractClass = AztecAddress.fromString(
    deploymentData.aztecTokenContractClassID,
  );
  const shieldGateway = await deployShieldGateway();
  deploymentData.shieldGateway = shieldGateway.address.toString();
  const l1Portal = EthAddress.fromString(argv.l1Portal);
  const portal = await PortalContract.deploy(
    wallet,
    l1Portal,
    tokenContractClass,
    shieldGateway.address,
  )
    .send()
    .deployed();
  console.log(`Portal deployed at ${portal.address.toString()}`);

  deploymentData.l1Portal = argv.l1Portal;

  // TODO: find a better way to do this
  // This is a hack to pull the L1 AllowList contract address from the portal
  // so it can be written to the deployment data file.
  const publicClient = createPublicClient({
    chain: anvil,
    transport: http(RPC_URL),
  });
  // account parameter doesn't matter since we won't be signing any transactions
  const walletClient = createWalletClient({
    account: '0x0000000000000000000000000000000000000000',
    chain: anvil,
    transport: http(RPC_URL),
  });
  const l1PortalClient = new L1TokenPortal(
    argv.l1Portal as `0x${string}`,
    walletClient,
    publicClient,
  );
  const allowList = await l1PortalClient.allowList();
  deploymentData.l1AllowList = allowList.toString();

  deploymentData.aztecPortal = portal.address.toString();
  console.log(deploymentData);

  fs.writeFileSync(
    argv.deploymentData,
    JSON.stringify(deploymentData, null, 2),
  );
  console.log(`Deployment data written to ${argv.deploymentData}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
