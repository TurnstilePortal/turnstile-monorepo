import { formatUnits, getContract, Client, GetContractReturnType } from 'viem';
import type {
  Address,
  TransactionReceipt,
} from 'viem';

import {
  InsecureMintableTokenABI,
  InsecureMintableTokenBytecode,
} from '@turnstile-portal/l1-artifacts-dev';

import { L1Token, IL1Client } from '@turnstile-portal/turnstile.js';

export type InsecureMintableTokenContract = GetContractReturnType<
  typeof InsecureMintableTokenABI,
  Client,
  Address
>;

export class InsecureMintableToken extends L1Token {
  constructor(address: Address, client: IL1Client) {
    super(address, client);
  }

  private getClient(): IL1Client {
    return this.client;
  }

  async insecureMintableTokenContract(
    tokenAddr: Address,
  ): Promise<InsecureMintableTokenContract> {
    const client = this.getClient();
    return await getContract({
      address: tokenAddr,
      abi: InsecureMintableTokenABI,
      client: {
        public: client.getPublicClient(),
        wallet: client.getWalletClient()
      },
    });
  }

  async mint(tokenAddr: Address, recipient: Address, amount: bigint): Promise<TransactionReceipt> {
    const token = await this.insecureMintableTokenContract(tokenAddr);
    const symbol = await token.read.symbol();
    const amountFmt = formatUnits(amount, await token.read.decimals());
    console.log(
      `Minting ${amount} (${amountFmt}) of ${tokenAddr} (${symbol}) to ${recipient}`,
    );

    const client = this.getClient();
    const walletClient = client.getWalletClient();
    const hash = await token.write.mint([recipient, amount], {
      account: walletClient.account!,
      chain: walletClient.chain || null,
    });
    console.log(`mint(${recipient}, ${amount}) tx hash:`, hash);
    const receipt = await client.getPublicClient().waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') {
      throw new Error(`mint() failed: ${receipt}`);
    }
    return receipt;
  }

  /**
   * Deploys a new InsecureMintableToken
   * @param name The token name
   * @param symbol The token symbol
   * @param decimals The token decimals
   * @returns The token address
   */
  static async deploy(
    client: IL1Client,
    name: string,
    symbol: string,
    decimals = 18,
  ): Promise<Address> {
    const walletClient = client.getWalletClient();
    const publicClient = client.getPublicClient();

    const hash = await walletClient.deployContract({
      abi: InsecureMintableTokenABI,
      bytecode: InsecureMintableTokenBytecode,
      args: [name, symbol, decimals],
      account: walletClient.account!,
      chain: walletClient.chain || null,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') {
      throw new Error(`deployInsecureMintableToken() failed: ${receipt}`);
    }

    const tokenAddress = receipt.contractAddress!;
    console.log(`Deployed token ${name} (${symbol}) at ${tokenAddress}`);
    return tokenAddress;
  }
}
