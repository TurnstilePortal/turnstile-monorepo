import { formatUnits, getContract, Client, GetContractReturnType } from 'viem';
import type {
  Account,
  Address,
  Chain,
  Transport,
  WalletClient,
  PublicClient,
} from 'viem';

import {
  InsecureMintableTokenABI,
  InsecureMintableTokenBytecode,
} from '@turnstile-portal/l1-artifacts-dev';

import { L1Token } from '@turnstile-portal/turnstile.js';

export type InsecureMintableTokenContract = GetContractReturnType<
  typeof InsecureMintableTokenABI,
  Client,
  Address
>;

export class InsecureMintableToken extends L1Token {
  constructor(wc: WalletClient<Transport, Chain, Account>, pc: PublicClient) {
    super(wc, pc);
  }

  async insecureMintableTokenContract(
    tokenAddr: Address,
  ): Promise<InsecureMintableTokenContract> {
    return await getContract({
      address: tokenAddr,
      abi: InsecureMintableTokenABI,
      client: { public: this.pc, wallet: this.wc },
    });
  }

  async mint(tokenAddr: Address, recipient: Address, amount: bigint) {
    const token = await this.insecureMintableTokenContract(tokenAddr);
    const symbol = await token.read.symbol();
    const amountFmt = formatUnits(amount, await token.read.decimals());
    console.log(
      `Minting ${amount} (${amountFmt}) of ${tokenAddr} (${symbol}) to ${recipient}`,
    );

    const hash = await token.write.mint([recipient, amount], {
      account: this.wc.account,
      chain: this.wc.chain,
    });
    console.log(`mint(${recipient}, ${amount}) tx hash:`, hash);
    const receipt = await this.pc.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') {
      throw new Error(`mint() failed: ${receipt}`);
    }
  }

  async deployInsecureMintableToken(
    name: string,
    symbol: string,
    decimals = 18,
  ): Promise<Address> {
    const hash = await this.wc.deployContract({
      abi: InsecureMintableTokenABI,
      bytecode: InsecureMintableTokenBytecode,
      args: [name, symbol, decimals],
    });
    const receipt = await this.pc.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') {
      throw new Error(`deployInsecureMintableToken() failed: ${receipt}`);
    }
    return receipt.contractAddress!;
  }
}
