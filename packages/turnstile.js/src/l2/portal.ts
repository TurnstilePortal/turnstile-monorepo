import {
  AztecAddress,
  type ContractFunctionInteraction,
  type ContractInstanceWithAddress,
  type DeployOptions,
  decodeFromAbi,
  EthAddress,
  EventSelector,
  Fr,
  getContractInstanceFromInstantiationParams,
  type LogFilter,
  type LogId,
  PublicKeys,
  type SendMethodOptions,
  type SentTx,
  type TxHash,
  TxStatus,
} from '@aztec/aztec.js';
import { sha256ToField } from '@aztec/foundation/crypto';
import { serializeToBuffer } from '@aztec/foundation/serialize';
import { OutboxAbi } from '@aztec/l1-artifacts/OutboxAbi';
import type { EventMetadataDefinition, GetPublicLogsResponse } from '@aztec/stdlib/interfaces/client';
import type { ExtendedPublicLog } from '@aztec/stdlib/logs';
import {
  computeL2ToL1MembershipWitness,
  getNonNullifiedL1ToL2MessageWitness,
  type L2ToL1MembershipWitness,
} from '@aztec/stdlib/messaging';
import {
  PortalContract,
  PortalContractArtifact,
  ShieldGatewayContract,
  TokenContractArtifact,
} from '@turnstile-portal/aztec-artifacts';
import { encodeFunctionData, getContract } from 'viem';
import { createError, ErrorCode, isTurnstileError } from '../errors.js';
import type { IL1Client } from '../l1/client.js';
import { L1Token } from '../l1/token.js';
import type { Hex } from '../types.js';
import type { IL2Client } from './client.js';
import { L2_CONTRACT_DEPLOYMENT_SALT, PUBLIC_NOT_SECRET_SECRET } from './constants.js';
import { ContractBatchBuilder } from './contract-interaction.js';
import { registerShieldGatewayInPXE } from './shield-gateway.js';
import { L2Token } from './token.js';

export type PortalConfig = {
  l1_portal: EthAddress;
  shield_gateway: AztecAddress;
  token_contract_class_id: Fr;
};

/**
 * Interface for L2 portal operations
 */
export interface IL2Portal {
  /**
   * Gets the portal address
   * @returns The portal address
   */
  getAddress(): AztecAddress;

  /**
   * Gets the L1 portal address
   * @returns The L1 portal address
   * @throws {TurnstileError} With ErrorCode.L2_CONTRACT_INTERACTION if configuration retrieval fails
   */
  getL1Portal(): Promise<EthAddress>;

  /**
   * Creates a batch builder for multiple portal operations
   * @returns A batch builder instance
   */
  batch(): ContractBatchBuilder;

  /**
   * Claim tokens deposited to the L2 chain to the recipient's public balance
   * @param l1TokenAddr The L1 token address
   * @param l2RecipientAddr The L2 recipient address
   * @param amount The amount to deposit
   * @param index The index of the L1ToL2Message
   * @param options Transaction options
   * @returns The transaction
   * @throws {TurnstileError} With ErrorCode.BRIDGE_DEPOSIT if claiming fails
   */
  claimDeposit(
    l1TokenAddr: Hex,
    l2RecipientAddr: Hex,
    amount: bigint,
    index: bigint,
    options: SendMethodOptions,
  ): Promise<SentTx>;

  /**
   * Claim tokens deposited to the L2 chain to the recipient's private balance
   * @param l1TokenAddr The L1 token address
   * @param l2RecipientAddr The L2 recipient address
   * @param amount The amount to deposit
   * @param index The index of the L1ToL2Message
   * @param options Transaction options
   * @returns The transaction
   * @throws {TurnstileError} With ErrorCode.BRIDGE_DEPOSIT if claiming fails
   */
  claimDepositShielded(
    l1TokenAddr: Hex,
    l2RecipientAddr: Hex,
    amount: bigint,
    index: bigint,
    options: SendMethodOptions,
  ): Promise<SentTx>;

  /**
   * Checks if a deposit is claimed on the L2 chain
   * @param hash The hash of the L1ToL2Message
   * @returns True if the deposit is claimed
   * @throws {TurnstileError} With ErrorCode.BRIDGE_MESSAGE if check fails
   */
  isClaimed(hash: Hex): Promise<boolean>;

  /**
   * Registers a token on the L2 chain
   * @param l1TokenAddr The L1 token address
   * @param l2TokenAddr The L2 token address
   * @param name The token name
   * @param symbol The token symbol
   * @param decimals The token decimals
   * @param index The index of the L1ToL2Message
   * @param options Transaction options
   * @returns The transaction
   * @throws {TurnstileError} With ErrorCode.BRIDGE_REGISTER if registration fails
   */
  registerToken(
    l1TokenAddr: Hex,
    l2TokenAddr: Hex,
    name: string,
    symbol: string,
    decimals: number,
    index: bigint,
    options: SendMethodOptions,
  ): Promise<SentTx>;

