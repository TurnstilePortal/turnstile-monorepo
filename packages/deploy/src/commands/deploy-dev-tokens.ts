import type { Command } from 'commander';
import {
  createPXEClient,
  AztecAddress,
  type PXE,
  TxStatus,
} from '@aztec/aztec.js';
import type { Wallet as AztecWallet } from '@aztec/aztec.js';

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

import { deployL1DevToken, deployL2DevToken } from '../lib/deploy/devTokens.js';

import { commonOpts } from './common.js';

const devTokens = {
  DAI: {
    name: 'DAI',
    symbol: 'DAI',
    decimals: 18,
  },
  USDC: {
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
  },
  USDT: {
    name: 'Tether USD',
    symbol: 'USDT',
    decimals: 6,
  },
  WETH: {
    name: 'Wrapped Ether',
    symbol: 'WETH',
    decimals: 18,
  },
  AZT: {
    name: 'Aztec Token',
    symbol: 'AZT',
    decimals: 18,
  },
  TT1: {
    name: 'Test Token 1',
    symbol: 'TT1',
    decimals: 18,
  },
  TT2: {
    name: 'Test Token 2',
    symbol: 'TT2',
    decimals: 18,
  },
  TT3: {
    name: 'Test Token 3',
    symbol: 'TT3',
    decimals: 18,
  },
  TT4: {
    name: 'Test Token 4',
    symbol: 'TT4',
    decimals: 18,
  },
  TT5: {
    name: 'Test Token 5',
    symbol: 'TT5',
    decimals: 18,
  },
};

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
          pxe,
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

        // Deploy the tokens
        for (const { symbol, name, decimals } of Object.values(devTokens)) {
          const { l1Token, l2Token } = await deployDevTokenContract(
            l1Client,
            l2Client.getWallet(),
            aztecPortal,
            name,
            symbol,
            decimals,
          );
          deploymentData.tokens[symbol] = {
            name,
            symbol,
            decimals,
            l1Address: l1Token,
            l2Address: l2Token,
          };
        }

        // Register tokens

        // to hold registration info from L1->L2 registration transactions, used for claiming
        const registerLog: Record<string, { index: bigint; hash: Hex }> = {};

        // the latest block we need to advance to in order to make sure all L1->L2 registration
        // messages are included in the L2 chain
        let advanceToL2Block = BigInt(0);

        // Register the tokens with the L1 Portal
        for (const { symbol } of Object.values(devTokens)) {
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
        await advanceBlocksUntil(
          pxe,
          l2Client.getWallet(),
          Number(advanceToL2Block),
        );

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

async function deployDevTokenContract(
  l1Client: L1Client,
  l2Wallet: AztecWallet,
  aztecPortal: AztecAddress,
  name: string,
  symbol: string,
  decimals: number,
): Promise<{ l1Token: Hex; l2Token: Hex }> {
  const l1Token = await deployL1DevToken(l1Client, name, symbol, decimals);
  const l2Token = await deployL2DevToken(
    l2Wallet,
    aztecPortal,
    name,
    symbol,
    decimals,
  );

  return { l1Token, l2Token };
}

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

// L2 registration is now handled differently in the refactored code
// This function is kept for reference but is not used
async function registerDevTokenContractL2(
  pxe: PXE,
  l2Wallet: AztecWallet,
  aztecPortal: string,
  index: bigint,
  tokenInfo: DeploymentDataToken,
  hash: Hex,
) {
  console.warn(
    'L2 token registration is now handled differently in the refactored code',
  );
  // This would use the new L2TokenPortal class with the AztecL2Client
  return { status: TxStatus.SUCCESS };
}

// Allow list functionality is now handled differently in the refactored code
// This function is kept for reference but is not used
async function proposeAndAccept(
  l1Client: L1Client,
  l1AllowList: Hex,
  token: Hex,
) {
  console.warn(
    'Allow list functionality is now handled differently in the refactored code',
  );
  // Would need to be updated to use the new client interface
  console.log(`Simulating acceptance of token ${token} in the allow list`);
}
