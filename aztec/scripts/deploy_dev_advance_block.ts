import { createPXEClient } from '@aztec/aztec.js';
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fs from 'node:fs';

import { DevAdvanceBlockContract } from '@turnstile-portal/aztec-artifacts';

const { PXE_URL = 'http://localhost:8080' } = process.env;
const pxe = createPXEClient(PXE_URL);
const [wallet] = await getInitialTestAccountsWallets(pxe);

const argv = await yargs(hideBin(process.argv)).option('deploymentData', {
  alias: 'dd',
  type: 'string',
  description: 'Deployment Data',
  demandOption: true,
  default: 'sandbox_deployment.json',
}).argv;

const devAdvanceBlock = await DevAdvanceBlockContract.deploy(wallet)
  .send()
  .deployed();
console.log(
  `DevAdvanceBlock deployed at ${devAdvanceBlock.address.toString()}`,
);

const deploymentData = JSON.parse(fs.readFileSync(argv.deploymentData, 'utf8'));

deploymentData.aztecDevAdvanceBlock = devAdvanceBlock.address.toString();

fs.writeFileSync(argv.deploymentData, JSON.stringify(deploymentData, null, 2));

console.log(`Deployment data written to ${argv.deploymentData}`);