  /**
   * Withdraws tokens from the L2 chain
   * @param l1TokenAddr The L1 token address
   * @param l1RecipientAddr The L1 recipient address
   * @param amount The amount to withdraw
   * @param burnNonce The burn nonce
   * @param sendMethodOptions Optional transaction options
   * @returns Object containing the transaction and the encoded withdrawal data
   * @dev Once the transaction is mined, you can get the L2 block number from the receipt and use it to get the membership witness with `getL2ToL1MembershipWitness()`
   */
  withdrawPublic(
    l1TokenAddr: Hex,
    l1RecipientAddr: Hex,
    amount: bigint,
    burnNonce: Fr,
    sendMethodOptions: SendMethodOptions,
  ): Promise<{ tx: SentTx; withdrawData: Hex }>;

  /**
   * Gets the L2 token address for an L1 token
   * @param l1TokenAddr The L1 token address
   * @returns The L2 token address
   */
  getL2TokenFromL1Address(l1TokenAddr: Hex): Promise<AztecAddress>;

  /**
   * Gets the L1 token address for an L2 token
   * @param l2TokenAddr The L2 token address
   * @returns The L1 token address
   */
  getL1TokenFromL2Address(l2TokenAddr: Hex): Promise<EthAddress>;

  /**
   * Checks if a token is registered with the portal on L2 by its L1 address
   * @param l1TokenAddr The L1 token address
   * @returns True if the token is registered on L2
   */
  isRegisteredByL1Address(l1TokenAddr: Hex): Promise<boolean>;

  /**
   * Checks if a token is registered with the portal on L2 by its L2 address
   * @param l2TokenAddr The L2 token address
   * @returns True if the token is registered on L1
   */
  isRegisteredByL2Address(l2TokenAddr: Hex): Promise<boolean>;

  /**
   * Batch transaction to deploy a new L2 token contract and register it with the portal
   * @param l1TokenAddr The L1 token address
   * @param name The token name
   * @param symbol The token symbol
   * @param decimals The token decimals
   * @param index The index of the L1ToL2Message registration messge
   * @param sendMethodOptions Transaction options
   * @return The deployed token instance and transaction hash
   */
  deployAndRegisterL2Token(
    l1TokenAddr: Hex,
    name: string,
    symbol: string,
    decimals: number,
    index: bigint, // L1ToL2Message registeration message index
    sendMethodOptions: SendMethodOptions,
  ): Promise<{ instance: ContractInstanceWithAddress; txHash: TxHash }>;
}

/**
 * Implementation of IL2Portal for the Aztec portal contract
 */
export class L2Portal implements IL2Portal {
  // The not-secret secret used to send messages to L2
  static readonly PUBLIC_NOT_SECRET_SECRET = PUBLIC_NOT_SECRET_SECRET;

  private portalAddr: AztecAddress;
  private client: IL2Client;
  private l1Client?: IL1Client;
  private portal?: PortalContract;
  private config?: PortalConfig;

  /**
   * Creates a new L2Portal
   * @param portalAddr The portal address
   * @param client The L2 client
   */
  constructor(portalAddr: AztecAddress, client: IL2Client, l1Client?: IL1Client) {
    this.portalAddr = portalAddr;
    this.client = client;
    this.l1Client = l1Client;
  }

  /**
   * Gets the portal address
   * @returns The portal address
   */
  getAddress(): AztecAddress {
    return this.portalAddr;
  }

  /**
   * Gets the portal contract instance
   * @returns The portal contract
   */
  async getInstance(): Promise<PortalContract> {
    if (!this.portal) {
      this.portal = await PortalContract.at(this.portalAddr, this.client.getWallet());
    }
    return this.portal;
  }

  async getConfig(): Promise<PortalConfig> {
    if (this.config) {
      return this.config;
    }

    try {
      const portal = await this.getInstance();
      const config = await portal.methods.get_config_public().simulate({ from: this.client.getAddress() });

      this.config = {
        l1_portal: EthAddress.fromField(new Fr(config.l1_portal.inner)),
        shield_gateway: config.shield_gateway,
        token_contract_class_id: new Fr(config.token_contract_class_id.inner),
      };
      return this.config;
    } catch (error) {
      throw createError(
        ErrorCode.L2_CONTRACT_INTERACTION,
        `Failed to get portal configuration from ${this.portalAddr}`,
        { portalAddress: this.portalAddr.toString() },
        error,
      );
    }
  }

