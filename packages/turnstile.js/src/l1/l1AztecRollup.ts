import { getContract } from 'viem';
import type {
  Address,
  PublicClient,
  GetContractReturnType,
} from 'viem';

import { InboxAbi, OutboxAbi, RollupAbi } from '@aztec/l1-artifacts';

export type AztecRollupContract = GetContractReturnType<
  typeof RollupAbi,
  PublicClient,
  Address
>;

export type AztecOutboxContract = GetContractReturnType<
  typeof OutboxAbi,
  PublicClient,
  Address
>;

export type AztecInboxContract = GetContractReturnType<
  typeof InboxAbi,
  PublicClient,
  Address
>;

export async function getAztecRollupContract(
  rollupAddr: Address,
  client: PublicClient,
): Promise<AztecRollupContract> {

  return getContract({
    address: rollupAddr,
    abi: RollupAbi,
    client,
  });
}

export async function getAztecOutboxContract(
  outboxAddr: Address,
  client: PublicClient,
): Promise<AztecOutboxContract> {

  return getContract({
    address: outboxAddr,
    abi: OutboxAbi,
    client,
  });
}

export async function getAztecInboxContract(
  inboxAddr: Address,
  client: PublicClient,
): Promise<AztecInboxContract> {

  return getContract({
    address: inboxAddr,
    abi: InboxAbi,
    client,
  });
}


export class AztecRollup {
  private publicClient: PublicClient;

  private rollupAddr: Address;
  private inboxAddr: Address | undefined;
  private outboxAddr: Address | undefined;

  private rollup: AztecRollupContract | undefined;
  private inbox: AztecInboxContract | undefined;
  private outbox: AztecOutboxContract | undefined;

  constructor(publicClient: PublicClient, rollup: Address, inbox?: Address, outbox?: Address) {
    this.publicClient = publicClient;
    this.rollupAddr = rollup;
    this.inboxAddr = inbox;
    this.outboxAddr = outbox;
  }

  async getRollup(): Promise<AztecRollupContract> {
    if (!this.rollup) {
      this.rollup = await getAztecRollupContract(this.rollupAddr, this.publicClient);
    }
    return this.rollup;
  }

  async getInbox(): Promise<AztecInboxContract> {
    if (!this.inbox) {
      if (!this.inboxAddr) {
        const rollup = await this.getRollup();
        this.inboxAddr = await rollup.read.getInbox();
      }
      this.inbox = await getAztecInboxContract(this.inboxAddr, this.publicClient);
    }
    return this.inbox;
  }

  async getOutbox(): Promise<AztecOutboxContract> {
    if (!this.outbox) {
      if (!this.outboxAddr) {
        const rollup = await this.getRollup();
        this.outboxAddr = await rollup.read.getOutbox();
      }
      this.outbox = await getAztecOutboxContract(this.outboxAddr, this.publicClient);
    }
    return this.outbox;
  }

  /**
   * Check if a messages has been consumed from the Aztec Rollup Outbox
   */
  async isOutboxMessageConsumed(l2BlockNumber: bigint, leafIndex: bigint): Promise<boolean> {
    const outbox = await this.getOutbox();
    return outbox.read.hasMessageBeenConsumedAtBlockAndIndex([l2BlockNumber, leafIndex]);
  }

  /**
   * Get the pending and proven L2 block numbers from the Aztec Rollup contract
   */
  async getChainTips(): Promise<{ pendingL2BlockNumber: bigint, provenL2BlockNumber: bigint }> {
    const rollup = await this.getRollup();
    const { pendingBlockNumber, provenBlockNumber } = await rollup.read.getTips();
    return { pendingL2BlockNumber: pendingBlockNumber, provenL2BlockNumber: provenBlockNumber };
  }

}
