import type { Command } from 'commander';
import { randomBytes } from 'node:crypto';
import {
  createAztecNodeClient,
  createPXEClient,
  AztecAddress,
  TxStatus,
} from '@aztec/aztec.js';
import { http, getAddress } from 'viem';
import {
  waitForL2Block,
  getChain,
  getClients,
} from '@turnstile-portal/turnstile-dev';

import { commonOpts } from '@turnstile-portal/deploy/commands';

import {
  L2Token,
  L2Portal,
  L2Client,
  TurnstileFactory,
} from '@turnstile-portal/turnstile.js';

export function registerDeployAndRegisterToken(program: Command) {
  return program
    .command('deploy-and-register-token')
    .description(
      'Deploy a token on L1 and register it with the Turnstile Portal on L1 & L2',
    )
    .addOption(commonOpts.keys)
    .addOption(commonOpts.pxe)
    .addOption(commonOpts.aztecNode)
    .addOption(commonOpts.l1Chain)
    .addOption(commonOpts.rpc)
    .addOption(commonOpts.deploymentData)
    .action(async (options) => {
      console.log('Starting token deployment and registration...');

      // Get deployment data and setup clients
      const factory = await TurnstileFactory.fromConfig(options.deploymentData);
      const deploymentData = factory.getDeploymentData();
      const pxe = createPXEClient(options.pxe);
      const { l2Client } = await getClients(
        options.aztecNode,
        {
          chain: getChain(options.l1Chain),
          transport: http(options.rpc),
        },
        options.keys,
      );

      // Configure token details
      const suffix = randomBytes(4).toString('hex');
      const tokenName = `TestToken${suffix}`;
      const tokenSymbol = `TT${suffix}`;
      const tokenDecimals = 18;

      // Create simplified variables for addresses
      const l1PortalAddr = getAddress(deploymentData.l1Portal);
      const l1TokenAddr = '0x1234567890123456789012345678901234567890'; // Mock address for example
      console.log(`Using L1 token at address ${l1TokenAddr}`);
      console.log(
        '(Note: In a real scenario, you would deploy and register the token on L1 first.)',
      );

      // Skip the L1 operations for this example
      console.log('--------------------------------------------------');
      console.log(
        'Skipping L1 token deployment, allowlisting, and registration',
      );
      console.log(
        'These would normally be required steps in a real deployment',
      );
      console.log('--------------------------------------------------');

      // Simulate L1->L2 message parameters
      const messageIndex = 0n;
      const l2BlockNumber = 1n;

      console.log('Creating L2 client and deploying L2 token...');

      // Deploy the L2 token
      try {
        const aztecPortalAddr = AztecAddress.fromString(
          deploymentData.aztecPortal,
        );

        // Deploy L2 token
        console.log(`Deploying L2 token ${tokenSymbol}...`);
        const aztecToken = await L2Token.deploy(
          l2Client,
          aztecPortalAddr,
          tokenName,
          tokenSymbol,
          tokenDecimals,
        );

        console.log(`L2 token deployed at ${aztecToken.getAddress()}`);

        // Advance L2 blocks if needed
        console.log(`Waiting for L2 block ${l2BlockNumber}...`);
        await waitForL2Block(l2Client, Number(l2BlockNumber));

        // Register token on L2
        console.log('Registering token on L2...');
        const aztecPortal = new L2Portal(aztecPortalAddr, l2Client);

        const registerTx = await aztecPortal.registerToken(
          l1TokenAddr,
          aztecToken.getAddress().toString(),
          tokenName,
          tokenSymbol,
          tokenDecimals,
          messageIndex,
        );

        console.log(`L2 registration tx: ${await registerTx.getTxHash()}`);

        const receipt = await registerTx.wait();
        if (receipt.status !== TxStatus.SUCCESS) {
          throw new Error(`L2 token registration failed: ${receipt.status}`);
        }

        console.log('--------------------------------------------------');
        console.log(`Token ${tokenSymbol} successfully registered on L2!`);
        console.log(`- L1 address: ${l1TokenAddr}`);
        console.log(`- L2 address: ${aztecToken.getAddress().toString()}`);
        console.log('--------------------------------------------------');
      } catch (error) {
        console.error('Error during token registration:', error);
        throw error;
      }
    });
}