  /**
   * Gets the L1 portal address
   * @returns The L1 portal address
   */
  async getL1Portal(): Promise<EthAddress> {
    const config = await this.getConfig();
    return config.l1_portal;
  }

  /**
   * Creates a batch builder for multiple portal operations
   * @returns A batch builder instance
   */
  batch(): ContractBatchBuilder {
    return new ContractBatchBuilder(this.client.getWallet());
  }

  /**
   * Prepares a claim deposit interaction that can be batched or sent directly
   * @param l1TokenAddr The L1 token address
   * @param l2RecipientAddr The L2 recipient address
   * @param amount The amount to deposit
   * @param index The index of the L1ToL2Message
   * @returns The interaction that can be sent or batched
   */
  async prepareClaimDeposit(
    l1TokenAddr: Hex,
    l2RecipientAddr: Hex,
    amount: bigint,
    index: bigint,
  ): Promise<ContractFunctionInteraction> {
    const portal = await this.getInstance();
    return portal.methods.claim_public(
      EthAddress.fromString(l1TokenAddr),
      AztecAddress.fromString(l2RecipientAddr),
      amount,
      Fr.fromHexString(`0x${index.toString(16)}`),
    );
  }

  /**
   * Claim tokens deposited to the L2 chain to the recipient's public balance
   * @param l1TokenAddr The L1 token address
   * @param l2RecipientAddr The L2 recipient address
   * @param amount The amount to deposit
   * @param index The index of the L1ToL2Message
   * @param options Transaction options
   * @returns The transaction
   */
  async claimDeposit(
    l1TokenAddr: Hex,
    l2RecipientAddr: Hex,
    amount: bigint,
    index: bigint,
    options: SendMethodOptions,
  ): Promise<SentTx> {
    try {
      const interaction = await this.prepareClaimDeposit(l1TokenAddr, l2RecipientAddr, amount, index);
      return interaction.send(options);
    } catch (error) {
      throw createError(
        ErrorCode.BRIDGE_DEPOSIT,
        `Failed to claim deposit for token ${l1TokenAddr} to recipient ${l2RecipientAddr}`,
        {
          l1TokenAddress: l1TokenAddr,
          l2RecipientAddress: l2RecipientAddr,
          amount: amount.toString(),
          index: index.toString(),
        },
        error,
      );
    }
  }

  /**
   * Prepares a claim deposit shielded interaction that can be batched or sent directly
   * @param l1TokenAddr The L1 token address
   * @param l2RecipientAddr The L2 recipient address
   * @param amount The amount to deposit
   * @param index The index of the L1ToL2Message
   * @returns The interaction that can be sent or batched
   */
  async prepareClaimDepositShielded(
    l1TokenAddr: Hex,
    l2RecipientAddr: Hex,
    amount: bigint,
    index: bigint,
  ): Promise<ContractFunctionInteraction> {
    const portal = await this.getInstance();
    return portal.methods.claim_shielded(
      EthAddress.fromString(l1TokenAddr),
      AztecAddress.fromString(l2RecipientAddr),
      amount,
      Fr.fromHexString(`0x${index.toString(16)}`),
    );
  }

  /**
   * Claim tokens deposited to the L2 chain to the recipient's private balance
   * @param l1TokenAddr The L1 token address
   * @param l2RecipientAddr The L2 recipient address
   * @param amount The amount to deposit
   * @param index The index of the L1ToL2Message
   * @param options Transaction options
   * @returns The transaction
   */
  async claimDepositShielded(
    l1TokenAddr: Hex,
    l2RecipientAddr: Hex,
    amount: bigint,
    index: bigint,
    options: SendMethodOptions,
  ): Promise<SentTx> {
    try {
      const interaction = await this.prepareClaimDepositShielded(l1TokenAddr, l2RecipientAddr, amount, index);
      return interaction.send(options);
    } catch (error) {
      throw createError(
        ErrorCode.BRIDGE_DEPOSIT,
        `Failed to claim shielded deposit for token ${l1TokenAddr} to recipient ${l2RecipientAddr}`,
        {
          l1TokenAddress: l1TokenAddr,
          l2RecipientAddress: l2RecipientAddr,
          amount: amount.toString(),
          index: index.toString(),
        },
        error,
      );
    }
  }

