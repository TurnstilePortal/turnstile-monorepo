import type { Command } from 'commander';
import { createPXEClient } from '@aztec/aztec.js';

import {
  deployERC20AllowList,
  deployERC20TokenPortal,
  setL2PortalOnL1Portal,
} from '../lib/deploy/l1Portal.js';
import {
  deployBeacon,
  deployTurnstileTokenPortal,
  deployShieldGateway,
  registerTurnstileTokenContractClass,
} from '../lib/deploy/l2Portal.js';
import {
  getChain,
  getWallets,
  readDeploymentData,
  writeDeploymentData,
} from '@turnstile-portal/turnstile-dev';
import type {
  DeploymentData,
  L1ComboWallet,
} from '@turnstile-portal/turnstile-dev';

import { http } from 'viem';

import type { Hex } from 'viem';

import type { Wallet as AztecWallet } from '@aztec/aztec.js';
import { EthAddress } from '@aztec/aztec.js';

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
      try {
        console.log('PXE URL:', options.pxe);
        console.log('RPC URL:', options.rpc);
        const { l1Wallet, l2Wallet } = await getWallets(
          pxe,
          {
            chain: getChain(options.l1Chain),
            transport: http(options.rpc),
          },
          options.keys,
        );
        console.log(`L1 Address: ${l1Wallet.wallet.account.address}`);
        console.log(`L2 Address: ${l2Wallet.getAddress()}`);

        // default values for optional arguments
        options.allowListAdmin =
          options.allowListAdmin ?? l1Wallet.wallet.account.address;
        options.allowListApprover =
          options.allowListApprover ?? l1Wallet.wallet.account.address;
        options.l2PortalInitializer =
          options.l2PortalInitializer ?? l1Wallet.wallet.account.address;

        const deploymentData = await readDeploymentData(options.deploymentData);

        console.log('Deploying L1 Portal...');
        const { allowList, tokenPortal: l1Portal } = await deployL1Portal(
          options,
          l1Wallet,
          deploymentData,
        );
        console.log(`Deployed L1 Portal at ${l1Portal}`);

        deploymentData.l1AllowList = allowList;
        deploymentData.l1Portal = l1Portal;

        console.log('Deploying L2 Portal...');
        const {
          tokenContractClassID,
          shieldGateway,
          portal: aztecPortal,
        } = await deployL2Portal(l2Wallet, EthAddress.fromString(l1Portal));
        console.log(`Deployed L2 Portal at ${aztecPortal.address.toString()}`);

        deploymentData.aztecTokenContractClassID =
          tokenContractClassID.toString();
        deploymentData.aztecPortal = aztecPortal.address.toString();
        deploymentData.aztecShieldGateway = shieldGateway.address.toString();

        // Register L2 Portal with L1 Portal
        console.log('Registering L2 Portal with L1 Portal...');
        await setL2PortalOnL1Portal(
          l1Wallet,
          l1Portal,
          aztecPortal.address.toString(),
        );

        await writeDeploymentData(options.deploymentData, deploymentData);
      } catch (error) {
        console.error('Deployment failed:', error);
        process.exit(1);
      }
    });
}

async function deployL1Portal(
  // biome-ignore lint/suspicious/noExplicitAny: any is used for commander options
  options: any,
  l1Wallet: L1ComboWallet,
  deploymentData: DeploymentData,
): Promise<{ allowList: Hex; tokenPortal: Hex }> {
  const allowList = await deployERC20AllowList(
    l1Wallet,
    options.allowListAdmin,
    options.allowListApprover,
  );
  const tokenPortal = await deployERC20TokenPortal(
    l1Wallet,
    deploymentData.registryAddress,
    allowList,
    options.l2PortalInitializer,
  );

  return { allowList, tokenPortal };
}

async function deployL2Portal(l2Wallet: AztecWallet, l1Portal: EthAddress) {
  const tokenContractClassID =
    await registerTurnstileTokenContractClass(l2Wallet);
  const shieldGateway = await deployShieldGateway(
    l2Wallet /* this needs to be an admin wallet */,
  );
  const shieldGatewayBeacon = await deployBeacon(
    l2Wallet,
    l2Wallet.getAddress(), // admin address
    shieldGateway.address,
  );

  const portal = await deployTurnstileTokenPortal(
    l2Wallet,
    l1Portal,
    tokenContractClassID,
    shieldGatewayBeacon.address,
  );

  return { tokenContractClassID, shieldGateway, portal };
}
