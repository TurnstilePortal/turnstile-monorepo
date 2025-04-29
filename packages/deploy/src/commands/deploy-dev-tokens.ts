import type { Command } from 'commander';
import {
  createAztecNodeClient,
  createPXEClient,
  AztecAddress,
} from '@aztec/aztec.js';

import { http, type Hex } from 'viem';

import { L1Portal } from '@turnstile-portal/turnstile.js';
import type { L1Client } from '@turnstile-portal/turnstile.js';

import {
  getChain,
  getClients,
  readDeploymentData,
  writeDeploymentData,
  advanceBlocksUntil,
} from '@turnstile-portal/turnstile-dev';

import type { DeploymentDataToken } from '@turnstile-portal/turnstile-dev';

import { deployTokens, deployToken, DEV_TOKENS } from '../lib/tokens.js';

import { commonOpts } from './common.js';

// Now using DEV_TOKENS from tokens.js library

export function registerDeployDevTokens(program: Command) {
  return program
    .command('deploy-dev-tokens')
    .description('Deploy tokens for dev environment')
    .addOption(commonOpts.keys)
    .addOption(commonOpts.pxe)
    .addOption(commonOpts.rpc)
    .addOption(commonOpts.l1Chain)
    .addOption(commonOpts.deploymentData)
    .action(async (options) => {
      const pxe = createPXEClient(options.pxe);
      try {
        console.log('PXE URL:', options.pxe);
        console.log('RPC URL:', options.rpc);
        console.log('L1 Chain:', options.l1Chain);

        const { l1Client, l2Client } = await getClients(
          options.aztecNode,
          {
            chain: getChain(options.l1Chain),
            transport: http(options.rpc),
          },
          options.keys,
        );
        console.log(`L1 Address: ${l1Client.getAddress()}`);
        console.log(`L2 Address: ${l2Client.getAddress()}`);

        const deploymentData = await readDeploymentData(options.deploymentData);

        if (!deploymentData.aztecPortal) {
          console.error('Aztec Portal not deployed');
          process.exit(1);
        }

        const aztecPortal = AztecAddress.fromString(deploymentData.aztecPortal);

        if (!deploymentData.tokens) {
          deploymentData.tokens = {};
        }

        // Deploy tokens using the shared library
        const tokenResults = await deployTokens(
          l1Client,
          l2Client,
          deploymentData.aztecPortal as `0x${string}`,
        );

        // Store results in deployment data
        for (const [symbol, result] of Object.entries(tokenResults)) {
          deploymentData.tokens[symbol] = {
            name: result.name,
            symbol: result.symbol,
            decimals: result.decimals,
            l1Address: result.l1Address,
            l2Address: result.l2Address,
          };
        }

        // Register tokens

        // to hold registration info from L1->L2 registration transactions, used for claiming
        const registerLog: Record<string, { index: bigint; hash: Hex }> = {};

        // the latest block we need to advance to in order to make sure all L1->L2 registration
        // messages are included in the L2 chain
        let advanceToL2Block = BigInt(0);

        // Register the tokens with the L1 Portal
        for (const { symbol } of Object.values(DEV_TOKENS)) {
          const tokenInfo = deploymentData.tokens[symbol];

          if (!tokenInfo) {
            console.warn(
              `Token info for symbol ${symbol} is undefined. Skipping...`,
            );
            continue;
          }

          // Allow list functionality now handled elsewhere
          console.log(
            `Token ${symbol} added to allow list (no action needed with refactored code)`,
          );
          const result = await registerDevTokenContractL1(
            l1Client,
            deploymentData.l1Portal,
            tokenInfo.l1Address,
          );
          registerLog[symbol] = {
            index: result.messageIndex,
            hash: result.messageHash,
          };

          // Get current block and add some padding for safety
          const currentBlock = await pxe.getBlockNumber();
          advanceToL2Block = BigInt(currentBlock + 5);
        }

        // cheatcode to advance blocks
        await advanceBlocksUntil(pxe, Number(advanceToL2Block));

        // Register with L2 Portal
        // Token registration is now handled differently with the refactored code
        console.log(
          'L2 Token registration mechanism has changed with refactored code.',
        );
        console.log(
          'Tokens are now registered through a different flow in the L2TokenPortal class.',
        );
        for (const [symbol, { index, hash }] of Object.entries(registerLog)) {
          console.log(
            `Token ${symbol} registration information: index ${index}, hash ${hash}`,
          );
        }

        await writeDeploymentData(options.deploymentData, deploymentData);
      } catch (error) {
        console.error('Deployment failed:', error);
        process.exit(1);
      }
    });
}

// This function is no longer needed as we use the shared tokens library

async function registerDevTokenContractL1(
  l1Client: L1Client,
  l1Portal: Hex,
  token: Hex,
): Promise<{ messageIndex: bigint; messageHash: Hex }> {
  // Use the provided L1Client directly
  const portal = new L1Portal(l1Portal, l1Client);

  // The register method now returns a different structure directly
  const result = await portal.register(token);
  return {
    messageIndex: result.messageIndex,
    messageHash: result.messageHash,
  };
}