  /**
   * Checks if a deposit is claimed on the L2 chain
   * @param l2BlockNumber The L2 block number
   * @param hash The hash of the L1ToL2Message
   * @returns True if the deposit is claimed
   */
  async isClaimed(hash: Hex): Promise<boolean> {
    try {
      const node = this.client.getNode();

      try {
        await getNonNullifiedL1ToL2MessageWitness(
          node,
          this.getAddress(),
          Fr.fromHexString(hash),
          PUBLIC_NOT_SECRET_SECRET,
        );
        return false;
      } catch (_err) {
        // If the message is not found and the block is mined, then the message was claimed
        return true;
      }
    } catch (error) {
      throw createError(
        ErrorCode.BRIDGE_MESSAGE,
        `Failed to check if deposit is claimed for hash ${hash}`,
        {
          hash,
        },
        error,
      );
    }
  }

  /**
   * Prepares a register token interaction that can be batched or sent directly
   * @param l1TokenAddr The L1 token address
   * @param l2TokenAddr The L2 token address
   * @param name The token name
   * @param symbol The token symbol
   * @param decimals The token decimals
   * @param index The index of the L1ToL2Message
   * @returns The interaction that can be sent or batched
   */
  async prepareRegisterToken(
    l1TokenAddr: Hex,
    l2TokenAddr: Hex,
    name: string,
    symbol: string,
    decimals: number,
    index: bigint,
  ): Promise<ContractFunctionInteraction> {
    const portal = await this.getInstance();
    return portal.methods.register_private(
      EthAddress.fromString(l1TokenAddr),
      AztecAddress.fromString(l2TokenAddr),
      name,
      name.length,
      symbol,
      symbol.length,
      decimals,
      Fr.fromHexString(`0x${index.toString(16)}`),
    );
  }

  /**
   * Registers a token on the L2 chain
   * @param l1TokenAddr The L1 token address
   * @param l2TokenAddr The L2 token address
   * @param name The token name
   * @param symbol The token symbol
   * @param decimals The token decimals
   * @param index The index of the L1ToL2Message
   * @param options Transaction options
   * @returns The transaction
   */
  async registerToken(
    l1TokenAddr: Hex,
    l2TokenAddr: Hex,
    name: string,
    symbol: string,
    decimals: number,
    index: bigint,
    options: SendMethodOptions,
  ): Promise<SentTx> {
    try {
      const interaction = await this.prepareRegisterToken(l1TokenAddr, l2TokenAddr, name, symbol, decimals, index);
      return interaction.send(options);
    } catch (error) {
      throw createError(
        ErrorCode.BRIDGE_REGISTER,
        `Failed to register token ${l1TokenAddr} as ${l2TokenAddr}`,
        {
          l1TokenAddress: l1TokenAddr,
          l2TokenAddress: l2TokenAddr,
          tokenName: name,
          tokenSymbol: symbol,
          decimals,
        },
        error,
      );
    }
  }

  /**
   * Prepares a withdraw public interaction that can be batched or sent directly
   * @param l1TokenAddr The L1 token address
   * @param l1RecipientAddr The L1 recipient address
   * @param amount The amount to withdraw
   * @param burnNonce The burn nonce
   * @returns Object containing the interaction and encoded withdrawal data
   */
  async prepareWithdrawPublic(
    l1TokenAddr: Hex,
    l1RecipientAddr: Hex,
    amount: bigint,
    burnNonce: Fr,
  ): Promise<{ interaction: ContractFunctionInteraction; withdrawData: Hex }> {
    const portal = await this.getInstance();
    const from = this.client.getAddress();

    const interaction = portal.methods.withdraw_public(
      EthAddress.fromString(l1TokenAddr),
      from,
      EthAddress.fromString(l1RecipientAddr),
      amount,
      Fr.ZERO, // withdrawNonce
      burnNonce,
    );

    const withdrawData = this.encodeWithdrawData(l1TokenAddr, l1RecipientAddr, amount);

    return { interaction, withdrawData };
  }

  /**
   * Withdraws tokens from the L2 chain
   * @param l1TokenAddr The L1 token address
   * @param l1RecipientAddr The L1 recipient address
   * @param amount The amount to withdraw
   * @param burnNonce The burn nonce
   * @param sendMethodOptions Transaction options
   * @returns Object containing the transaction and the encoded withdrawal data
   * @throws {TurnstileError} With ErrorCode.BRIDGE_WITHDRAW if the withdrawal fails
   */
  async withdrawPublic(
    l1TokenAddr: Hex,
    l1RecipientAddr: Hex,
    amount: bigint,
    burnNonce: Fr,
    sendMethodOptions: SendMethodOptions,
  ): Promise<{ tx: SentTx; withdrawData: Hex }> {
    try {
      const { interaction, withdrawData } = await this.prepareWithdrawPublic(
        l1TokenAddr,
        l1RecipientAddr,
        amount,
        burnNonce,
      );

      const tx = interaction.send(sendMethodOptions);

      return { tx, withdrawData };
    } catch (error) {
      throw createError(
        ErrorCode.BRIDGE_WITHDRAW,
        `Failed to withdraw ${amount} tokens to ${l1RecipientAddr}`,
        {
          l1TokenAddress: l1TokenAddr,
          l1RecipientAddress: l1RecipientAddr,
          amount: amount.toString(),
        },
        error,
      );
    }
  }

