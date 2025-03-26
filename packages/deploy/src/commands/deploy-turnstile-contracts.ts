import type { Command } from 'commander';
import { createAztecNodeClient, createPXEClient } from '@aztec/aztec.js';

import { deployTurnstileContracts } from '../lib/deployment.js';
import {
  getChain,
  getClients,
  readDeploymentData,
  writeDeploymentData,
} from '@turnstile-portal/turnstile-dev';

import { http } from 'viem';
import { commonOpts } from './common.js';

export function registerDeployTurnstileContracts(program: Command) {
  return program
    .command('deploy-turnstile-contracts')
    .description('Deploy Turnstile Portal Contracts')
    .addOption(commonOpts.keys)
    .addOption(commonOpts.pxe)
    .addOption(commonOpts.rpc)
    .addOption(commonOpts.l1Chain)
    .addOption(commonOpts.deploymentData)
    .option('--allow-list-admin <address>', 'Allow List Admin Address')
    .option('--allow-list-approver <address>', 'Allow List Approver Address')
    .option(
      '--l2-portal-initializer <address>',
      'L2 Portal Initializer Address',
    )
    .action(async (options) => {
      const pxe = createPXEClient(options.pxe);
      const node = createAztecNodeClient(options.aztecNode);
      try {
        console.log('PXE URL:', options.pxe);
        console.log('RPC URL:', options.rpc);
        const { l1Client, l2Client } = await getClients(
          node,
          pxe,
          {
            chain: getChain(options.l1Chain),
            transport: http(options.rpc),
          },
          options.keys,
        );
        console.log(`L1 Address: ${l1Client.getAddress()}`);
        console.log(`L2 Address: ${l2Client.getAddress()}`);

        // default values for optional arguments
        options.allowListAdmin =
          options.allowListAdmin ?? l1Client.getAddress();
        options.allowListApprover =
          options.allowListApprover ?? l1Client.getAddress();
        options.l2PortalInitializer =
          options.l2PortalInitializer ?? l1Client.getAddress();

        const deploymentData = await readDeploymentData(options.deploymentData);

        // Use our shared deployment library
        const deploymentResult = await deployTurnstileContracts(
          l1Client,
          l2Client,
          {
            registryAddress: deploymentData.registryAddress,
            allowListAdmin: options.allowListAdmin,
            allowListApprover: options.allowListApprover,
            l2PortalInitializer: options.l2PortalInitializer,
          },
        );

        // Store the deployment results
        deploymentData.l1AllowList = deploymentResult.l1AllowList;
        deploymentData.l1Portal = deploymentResult.l1Portal;
        deploymentData.aztecTokenContractClassID =
          deploymentResult.aztecTokenContractClassID;
        deploymentData.aztecPortal =
          deploymentResult.aztecPortal as `0x${string}`;
        deploymentData.aztecShieldGateway =
          deploymentResult.aztecShieldGateway as `0x${string}`;

        await writeDeploymentData(options.deploymentData, deploymentData);
      } catch (error) {
        console.error('Deployment failed:', error);
        process.exit(1);
      }
    });
}
