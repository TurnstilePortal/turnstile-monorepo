import {
  Fr,
  AztecAddress,
  EthAddress,
  type Wallet,
  type LogFilter,
  type PXE,
  type SentTx,
} from '@aztec/aztec.js';
import type {
  EventMetadataDefinition,
  GetPublicLogsResponse,
} from '@aztec/stdlib/interfaces/client';
import { sha256ToField } from '@aztec/foundation/crypto';
import { PortalContract } from '@turnstile-portal/aztec-artifacts';
import { encodeFunctionData } from 'viem';

/**
 * The Aztec Portal contract.
 */
export const AztecPortalContract = PortalContract;

/**
 * ABI item for the withdraw function
 * The L2 to L1 withdraw message uses the hash of ABI encoded data in the form:
 * abi.encodeWithSignature("withdraw(address,address,uint256)", token, l2Recipient, amount)
 */
const WITHDRAW_ABI_ITEM = {
  inputs: [
    { name: 'token', type: 'address' },
    { name: 'l1Recipient', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
  name: 'withdraw',
  stateMutability: 'nonPayable',
  type: 'function',
};

/**
 * The Aztec Token Portal contract.
 */
export class AztecTokenPortal {
  // The not-secret secret used to send messages to L2
  static readonly PUBLIC_NOT_SECRET_SECRET = Fr.fromHexString('0x7075626c6963');

  portalAddr: AztecAddress;
  pxe: PXE;
  wallet: Wallet;
  portal: PortalContract | undefined;

  /**
   * Creates an instance of AztecTokenPortal.
   * @param {string} tokenPortalAddress - The address of the token portal contract.
   * @param {PXE} pxe - The PXE client.
   * @param {Wallet} wallet - The wallet to interact with the contract.
   */
  constructor(tokenPortalAddress: string, pxe: PXE, wallet: Wallet) {
    this.portalAddr = AztecAddress.fromString(tokenPortalAddress);
    this.pxe = pxe;
    this.wallet = wallet;
  }

  /**
   * Gets the Aztec Token Portal contract.
   * @returns {Promise<PortalContract>} - A promise that resolves to an instance of PortalContract.
   */
  async portalContract(): Promise<PortalContract> {
    if (!this.portal) {
      this.portal = await PortalContract.at(this.portalAddr, this.wallet);
    }
    return this.portal;
  }

  /**
   * Claim tokens deposited to the L2 chain to the recipient's public balance.
   * @param {string} l1TokenAddr - The L1 token address.
   * @param {string} l2RecipientAddr - The L2 recipient address.
   * @param {bigint} amount - The amount to deposit.
   * @param {bigint} index - The index of the L1ToL2Message.
   * @returns {Promise<SentTx>} - The sent transaction. Use `await tx.wait()` to wait for the transaction to be mined.
   */
  async claimDeposit(
    l1TokenAddr: string,
    l2RecipientAddr: string,
    amount: bigint,
    index: bigint,
  ): Promise<SentTx> {
    const portal = await this.portalContract();
    console.debug(
      `Claiming deposit on L2 for token ${l1TokenAddr} to recipient ${l2RecipientAddr} with index ${index}`,
    );

    return await portal.methods
      .claim_public(
        EthAddress.fromString(l1TokenAddr),
        AztecAddress.fromString(l2RecipientAddr),
        amount,
        Fr.fromHexString(`0x${index.toString(16)}`),
      )
      .send();
  }

  /**
   * Claim tokens deposited to the L2 chain to the recipient's private balance.
   * @param {string} l1TokenAddr - The L1 token address.
   * @param {string} l2RecipientAddr - The L2 recipient address.
   * @param {bigint} amount - The amount to deposit.
   * @param {bigint} index - The index of the L1ToL2Message.
   * @returns {Promise<SentTx>} - The sent transaction. Use `await tx.wait()` to wait for the transaction to be mined.
   */
  async claimDepositShielded(
    l1TokenAddr: string,
    l2RecipientAddr: string,
    amount: bigint,
    index: bigint,
  ): Promise<SentTx> {
    const portal = await this.portalContract();
    console.debug(
      `Claiming deposit on L2 for token ${l1TokenAddr} to recipient ${l2RecipientAddr} at index ${index}`,
    );

    return await portal.methods
      .claim_shielded(
        EthAddress.fromString(l1TokenAddr),
        AztecAddress.fromString(l2RecipientAddr),
        amount,
        Fr.fromHexString(`0x${index.toString(16)}`),
      )
      .send();
  }

  /**
   * Checks if a deposit is claimed on the L2 chain.
   * @param {number} l2BlockNumber - The L2 block number.
   * @param {string} hash - The hash of the L1ToL2Message.
   * @returns {Promise<boolean>} - A promise that resolves to true if the deposit is claimed.
   */
  async isClaimed(l2BlockNumber: number, hash: string): Promise<boolean> {
    if ((await this.pxe.getBlockNumber()) < l2BlockNumber) {
      return false;
    }

    try {
      await this.getL1ToL2MessageLeafIndex(hash);
      return false;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      // If the message is not found and the block is mind, then the message was claimed
      return true;
    }
  }

  /**
   * Registers a token on the L2 chain.
   * @param {string} l1TokenAddr - The L1 token address.
   * @param {string} l2TokenAddr - The L2 token address.
   * @param {string} name - The token name.
   * @param {string} symbol - The token symbol.
   * @param {number} decimals - The token decimals.
   * @param {string} hash - The hash of the L1ToL2Message.
   * @returns {Promise<SentTx>} - The sent transaction. Use `await tx.wait()` to wait for the transaction to be mined.
   * @throws {Error} - Throws an error if the L1ToL2Message is not found.
   * @throws {Error} - Throws an error if the transaction fails.
   */
  async registerToken(
    l1TokenAddr: string,
    l2TokenAddr: string,
    name: string,
    symbol: string,
    decimals: number,
    index: bigint,
  ): Promise<SentTx> {
    const portal = await this.portalContract();
    console.debug(
      `Registering L1 token ${l1TokenAddr} as L2 Token ${l2TokenAddr} on L2 portal ${this.portalAddr}`,
    );

    console.debug(`Message index: ${index}`);

    return await portal.methods
      .register_private(
        Fr.fromHexString(l1TokenAddr),
        AztecAddress.fromString(l2TokenAddr),
        name,
        name.length,
        symbol,
        symbol.length,
        decimals,
        Fr.fromHexString(`0x${index.toString(16)}`),
      )
      .send();
  }

  /**
   * Withdraws tokens from the L2 chain.
   * @param {string} l1TokenAddr - The L1 token address, used to identify the L2 token.
   * @param {string} l1RecipientAddr - The L1 recipient address.
   * @param {bigint} amount - The amount to withdraw.
   * @param {Fr} burnNonce - The burn nonce, as returned by `token.createBurnAuthWit()`.
   * @returns {Promise<{ tx: SentTx, leaf: Fr>} - The sent transaction and the L2 to L1 message hash. Use `await tx.wait()` to wait for the transaction to be mined.
   */
  async withdrawPublic(
    l1TokenAddr: string,
    l1RecipientAddr: string,
    amount: bigint,
    burnNonce: Fr,
  ): Promise<{ tx: SentTx; leaf: Fr }> {
    const portal = await this.portalContract();
    const from = this.wallet.getAddress();

    const l2TokenAddr = await portal.methods
      .get_l2_token(EthAddress.fromString(l1TokenAddr))
      .simulate();

    console.debug(
      `Withdrawing ${amount} from ${from} of Aztec Token ${l2TokenAddr} to recipient ${l1RecipientAddr} L1 Token ${l1TokenAddr}`,
    );

    const tx = await portal.methods
      .withdraw_public(
        EthAddress.fromString(l1TokenAddr),
        from,
        EthAddress.fromString(l1RecipientAddr),
        amount,
        Fr.ZERO, // withdrawNonce
        burnNonce,
      )
      .send();

    const leaf = await this.getL2ToL1MessageLeaf(
      l1TokenAddr,
      l1RecipientAddr,
      amount,
    );

    return { tx, leaf };
  }

  /**
   * Gets the leaf index of an L1ToL2Message.
   * @param {string} l1ToL2Message - The L1ToL2Message hash.
   * @returns {Promise<number>} - A promise that resolves to the leaf index of the L1ToL2Message.
   * @throws {Error} - Throws an error if the L1ToL2Message is not found.
   */
  async getL1ToL2MessageLeafIndex(l1ToL2Message: string): Promise<number> {
    console.log(`Getting L1ToL2Message leaf index for ${l1ToL2Message}`);
    const wit = await this.pxe.getL1ToL2MembershipWitness(
      this.portalAddr,
      Fr.fromHexString(l1ToL2Message),
      AztecTokenPortal.PUBLIC_NOT_SECRET_SECRET,
    );
    if (!wit) {
      throw new Error(
        `No membership witness found for L1ToL2Message ${l1ToL2Message}`,
      );
    }
    const [messageIndex] = wit;
    console.debug(`L1ToL2Message ${l1ToL2Message} is at index ${messageIndex}`);
    //console.debug(`sibling path: ${ siblingPath }`);
    return Number(messageIndex);
  }

  /**
   * Gets the leaf index of an L2ToL1Message.
   * @param {string} l1TokenAddr - The L1 token address.
   * @param {string} l1RecipientAddr - The L1 recipient address.
   * @param {bigint} amount - The amount being withdrawn.
   * @returns {Promise<Fr>} - A promise that resolves to the leaf of the L2ToL1Message.
   *
   */
  async getL2ToL1MessageLeaf(
    l1TokenAddr: string,
    l1RecipientAddr: string,
    amount: bigint,
  ): Promise<Fr> {
    const l1PortalAddr = await this.getL1Portal();

    // Using this to get the L1 Chain ID
    const nodeInfo = await this.pxe.getNodeInfo();

    const encoded = AztecTokenPortal.encodeWithdrawData(
      l1TokenAddr,
      l1RecipientAddr,
      amount,
    );
    const content = sha256ToField([
      Buffer.from(encoded.replace(/^0x/, ''), 'hex'),
    ]);

    // The leaf is the hash of (L2Actor, L1Actor, content)
    // https://docs.aztec.network/reference/developer_references/smart_contract_reference/portals/data_structures#l2tol1message
    const leafData = [
      // L2Actor
      this.portalAddr.toBuffer(), // Sender (Aztec Portal)
      new Fr(1).toBuffer(), // Aztec version. TODO: does Aztec.js have a constant for this?
      // L1Actor
      l1PortalAddr.toBuffer32(), // Recipient (L1 Portal)
      new Fr(nodeInfo.l1ChainId).toBuffer(),
      // Content
      content.toBuffer(),
    ];
    console.debug(
      `L2ToL1Message leaf data: ${leafData.map((b) => b.toString('hex')).join(' ')}`,
    );
    const leaf = sha256ToField(leafData);
    console.debug(`L2ToL1Message leaf: ${leaf.toString()}`);

    return leaf;
  }

  /**
   * Checks if a token is registered with the portal on L2 by its L1 address.
   * @param {string} l1TokenAddr - The L1 token address.
   * @returns {Promise<boolean>} - A promise that resolves to true if the token is registered on L2.
   */
  async isRegisteredByL1Address(l1TokenAddr: string): Promise<boolean> {
    const portal = await this.portalContract();
    return await portal.methods
      .is_registered_l1(EthAddress.fromString(l1TokenAddr))
      .simulate();
  }

  /**
   * Checks if a token is registered with the portal on L2 by its L2 address.
   * @param {string} l2TokenAddr - The L2 token address.
   * @returns {Promise<boolean>} - A promise that resolves to true if the token is registered on L1
   */
  async isRegisteredByL2Address(l2TokenAddr: string): Promise<boolean> {
    const portal = await this.portalContract();
    return await portal.methods
      .is_registered_l2(AztecAddress.fromString(l2TokenAddr))
      .simulate();
  }

  /**
   * Gets the logs for the portal contract.
   * @param {number} fromBlock - The block number to start from.
   * @param {number} toBlock - The block number to end at.
   * @returns {Promise<GetPublicLogsResponse>} - A promise that resolves to the logs.
   */
  async getLogs(
    fromBlock: number | undefined = undefined,
    toBlock: number | undefined = undefined,
  ): Promise<GetPublicLogsResponse> {
    // TODO: make decoding logs work. Should be using `AztecPortalContract.events.<event>.decode()`
    const portal = await this.portalContract();
    const filter: LogFilter = {
      fromBlock: fromBlock,
      toBlock: toBlock,
      contractAddress: portal.address,
    };
    return await this.pxe.getPublicLogs(filter);
  }

  /**
   * Gets the events from the portal contract.
   * @param {number} fromBlock - The block number to start from.
   * @param {number} limit - The maximum number of events to return.
   * @returns {Promise<T>} - A promise that resolves to the events.
   * @typeparam T - The type of the events.
   */
  async getPublicEvents<T>(
    eventMetadata: EventMetadataDefinition,
    fromBlock = 0,
    limit = 100,
  ): Promise<T[]> {
    return this.pxe.getPublicEvents(
      eventMetadata,
      fromBlock ? fromBlock : 0,
      limit ? limit : 100,
    );
  }

  /**
   * Gets the L2 token address for an L1 token.
   * @param {string} l1TokenAddr - The L1 token address.
   * @returns {Promise<any>} - A promise that resolves to the L2 token address.
   */
  async getL2Token(l1TokenAddr: string): Promise<AztecAddress> {
    const portal = await this.portalContract();
    const result = await portal.methods
      .get_l2_token(EthAddress.fromString(l1TokenAddr))
      .simulate();
    return AztecAddress.fromBigInt(result);
  }

  /**
   * Gets the L1 token address for an L2 token.
   * @param {string} l2TokenAddr - The L2 token address.
   * @returns {Promise<any>} - A promise that resolves to the L1 token address.
   */
  async getL1Token(l2TokenAddr: string): Promise<EthAddress> {
    const portal = await this.portalContract();
    const result = await portal.methods
      .get_l1_token(AztecAddress.fromString(l2TokenAddr))
      .simulate();
    return EthAddress.fromString(
      `0x${result.inner.toString(16).padStart(40, '0')}`,
    );
  }

  /**
   * Gets the L1 Portal address
   * @returns {string} - The L1 Portal address
   */
  async getL1Portal(): Promise<EthAddress> {
    const portal = await this.portalContract();
    const result = await portal.methods.get_l1_portal().simulate();
    return EthAddress.fromString(
      `0x${result.inner.toString(16).padStart(40, '0')}`,
    );
  }

  /**
   * Encode the withdraw data used for the L2 to L1 withdraw message.
   * @param {string} l1TokenAddr - The L1 token address.
   * @param {string} l1RecipientAddr - The L1 recipient address.
   * @param {bigint} amount - The amount to withdraw.
   */
  static encodeWithdrawData(
    l1TokenAddr: string,
    l1RecipientAddr: string,
    amount: bigint,
  ) {
    const args = [l1TokenAddr, l1RecipientAddr, amount];

    const encoded = encodeFunctionData({
      abi: [WITHDRAW_ABI_ITEM],
      functionName: 'withdraw',
      args: args,
    });

    return encoded;
  }
}