  /**
   * Gets the L2 token address for an L1 token
   * @param l1TokenAddr The L1 token address
   * @returns The L2 token address
   */
  async getL2TokenFromL1Address(l1TokenAddr: Hex, registerInPXE?: boolean): Promise<AztecAddress> {
    try {
      const portal = await this.getInstance();
      const simulationResult = await portal.methods
        .get_l2_token_unconstrained(EthAddress.fromString(l1TokenAddr))
        .simulate({ from: this.client.getAddress() });

      const l2TokenAddr =
        typeof simulationResult === 'bigint'
          ? AztecAddress.fromBigInt(simulationResult)
          : AztecAddress.fromString(simulationResult.toString());

      if (registerInPXE) {
        if (this.l1Client) {
          const l1Token = new L1Token(l1TokenAddr, this.l1Client);
          const name = await l1Token.getName();
          const symbol = await l1Token.getSymbol();
          const decimals = await l1Token.getDecimals();
          await L2Token.register(
            this.client,
            l2TokenAddr,
            this.getAddress() /* portal address */,
            name,
            symbol,
            decimals,
          );
          console.debug(`Registered L2 token ${l2TokenAddr.toString()} in PXE`);
        } else {
          console.warn('L1 client not provided, cannot register token in PXE');
        }
      }
      return l2TokenAddr;
    } catch (error) {
      throw createError(
        ErrorCode.L2_TOKEN_OPERATION,
        `Failed to get L2 token for L1 token ${l1TokenAddr}`,
        { l1TokenAddress: l1TokenAddr },
        error,
      );
    }
  }

  /**
   * Gets the L1 token address for an L2 token
   * @param l2TokenAddr The L2 token address
   * @returns The L1 token address
   */
  async getL1TokenFromL2Address(l2TokenAddr: Hex): Promise<EthAddress> {
    try {
      const portal = await this.getInstance();
      const result = await portal.methods
        .get_l1_token_unconstrained(AztecAddress.fromString(l2TokenAddr))
        .simulate({ from: this.client.getAddress() });
      return EthAddress.fromString(`0x${result.inner.toString(16).padStart(40, '0')}`);
    } catch (error) {
      throw createError(
        ErrorCode.L2_TOKEN_OPERATION,
        `Failed to get L1 token for L2 token ${l2TokenAddr}`,
        { l2TokenAddress: l2TokenAddr },
        error,
      );
    }
  }

  /**
   * Checks if a token is registered with the portal on L2 by its L1 address
   * @param l1TokenAddr The L1 token address
   * @returns True if the token is registered on L2
   */
  async isRegisteredByL1Address(l1TokenAddr: Hex): Promise<boolean> {
    try {
      const portal = await this.getInstance();
      const simulationResult = await portal.methods
        .is_registered_l1_unconstrained(EthAddress.fromString(l1TokenAddr))
        .simulate({ from: this.client.getAddress() });
      return simulationResult;
    } catch (error) {
      throw createError(
        ErrorCode.L2_TOKEN_OPERATION,
        `Failed to check if token ${l1TokenAddr} is registered by L1 address`,
        { l1TokenAddress: l1TokenAddr },
        error,
      );
    }
  }

  /**
   * Checks if a token is registered with the portal on L2 by its L2 address
   * @param l2TokenAddr The L2 token address
   * @returns True if the token is registered on L1
   */
  async isRegisteredByL2Address(l2TokenAddr: Hex): Promise<boolean> {
    try {
      const portal = await this.getInstance();
      const simulationResult = await portal.methods
        .is_registered_l2_unconstrained(AztecAddress.fromString(l2TokenAddr))
        .simulate({ from: this.client.getAddress() });
      return simulationResult;
    } catch (error) {
      throw createError(
        ErrorCode.L2_TOKEN_OPERATION,
        `Failed to check if token ${l2TokenAddr} is registered by L2 address`,
        { l2TokenAddress: l2TokenAddr },
        error,
      );
    }
  }

