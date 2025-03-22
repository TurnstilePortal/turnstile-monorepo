import type { Command } from 'commander';
import {
  createPXEClient,
  AztecAddress,
  createAztecNodeClient,
} from '@aztec/aztec.js';
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing';

import { http } from 'viem';

import {
  getChain,
  getClients,
  readDeploymentData,
  writeDeploymentData,
} from '@turnstile-portal/turnstile-dev';

import { deployL2DevToken } from '../lib/deploy/devTokens.js';

import { commonOpts } from './common.js';
import { TokenContract } from '@turnstile-portal/aztec-artifacts';

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

export function registerDeployAztecOnlyTokens(program: Command) {
  return program
    .command('deploy-aztec-only-tokens')
    .description('Deploy tokens on aztec L2')
    .addOption(commonOpts.keys)
    .addOption(commonOpts.pxe)
    .addOption(commonOpts.aztecNode)
    .addOption(commonOpts.rpc)
    .addOption(commonOpts.deploymentData)
    .action(async (options) => {
      const pxe = createPXEClient(options.pxe);
      const node = createAztecNodeClient(options.aztecNode);
      try {
        const { l2Client } = await getClients(
          node,
          pxe,
          {
            chain: getChain('anvil'),
            transport: http(options.rpc),
          },
          options.keys,
        );
        const l2Wallet = l2Client.getWallet();
        console.log(`L2 Address to mint tokens to: ${l2Wallet.getAddress()}`);

        const deploymentData = await readDeploymentData(options.deploymentData);

        const [minter] = await getInitialTestAccountsWallets(pxe);

        if (!minter) {
          throw new Error('Minter account is undefined');
        }

        console.log(
          `Using minter account ${minter.getAddress().toString()} to mint tokens to:`,
        );
        console.log(`- ${minter.getAddress().toString()}`);
        console.log(`- ${l2Wallet.getAddress().toString()}`);

        if (!deploymentData.tokens) {
          deploymentData.tokens = {};
        }

        // Deploy the tokens
        for (const { symbol, name, decimals } of Object.values(devTokens)) {
          const l2Token = await deployL2DevToken(
            l2Wallet,
            minter.getAddress(),
            name,
            symbol,
            decimals,
          );
          deploymentData.tokens[symbol] = {
            name,
            symbol,
            decimals,
            l2Address: l2Token,
            l1Address: '0x0000000000000000000000000000000000000000',
          };

          // Mint some test tokens to the minter & the l2Wallet
          const token = await TokenContract.at(
            AztecAddress.fromString(l2Token),
            minter,
          );

          let amount = 11111111111111111111111111n;
          console.log(
            `Minting ${amount} ${symbol} for ${minter.getAddress().toString()}`,
          );
          let sentTx = await token.methods
            .mint_public(minter.getAddress(), amount)
            .send();
          let receipt = await sentTx.wait();
          console.log(receipt.status);
          amount *= 2n;
          console.log(
            `Minting ${amount} ${symbol} for ${l2Wallet.getAddress().toString()}`,
          );
          sentTx = await token.methods
            .mint_public(l2Wallet.getAddress(), amount)
            .send();
          receipt = await sentTx.wait();
          console.log(receipt.status);

          amount *= 2n;
          console.log(
            `Minting SHIELDED ${amount} ${symbol} for ${minter.getAddress().toString()}`,
          );
          sentTx = await token.methods
            .mint_shielded(minter.getAddress(), amount)
            .send();
          receipt = await sentTx.wait();
          console.log(receipt.status);

          amount *= 2n;
          console.log(
            `Minting SHIELDED ${amount} ${symbol} for ${l2Wallet.getAddress().toString()}`,
          );
          sentTx = await token.methods
            .mint_shielded(l2Wallet.getAddress(), amount)
            .send();
          receipt = await sentTx.wait();
          console.log(receipt.status);
        }
        await writeDeploymentData(options.deploymentData, deploymentData);
      } catch (error) {
        console.error('Deployment failed:', error);
        process.exit(1);
      }
    });
}
