import {
  AztecAddress,
  type DeployOptions,
  decodeFromAbi,
  EthAddress,
  EventSelector,
  Fr,
  getContractInstanceFromDeployParams,
  type LogFilter,
  type LogId,
  PublicKeys,
  type SendMethodOptions,
  type SentTx,
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
import { PortalContract, PortalContractArtifact, ShieldGatewayContract } from '@turnstile-portal/aztec-artifacts';
import { encodeFunctionData, getContract } from 'viem';
import { createError, ErrorCode, isTurnstileError } from '../errors.js';
import type { IL1Client } from '../l1/client.js';
import { L1Token } from '../l1/token.js';
import type { Hex } from '../types.js';
import type { IL2Client } from './client.js';
import { L2_CONTRACT_DEPLOYMENT_SALT, PUBLIC_NOT_SECRET_SECRET } from './constants.js';
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
   * Claim tokens deposited to the L2 chain to the recipient's public balance
   * @param l1TokenAddr The L1 token address
   * @param l2RecipientAddr The L2 recipient address
   * @param amount The amount to deposit
   * @param index The index of the L1ToL2Message
   * @returns The transaction
   * @throws {TurnstileError} With ErrorCode.BRIDGE_DEPOSIT if claiming fails
   */
  claimDeposit(l1TokenAddr: Hex, l2RecipientAddr: Hex, amount: bigint, index: bigint): Promise<SentTx>;

  /**
   * Claim tokens deposited to the L2 chain to the recipient's private balance
   * @param l1TokenAddr The L1 token address
   * @param l2RecipientAddr The L2 recipient address
   * @param amount The amount to deposit
   * @param index The index of the L1ToL2Message
   * @returns The transaction
   * @throws {TurnstileError} With ErrorCode.BRIDGE_DEPOSIT if claiming fails
   */
  claimDepositShielded(l1TokenAddr: Hex, l2RecipientAddr: Hex, amount: bigint, index: bigint): Promise<SentTx>;

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
    sendMethodOptions?: SendMethodOptions,
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
      const config = await portal.methods.get_config_public().simulate();

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
   * Claim tokens deposited to the L2 chain to the recipient's public balance
   * @param l1TokenAddr The L1 token address
   * @param l2RecipientAddr The L2 recipient address
   * @param amount The amount to deposit
   * @param index The index of the L1ToL2Message
   * @returns The transaction
   */
  async claimDeposit(l1TokenAddr: Hex, l2RecipientAddr: Hex, amount: bigint, index: bigint): Promise<SentTx> {
    try {
      const portal = await this.getInstance();
      return await portal.methods
        .claim_public(
          EthAddress.fromString(l1TokenAddr),
          AztecAddress.fromString(l2RecipientAddr),
          amount,
          Fr.fromHexString(`0x${index.toString(16)}`),
        )
        .send();
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
   * Claim tokens deposited to the L2 chain to the recipient's private balance
   * @param l1TokenAddr The L1 token address
   * @param l2RecipientAddr The L2 recipient address
   * @param amount The amount to deposit
   * @param index The index of the L1ToL2Message
   * @returns The transaction
   */
  async claimDepositShielded(l1TokenAddr: Hex, l2RecipientAddr: Hex, amount: bigint, index: bigint): Promise<SentTx> {
    try {
      const portal = await this.getInstance();
      return await portal.methods
        .claim_shielded(
          EthAddress.fromString(l1TokenAddr),
          AztecAddress.fromString(l2RecipientAddr),
          amount,
          Fr.fromHexString(`0x${index.toString(16)}`),
        )
        .send();
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
   * Registers a token on the L2 chain
   * @param l1TokenAddr The L1 token address
   * @param l2TokenAddr The L2 token address
   * @param name The token name
   * @param symbol The token symbol
   * @param decimals The token decimals
   * @param index The index of the L1ToL2Message
   * @returns The transaction
   */
  async registerToken(
    l1TokenAddr: Hex,
    l2TokenAddr: Hex,
    name: string,
    symbol: string,
    decimals: number,
    index: bigint,
  ): Promise<SentTx> {
    try {
      const portal = await this.getInstance();
      return await portal.methods
        .register_private(
          EthAddress.fromString(l1TokenAddr),
          AztecAddress.fromString(l2TokenAddr),
          name,
          name.length,
          symbol,
          symbol.length,
          decimals,
          Fr.fromHexString(`0x${index.toString(16)}`),
        )
        .send();
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
   * Withdraws tokens from the L2 chain
   * @param l1TokenAddr The L1 token address
   * @param l1RecipientAddr The L1 recipient address
   * @param amount The amount to withdraw
   * @param burnNonce The burn nonce
   * @param sendMethodOptions Optional transaction options
   * @returns Object containing the transaction and the encoded withdrawal data
   * @throws {TurnstileError} With ErrorCode.BRIDGE_WITHDRAW if the withdrawal fails
   */
  async withdrawPublic(
    l1TokenAddr: Hex,
    l1RecipientAddr: Hex,
    amount: bigint,
    burnNonce: Fr,
    sendMethodOptions?: SendMethodOptions,
  ): Promise<{ tx: SentTx; withdrawData: Hex }> {
    try {
      const portal = await this.getInstance();
      const from = this.client.getAddress();

      const tx = await portal.methods
        .withdraw_public(
          EthAddress.fromString(l1TokenAddr),
          from,
          EthAddress.fromString(l1RecipientAddr),
          amount,
          Fr.ZERO, // withdrawNonce
          burnNonce,
        )
        .send(sendMethodOptions);

      const withdrawData = this.encodeWithdrawData(l1TokenAddr, l1RecipientAddr, amount);

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
        .simulate();

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
      const result = await portal.methods.get_l1_token_unconstrained(AztecAddress.fromString(l2TokenAddr)).simulate();
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
        .simulate();
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
        .simulate();
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

  public getL2ToL1MessageLeafIndex(witness: L2ToL1MembershipWitness): bigint {
    return 2n ** BigInt(witness.siblingPath.pathSize) + witness.l2MessageIndex;
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
    const instance = await getContractInstanceFromDeployParams(PortalContractArtifact, {
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