  /**
   * Gets the leaf index of an L1ToL2Message
   * @param l1ToL2Message The L1ToL2Message hash
   * @returns The leaf index of the L1ToL2Message
   */
  async getL1ToL2MessageLeafIndex(l1ToL2Message: Hex): Promise<number> {
    try {
      const node = this.client.getNode();
      const wit = await node.getL1ToL2MessageMembershipWitness('latest', Fr.fromHexString(l1ToL2Message));
      if (!wit) {
        throw createError(ErrorCode.BRIDGE_MESSAGE, `No membership witness found for L1ToL2Message ${l1ToL2Message}`, {
          l1ToL2Message,
        });
      }
      const [messageIndex] = wit;
      return Number(messageIndex);
    } catch (error) {
      if (isTurnstileError(error)) {
        throw error;
      }
      throw createError(
        ErrorCode.BRIDGE_MESSAGE,
        `Failed to get L1ToL2Message leaf index for ${l1ToL2Message}`,
        { l1ToL2Message },
        error,
      );
    }
  }

  async getAztecL1OutboxVersion(outboxAddress: EthAddress): Promise<number> {
    if (this.l1Client === undefined) {
      throw new Error('L1 client not provided to L2Portal');
    }
    const outbox = getContract({
      address: outboxAddress.toString(),
      abi: OutboxAbi,
      client: this.l1Client.getPublicClient(),
    });

    const version = await outbox.read.VERSION();
    console.debug(`Outbox at ${outboxAddress.toString()} has version ${version}`);
    return Number(version);
  }

  async computeL2ToL1Message(
    l1TokenAddr: Hex,
    l1RecipientAddr: Hex,
    amount: bigint,
    outboxVersion: number,
  ): Promise<Hex> {
    try {
      const l1PortalAddr = await this.getL1Portal();
      const node = this.client.getNode();
      const nodeInfo = await node.getNodeInfo();

      const encoded = Buffer.from(
        this.encodeWithdrawData(l1TokenAddr, l1RecipientAddr, amount).replace(/^0x/, ''),
        'hex',
      );
      const content = sha256ToField([encoded]);

      // L2ToL1Message format per
      // https://docs.aztec.network/developers/reference/smart_contract_reference/portals/data_structures
      //
      //  struct L1Actor {
      //    address actor;
      //    uint256 chainId;
      //  }
      //
      //  struct L2Actor {
      //    address actor;
      //    uint256 version;
      //  }
      //
      //  struct L2ToL1Msg {
      //    DataStructures.L2Actor sender;
      //    DataStructures.L1Actor recipient;
      //    bytes32 content;
      //  }
      const message = serializeToBuffer([
        // L2Actor (sender)
        this.getAddress(), // sender
        new Fr(outboxVersion), // rollupVersion
        // L1Actor (recipient)
        l1PortalAddr, // recipient
        new Fr(nodeInfo.l1ChainId),
        // Hash of message content
        content,
      ]);

      return `0x${message.toString('hex')}`;
    } catch (error) {
      throw createError(
        ErrorCode.BRIDGE_MESSAGE,
        `Failed to compute L2ToL1Message for token ${l1TokenAddr} to recipient ${l1RecipientAddr} `,
        {
          l1TokenAddress: l1TokenAddr,
          l1RecipientAddress: l1RecipientAddr,
          amount: amount.toString(),
        },
        error,
      );
    }
  }

  async getL2ToL1MembershipWitness(l2BlockNumber: number, message: Hex): Promise<L2ToL1MembershipWitness> {
    try {
      const messageHash = sha256ToField([Buffer.from(message.replace(/^0x/, ''), 'hex')]);
      const witness = await computeL2ToL1MembershipWitness(
        this.client.getNode(), // MessageRetrieval
        l2BlockNumber,
        messageHash,
      );
      if (!witness) {
        throw new Error('No membership witness found');
      }
      return witness;
    } catch (error) {
      throw createError(
        ErrorCode.BRIDGE_MESSAGE,
        `Failed to get L2ToL1Message membership witness for message in L2 block ${l2BlockNumber} `,
        { l2BlockNumber, message },
        error,
      );
    }
  }

