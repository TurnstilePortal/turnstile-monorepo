import { getContract, Client, GetContractReturnType } from 'viem';
import type {
  Account,
  Address,
  Chain,
  Transport,
  TransactionReceipt,
  WalletClient,
  PublicClient,
} from 'viem';

import { IAllowListABI } from '@turnstile-portal/l1-artifacts-abi';

/**
 * AllowList contract interface
 */
export type AllowListContract = GetContractReturnType<
  typeof IAllowListABI,
  Client,
  Address
>;

/**
 * Get the AllowList contract instance
 * @param allowListAddr AllowList contract address
 * @param client Client instance
 * @returns AllowList contract instance
 */
export function getL1AllowListContract(
  allowListAddr: Address,
  client: Client | { public: PublicClient; wallet: WalletClient },
): AllowListContract {
  return getContract({
    address: allowListAddr,
    abi: IAllowListABI,
    client,
  });
}

/**
 * L1 AllowList class
 */
export class L1AllowList {
  wc: WalletClient<Transport, Chain, Account>;
  approver: WalletClient<Transport, Chain, Account> | undefined;
  pc: PublicClient;
  allowListAddr: Address;
  // Make contract public for easy mocking in tests
  contract: AllowListContract;

  /**
   * Constructor
   * @param allowListAddr AllowList contract address
   * @param wc Wallet client instance
   * @param pc Public client instance
   * @param approver Approver wallet client instance
   */
  constructor(
    allowListAddr: Address,
    wc: WalletClient<Transport, Chain, Account>,
    pc: PublicClient,
    approver?: WalletClient<Transport, Chain, Account>,
  ) {
    this.allowListAddr = allowListAddr;
    this.wc = wc;
    this.pc = pc;
    this.approver = approver;

    // Initialize the contract instance
    this.contract = getL1AllowListContract(this.allowListAddr, {
      public: this.pc,
      wallet: this.wc,
    });
  }

  /**
   * Get the AllowList contract instance
   * @param wallet Wallet client instance
   * @returns AllowList contract instance
   */
  allowListContract(
    wallet: WalletClient<Transport, Chain, Account> = this.wc,
  ): AllowListContract {
    return this.contract;
  }

  /**
   * Propose an address to the allowlist
   * @param address Address to propose
   * @returns Transaction receipt
   */
  async propose(address: Address): Promise<TransactionReceipt> {
    const allowList = this.contract;

    console.debug(`Proposing ${address} to allowlist`);
    const hash = await allowList.write.propose([address], {
      account: this.wc.account,
      chain: this.wc.chain,
    });

    console.debug(`propose(${address}) tx hash:`, hash);

    const receipt = await this.pc.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') {
      throw new Error(`propose() failed: ${receipt}`);
    }

    return receipt;
  }

  /**
   * Accept an address to the allowlist
   * @param address Address to accept
   * @param approver Approver wallet client instance
   * @returns Transaction receipt
   * @throws Error if approver wallet client is not provided
   * @throws Error if accept() fails
   */
  async accept(
    address: Address,
    approver?: WalletClient<Transport, Chain, Account>,
  ): Promise<TransactionReceipt> {
    if (!approver) {
      if (!this.approver) {
        throw new Error('Approver wallet client not provided');
      }
      approver = this.approver;
    }

    const allowList = this.contract;

    console.debug(`Accepting ${address} to allowlist`);
    const hash = await allowList.write.accept([address], {
      account: approver.account,
      chain: approver.chain,
    });
    console.debug(`accept(${address}) tx hash: `, hash);
    const receipt = await this.pc.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') {
      throw new Error(`accept() failed: ${receipt} `);
    }

    return receipt;
  }
}
