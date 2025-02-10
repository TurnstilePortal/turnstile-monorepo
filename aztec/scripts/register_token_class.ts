import { createPXEClient, getContractClassFromArtifact } from '@aztec/aztec.js';
import { registerContractClass } from '@aztec/aztec.js/deployment';
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing';
import { TokenContract } from '@turnstile-portal/aztec-artifacts';
import fs from 'node:fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const { PXE_URL = 'http://localhost:8080' } = process.env;
const pxe = createPXEClient(PXE_URL);
const [defaultAztecWallet] = await getInitialTestAccountsWallets(pxe);

const argv = await yargs(hideBin(process.argv)).option('deploymentData', {
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

  const artifact = TokenContract.artifact;
  await registerContractClass(defaultAztecWallet, artifact).then((c) =>
    c.send().wait(),
  );
  const contractClass = getContractClassFromArtifact(artifact);
  console.log(`Registered TokenContract class ID: ${contractClass.id}`);

  deploymentData.aztecTokenContractClassID = contractClass.id.toString();
  fs.writeFileSync(
    argv.deploymentData,
    JSON.stringify(deploymentData, null, 2),
  );
  console.log(`Deployment data written to ${argv.deploymentData}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
