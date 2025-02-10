import { createPXEClient } from '@aztec/aztec.js';
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing';
import { EthAddress } from '@aztec/aztec.js';
import { AztecAddress } from '@aztec/aztec.js';
import { PortalContract } from '@turnstile-portal/aztec-artifacts';
import { Fr } from '@aztec/foundation/fields';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fs from 'node:fs';

const { PXE_URL = 'http://localhost:8080' } = process.env;

const argv = await yargs(hideBin(process.argv))
  .option('l1Token', {
    alias: 'l1',
    type: 'string',
    description: 'L1 Token Address',
    demandOption: true,
  })
  .option('recipient', {
    alias: 'r',
    type: 'string',
    description: 'Recipient Address',
    demandOption: true,
  })
  .option('amount', {
    alias: 'a',
    type: 'string',
    description: 'Amount to mint',
    demandOption: true,
  })
  .option('messageKey', {
    alias: 'k',
    type: 'string',
    description: 'Message Key',
    demandOption: true,
  })
  .option('deploymentData', {
    alias: 'dd',
    type: 'string',
    description: 'Deployment Data',
    demandOption: true,
    default: 'sandbox_deployment.json',
  }).argv;

async function main() {
  const deploymentData = JSON.parse(
    fs.readFileSync(argv.deploymentData, 'utf8'),
  );

  const portalAddress = AztecAddress.fromString(deploymentData.aztecPortal);
  if (portalAddress.isZero()) {
    throw new Error('Invalid portal address');
  }

  const pxe = createPXEClient(PXE_URL);
  const [wallet] = await getInitialTestAccountsWallets(pxe);

  const portal = await PortalContract.at(portalAddress, wallet);

  const tx = await portal.methods
    .claim_public(
      EthAddress.fromString(argv.l1Token),
      AztecAddress.fromString(argv.recipient),
      Fr.fromString(argv.amount),
      Fr.fromHexString(argv.messageKey),
    )
    .send();
  console.log(tx);

  console.log(`Token deposit claim transaction hash: ${await tx.getTxHash()}`);
  const receipt = await tx.wait();
  console.log(`Receipt status: ${receipt.status}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
