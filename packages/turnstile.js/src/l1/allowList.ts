import { getContract, GetContractReturnType, PublicClient, WalletClient } from 'viem';
import type {
  Address,
  TransactionReceipt,
} from 'viem';

import { AllowListABI } from '@turnstile-portal/l1-artifacts-abi';
import { IL1Client } from './client.js';

/**
 * AllowList contract interface
 */
export type AllowListContract = GetContractReturnType<
  typeof AllowListABI,
  { public: PublicClient; wallet: WalletClient },
  Address
>;

/**
 * Get the AllowList contract instance
 * @param allowListAddr AllowList contract address
 * @param client L1Client instance
 * @returns AllowList contract instance
 */
export function getL1AllowListContract(
  allowListAddr: Address,
  client: IL1Client,
): AllowListContract {
  return getContract({
    address: allowListAddr,
    abi: AllowListABI,
    client: {
      public: client.getPublicClient(),
      wallet: client.getWalletClient()
    },
  });
}

/**
 * L1 AllowList class for managing token allowlist operations
 *
 * This class provides methods to propose and accept addresses to the allowlist,
 * enabling controlled access to token operations through the portal system.
 */
export class L1AllowList {
  client: IL1Client;
  approver: IL1Client | undefined;
  allowListAddr: Address;
  // Make contract public for easy mocking in tests
  contract: AllowListContract;

  /**
   * Creates a new L1AllowList instance
   * @param allowListAddr The AllowList contract address on L1
   * @param client The L1 client instance for general operations
   * @param approver Optional L1 client instance with approver privileges
   */
  constructor(
    allowListAddr: Address,
    client: IL1Client,
    approver?: IL1Client,
  ) {
    this.allowListAddr = allowListAddr;
    this.client = client;
    this.approver = approver;

    // Initialize the contract instance
    this.contract = getL1AllowListContract(this.allowListAddr, this.client);
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
      account: this.client.getAddress(),
      chain: this.client.getWalletClient().chain,
    });

    console.debug(`propose(${address}) tx hash:`, hash);

    const receipt = await this.client.getPublicClient().waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') {
      throw new Error(`propose() failed: ${receipt}`);
    }

    return receipt;
  }

  /**
   * Accept an address to the allowlist
   * @param address Address to accept
   * @param approver Approver L1Client instance
   * @returns Transaction receipt
   * @throws Error if approver L1Client is not provided
   * @throws Error if accept() fails
   */
  async accept(
    address: Address,
    approver?: IL1Client,
  ): Promise<TransactionReceipt> {
    if (!approver) {
      if (!this.approver) {
        throw new Error('Approver L1Client not provided');
      }
      approver = this.approver;
    }

    const allowList = this.contract;

    console.debug(`Accepting ${address} to allowlist`);
    const hash = await allowList.write.accept([address], {
      account: approver.getAddress(),
      chain: approver.getWalletClient().chain,
    });
    console.debug(`accept(${address}) tx hash: `, hash);
    const receipt = await this.client.getPublicClient().waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') {
      throw new Error(`accept() failed: ${receipt} `);
    }

    return receipt;
  }

  /**
   * Checks if an address has approver privileges on the allowlist contract
   * @param address The address to check for approver status
   * @returns Promise resolving to true if the address is an approver, false otherwise
   */
  async isApprover(address: Address): Promise<boolean> {
    const allowList = this.contract;
    return await allowList.read.isApprover([address]);
  }
}
