import type { Command } from 'commander';
import { createPXEClient } from '@aztec/aztec.js';

import { DevAdvanceBlockContract } from '@turnstile-portal/aztec-artifacts';
import {
  getL2Wallet,
  readKeyData,
  readDeploymentData,
  writeDeploymentData,
} from '@turnstile-portal/turnstile-dev';

import { commonOpts } from './common.js';

export function registerDeployDevAdvanceBlock(program: Command) {
  return program
    .command('deploy-dev-advance-block')
    .description('Deploy the DevAdvanceBlock contract')
    .addOption(commonOpts.keys)
    .addOption(commonOpts.pxe)
    .addOption(commonOpts.deploymentData)
    .action(async (options) => {
      const pxe = createPXEClient(options.pxe);
      console.log('PXE URL:', options.pxe);

      const deploymentData = await readDeploymentData(options.deploymentData);
      const keyData = await readKeyData(options.keys);
      const l2Wallet = await getL2Wallet(pxe, keyData);
      console.log(`L2 Address: ${l2Wallet.getAddress()}`);

      const devAdvanceBlock = await DevAdvanceBlockContract.deploy(l2Wallet)
        .send()
        .deployed();
      console.log(`DevAdvanceBlock deployed at ${devAdvanceBlock.address}`);

      deploymentData.devAdvanceBlock = devAdvanceBlock.address.toString();

      await writeDeploymentData(options.deploymentData, deploymentData);
    });
}
