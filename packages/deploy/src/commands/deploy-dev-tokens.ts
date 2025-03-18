import type { Command } from 'commander';
import {
  createPXEClient,
  AztecAddress,
  type PXE,
  TxStatus,
} from '@aztec/aztec.js';
import type { Wallet as AztecWallet } from '@aztec/aztec.js';

import { http, type Hex } from 'viem';

import {
  L1AllowList,
  AztecTokenPortal,
  L1TokenPortal,
} from '@turnstile-portal/turnstile.js';

import {
  getChain,
  getWallets,
  type L1ComboWallet,
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
            l1Wallet,
            l2Wallet,
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

        // to hold decoded logs from L1->L2 registration transactions, used for claiming
        const registerLog: Record<
          string,
          { l2BlockNumber: bigint; index: bigint; hash: Hex }
        > = {};

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

          await proposeAndAccept(
            l1Wallet,
            deploymentData.l1AllowList,
            tokenInfo.l1Address,
          );
          registerLog[symbol] = await registerDevTokenContractL1(
            l1Wallet,
            deploymentData.l1Portal,
            tokenInfo.l1Address,
          );
          if (registerLog[symbol].l2BlockNumber > advanceToL2Block) {
            advanceToL2Block = registerLog[symbol].l2BlockNumber;
          }
        }

        // cheatcode to advance blocks
        await advanceBlocksUntil(pxe, l2Wallet, Number(advanceToL2Block));

        // Register with L2 Portal
        for (const [symbol, { index, hash }] of Object.entries(registerLog)) {
          console.log(
            `Registering ${symbol} index ${index} hash ${hash} with L2 Portal...`,
          );
          const tokenInfo = deploymentData.tokens[symbol];

          if (!tokenInfo) {
            console.warn(
              `Token info for symbol ${symbol} is undefined. Skipping...`,
            );
            continue;
          }

          const receipt = await registerDevTokenContractL2(
            pxe,
            l2Wallet,
            aztecPortal.toString(),
            index,
            tokenInfo,
            hash,
          );
          if (receipt.status !== TxStatus.SUCCESS) {
            throw new Error(`L2 Register failed: ${receipt}`);
          }
        }

        await writeDeploymentData(options.deploymentData, deploymentData);
      } catch (error) {
        console.error('Deployment failed:', error);
        process.exit(1);
      }
    });
}

async function deployDevTokenContract(
  l1Wallet: L1ComboWallet,
  l2Wallet: AztecWallet,
  aztecPortal: AztecAddress,
  name: string,
  symbol: string,
  decimals: number,
): Promise<{ l1Token: Hex; l2Token: Hex }> {
  const l1Token = await deployL1DevToken(l1Wallet, name, symbol, decimals);
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
  l1Wallet: L1ComboWallet,
  l1Portal: Hex,
  token: Hex,
): Promise<{ l2BlockNumber: bigint; index: bigint; hash: Hex }> {
  const l1TokenPortal = new L1TokenPortal(
    l1Portal,
    l1Wallet.wallet,
    l1Wallet.public,
  );

  const receipt = await l1TokenPortal.register(token);
  if (receipt.status !== 'success') {
    throw new Error(`L1 Register failed: ${receipt}`);
  }

  return L1TokenPortal.parseMessageSentLog(receipt);
}

async function registerDevTokenContractL2(
  pxe: PXE,
  l2Wallet: AztecWallet,
  aztecPortal: string,
  index: bigint,
  tokenInfo: DeploymentDataToken,
  hash: Hex,
) {
  const portal = new AztecTokenPortal(aztecPortal, pxe, l2Wallet);

  const tx = await portal.registerToken(
    tokenInfo.l1Address,
    tokenInfo.l2Address,
    tokenInfo.name,
    tokenInfo.symbol,
    tokenInfo.decimals,
    index,
  );
  const receipt = await tx.wait();
  if (receipt.status !== TxStatus.SUCCESS) {
    throw new Error(`L2 Register failed: ${receipt}`);
  }

  return receipt;
}

async function proposeAndAccept(
  l1Wallet: L1ComboWallet,
  l1AllowList: Hex,
  token: Hex,
) {
  const allowList = new L1AllowList(
    l1AllowList,
    l1Wallet.wallet,
    l1Wallet.public,
    l1Wallet.wallet, // Approver
  );

  let receipt = await allowList.propose(token);
  console.log(`Proposed ${token} in tx ${receipt.transactionHash}`);
  if (receipt.status !== 'success') {
    throw new Error(`Propose failed: ${receipt}`);
  }

  receipt = await allowList.accept(token);
  console.log(`Accepted ${token} in tx ${receipt.transactionHash}`);
  if (receipt.status !== 'success') {
    throw new Error(`Accept failed: ${receipt}`);
  }
}