  /**
   * Encode the withdraw data used for the L2 to L1 withdraw message
   * @param l1TokenAddr The L1 token address
   * @param l1RecipientAddr The L1 recipient address
   * @param amount The amount to withdraw
   */
  private encodeWithdrawData(l1TokenAddr: Hex, l1RecipientAddr: Hex, amount: bigint): Hex {
    // ABI for the withdraw function
    const withdrawAbi = {
      inputs: [
        { name: 'token', type: 'address' },
        { name: 'l1Recipient', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      name: 'withdraw',
      stateMutability: 'nonpayable',
      type: 'function',
    };

    const encoded = encodeFunctionData({
      abi: [withdrawAbi],
      functionName: 'withdraw',
      args: [l1TokenAddr, l1RecipientAddr, amount],
    });

    return encoded;
  }

  static async registerShieldGateway(client: IL2Client, shieldGatewayAddr: AztecAddress) {
    const instance = await registerShieldGatewayInPXE(client, shieldGatewayAddr);
    return instance;
  }

  static async registerPortal(
    client: IL2Client,
    l2Portal: AztecAddress,
    l1Portal: EthAddress,
    tokenContractClassId: Fr,
    shieldGateway: AztecAddress,
  ) {
    const instance = await getContractInstanceFromInstantiationParams(PortalContractArtifact, {
      constructorArtifact: 'constructor',
      constructorArgs: [l1Portal, tokenContractClassId, shieldGateway],
      salt: L2_CONTRACT_DEPLOYMENT_SALT,
      deployer: AztecAddress.ZERO,
      publicKeys: PublicKeys.default(),
    });

    if (!instance.address.equals(l2Portal)) {
      throw createError(
        ErrorCode.L2_GENERAL,
        `Portal address mismatch: expected ${l2Portal.toString()}, got ${instance.address.toString()}`,
        {
          expectedAddress: l2Portal.toString(),
          actualAddress: instance.address.toString(),
        },
      );
    }

    console.debug(`Registering portal in PXE: ${l2Portal.toString()}...`);
    await client.getWallet().registerContract({ instance, artifact: PortalContractArtifact });

    return instance;
  }

  static async register(
    client: IL2Client,
    l2Portal: AztecAddress,
    l1Portal: EthAddress,
    tokenContractClassId: Fr,
    shieldGateway: AztecAddress,
    l1Client?: IL1Client,
  ) {
    await L2Portal.registerShieldGateway(client, shieldGateway);
    const instance = await L2Portal.registerPortal(client, l2Portal, l1Portal, tokenContractClassId, shieldGateway);
    return new L2Portal(instance.address, client, l1Client);
  }

  /**
   * Deploys a new shield gateway contract
   * @param client The L2 client
   * @param deployOptions The deployment options
   * @returns The shield gateway contract
   */
  static async deployShieldGateway(
    client: IL2Client,
    deployOptions: Partial<DeployOptions>,
  ): Promise<ShieldGatewayContract> {
    console.debug('Deploying Shield Gateway...');
    const options: DeployOptions = {
      from: client.getAddress(),
      universalDeploy: true,
      contractAddressSalt: L2_CONTRACT_DEPLOYMENT_SALT,
      fee: client.getFeeOpts(),
      ...deployOptions,
    };
    const shieldGateway = await ShieldGatewayContract.deploy(client.getWallet()).send(options).deployed();

    console.debug('Shield Gateway deployed at', shieldGateway.address.toString());

    return shieldGateway;
  }

  /**
   * Deploys a new portal contract
   * @param client The L2 client
   * @param l1PortalAddress The L1 portal address
   * @param tokenContractClassId The token contract class ID
   * @param shieldGateway The shield gateway address
   * @param deployOptions The deployment options
   * @returns The portal
   */
  static async deploy(
    client: IL2Client,
    l1PortalAddress: EthAddress,
    tokenContractClassId: Fr,
    shieldGateway?: ShieldGatewayContract,
    deployOptions?: Partial<DeployOptions>,
  ): Promise<{ portal: PortalContract; shieldGateway: ShieldGatewayContract }> {
    try {
      const wallet = client.getWallet();

      const options: DeployOptions = {
        from: client.getAddress(),
        universalDeploy: true,
        contractAddressSalt: L2_CONTRACT_DEPLOYMENT_SALT,
        fee: client.getFeeOpts(),
        ...deployOptions,
      };

      if (!shieldGateway) {
        // biome-ignore lint/style/noParameterAssign: Only assigning if not provided
        shieldGateway = await L2Portal.deployShieldGateway(client, options);
      }

      console.debug('Deploying L2 Portal...');
      const portal = await PortalContract.deploy(wallet, l1PortalAddress, tokenContractClassId, shieldGateway.address)
        .send(options)
        .deployed();
      console.debug(`Portal deployed at ${portal.address.toString()} `);

      return {
        portal,
        shieldGateway,
      };
    } catch (error) {
      throw createError(
        ErrorCode.L2_DEPLOYMENT,
        `Failed to deploy portal with L1 portal address ${l1PortalAddress} `,
        { l1PortalAddress: l1PortalAddress.toString() },
        error,
      );
    }
  }

  async fetchLogs(filter: LogFilter): Promise<GetPublicLogsResponse> {
    filter.contractAddress = this.portalAddr;
    return this.client.getNode().getPublicLogs(filter);
  }

  async fetchLogsInRange(fromBlock: number, toBlock: number): Promise<GetPublicLogsResponse> {
    const filter: LogFilter = {
      contractAddress: this.portalAddr,
      fromBlock,
      toBlock,
    };

    return this.client.getNode().getPublicLogs(filter);
  }

  async fetchLogsAfterLogId(afterLog: LogId): Promise<GetPublicLogsResponse> {
    const filter: LogFilter = {
      contractAddress: this.portalAddr,
      afterLog,
    };
    return this.client.getNode().getPublicLogs(filter);
  }

  /**
   * Prepares a batch for deploying and registering an L2 token
   * @param l1TokenAddr The L1 token address
   * @param name The token name
   * @param symbol The token symbol
   * @param decimals The token decimals
   * @param index The L1ToL2Message index
   * @param sendMethodOptions Send options for register interaction
   * @returns Object containing the batch builder and token instance
   */
  async prepareDeployAndRegisterL2Token(
    l1TokenAddr: Hex,
    name: string,
    symbol: string,
    decimals: number,
    index: bigint, // L1ToL2Message index
    sendMethodOptions: SendMethodOptions,
  ): Promise<{ batch: ContractBatchBuilder; instance: ContractInstanceWithAddress }> {
    const portal = await this.getInstance();

    await this.client.getWallet().registerContractClass(TokenContractArtifact);

    const tokenInstance = await L2Token.getInstance(portal.address, name, symbol, decimals);
    console.debug(`Preparing deployment of L2 token ${tokenInstance.address} for L1 token ${l1TokenAddr}...`);
    // Token needs to be registered in the client PXE prior to deployment
    this.client.getWallet().registerContract({ instance: tokenInstance });

    // Get the deployment interaction
    const tokenDeployInteraction = L2Token.deployMethod(this.client, portal.address, name, symbol, decimals);

    const registerInteraction = portal.methods.register_private(
      EthAddress.fromString(l1TokenAddr),
      tokenInstance.address,
      name,
      name.length,
      symbol,
      symbol.length,
      decimals,
      Fr.fromHexString(`0x${index.toString(16)}`),
    );

    // Create deployment options for the token deployment
    const deployOptions = {
      ...sendMethodOptions,
      universalDeploy: true,
      contractAddressSalt: L2_CONTRACT_DEPLOYMENT_SALT,
    };

    // Create ExecutionPayloads with their specific options
    const tokenDeployPayload = await tokenDeployInteraction.request(deployOptions);
    const registerPayload = await registerInteraction.request(sendMethodOptions);

    // Build batch with the pre-configured payloads
    const batch = new ContractBatchBuilder(this.client.getWallet()).add(tokenDeployPayload).add(registerPayload);

    return { batch, instance: tokenInstance };
  }

  async deployAndRegisterL2Token(
    l1TokenAddr: Hex,
    name: string,
    symbol: string,
    decimals: number,
    index: bigint, // L1ToL2Message index
    sendMethodOptions: SendMethodOptions,
  ): Promise<{ instance: ContractInstanceWithAddress; txHash: TxHash }> {
    const { batch, instance } = await this.prepareDeployAndRegisterL2Token(
      l1TokenAddr,
      name,
      symbol,
      decimals,
      index,
      sendMethodOptions,
    );

    // Send the batch
    const sentTx = batch.send(sendMethodOptions);
    const receipt = await sentTx.wait();
    if (receipt.status !== TxStatus.SUCCESS) {
      throw createError(
        ErrorCode.L2_DEPLOYMENT,
        `Failed to deploy and register L2 token for L1 token ${l1TokenAddr} `,
        { l1TokenAddress: l1TokenAddr },
      );
    }

    console.debug(`Deployed and registered L2 token ${instance.address.toString()} for L1 token ${l1TokenAddr} `);

    return { instance, txHash: await sentTx.getTxHash() };
  }
}

export async function decodePublicEvents<T>(
  eventMetadataDef: EventMetadataDefinition,
  logs: ExtendedPublicLog[],
): Promise<T[]> {
  const decodedEvents = logs
    .map((log) => {
      // +1 for the event selector
      const expectedLength = eventMetadataDef.fieldNames.length + 1;
      if (log.log.emittedLength !== expectedLength) {
        throw new Error(
          `Something is weird here, we have matching EventSelectors, but the actual payload has mismatched length. Expected ${expectedLength}. Got ${log.log.emittedLength}.`,
        );
      }

      const logFields = log.log.getEmittedFields();
      // We are assuming here that event logs are the last 4 bytes of the event. This is not enshrined but is a function of aztec.nr raw log emission.
      const lastField = logFields[logFields.length - 1];
      if (!lastField || !EventSelector.fromField(lastField).equals(eventMetadataDef.eventSelector)) {
        return undefined;
      }
      return decodeFromAbi([eventMetadataDef.abiType], log.log.fields) as T;
    })
    .filter((log) => log !== undefined) as T[];

  return decodedEvents;
}
