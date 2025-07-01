import {
  Fr,
  EthAddress,
  AztecAddress,
  type SentTx,
  getContractInstanceFromDeployParams,
  PublicKeys,
} from '@aztec/aztec.js';
import {
  PortalContract,
  PortalContractArtifact,
  ShieldGatewayContract,
  ShieldGatewayContractArtifact,
} from '@turnstile-portal/aztec-artifacts';

import {
  ErrorCode,
  createL2Error,
  isTurnstileError,
  createBridgeError,
} from '../errors.js';
import type { IL2Client } from './client.js';
import { L2_CONTRACT_DEPLOYMENT_SALT } from './constants.js';

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
   */
  getL1Portal(): Promise<EthAddress>;

  /**
   * Claim tokens deposited to the L2 chain to the recipient's public balance
   * @param l1TokenAddr The L1 token address
   * @param l2RecipientAddr The L2 recipient address
   * @param amount The amount to deposit
   * @param index The index of the L1ToL2Message
   * @returns The transaction
   */
  claimDeposit(
    l1TokenAddr: string,
    l2RecipientAddr: string,
    amount: bigint,
    index: bigint,
  ): Promise<SentTx>;

  /**
   * Claim tokens deposited to the L2 chain to the recipient's private balance
   * @param l1TokenAddr The L1 token address
   * @param l2RecipientAddr The L2 recipient address
   * @param amount The amount to deposit
   * @param index The index of the L1ToL2Message
   * @returns The transaction
   */
  claimDepositShielded(
    l1TokenAddr: string,
    l2RecipientAddr: string,
    amount: bigint,
    index: bigint,
  ): Promise<SentTx>;

  /**
   * Checks if a deposit is claimed on the L2 chain
   * @param l2BlockNumber The L2 block number
   * @param hash The hash of the L1ToL2Message
   * @returns True if the deposit is claimed
   */
  isClaimed(l2BlockNumber: number, hash: string): Promise<boolean>;

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
  registerToken(
    l1TokenAddr: string,
    l2TokenAddr: string,
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
   * @returns The transaction and the L2 to L1 message hash
   */
  withdrawPublic(
    l1TokenAddr: string,
    l1RecipientAddr: string,
    amount: bigint,
    burnNonce: Fr,
  ): Promise<{ tx: SentTx; leaf: Fr }>;

  /**
   * Gets the L2 token address for an L1 token
   * @param l1TokenAddr The L1 token address
   * @returns The L2 token address
   */
  getL2Token(l1TokenAddr: string): Promise<AztecAddress>;

  /**
   * Gets the L1 token address for an L2 token
   * @param l2TokenAddr The L2 token address
   * @returns The L1 token address
   */
  getL1Token(l2TokenAddr: string): Promise<EthAddress>;

  /**
   * Checks if a token is registered with the portal on L2 by its L1 address
   * @param l1TokenAddr The L1 token address
   * @returns True if the token is registered on L2
   */
  isRegisteredByL1Address(l1TokenAddr: string): Promise<boolean>;

  /**
   * Checks if a token is registered with the portal on L2 by its L2 address
   * @param l2TokenAddr The L2 token address
   * @returns True if the token is registered on L1
   */
  isRegisteredByL2Address(l2TokenAddr: string): Promise<boolean>;
}

/**
 * Implementation of IL2Portal for the Aztec portal contract
 */
export class L2Portal implements IL2Portal {
  // The not-secret secret used to send messages to L2
  static readonly PUBLIC_NOT_SECRET_SECRET = Fr.fromHexString('0x7075626c6963');

  private portalAddr: AztecAddress;
  private client: IL2Client;
  private portal?: PortalContract;
  private config?: PortalConfig;

  /**
   * Creates a new L2Portal
   * @param portalAddr The portal address
   * @param client The L2 client
   */
  constructor(portalAddr: AztecAddress, client: IL2Client) {
    this.portalAddr = portalAddr;
    this.client = client;
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
      this.portal = await PortalContract.at(
        this.portalAddr,
        this.client.getWallet(),
      );
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
      throw createL2Error(
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
  async claimDeposit(
    l1TokenAddr: string,
    l2RecipientAddr: string,
    amount: bigint,
    index: bigint,
  ): Promise<SentTx> {
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
      throw createL2Error(
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
  async claimDepositShielded(
    l1TokenAddr: string,
    l2RecipientAddr: string,
    amount: bigint,
    index: bigint,
  ): Promise<SentTx> {
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
      throw createL2Error(
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
  async isClaimed(l2BlockNumber: number, hash: string): Promise<boolean> {
    try {
      const node = this.client.getNode();
      if ((await node.getBlockNumber()) < l2BlockNumber) {
        return false;
      }

      try {
        await this.getL1ToL2MessageLeafIndex(hash);
        return false;
      } catch (err) {
        // If the message is not found and the block is mined, then the message was claimed
        return true;
      }
    } catch (error) {
      throw createL2Error(
        ErrorCode.BRIDGE_MESSAGE,
        `Failed to check if deposit is claimed for hash ${hash}`,
        {
          l2BlockNumber: l2BlockNumber.toString(),
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
    l1TokenAddr: string,
    l2TokenAddr: string,
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
      throw createL2Error(
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
   * @returns The transaction and the L2 to L1 message hash
   */
  async withdrawPublic(
    l1TokenAddr: string,
    l1RecipientAddr: string,
    amount: bigint,
    burnNonce: Fr,
  ): Promise<{ tx: SentTx; leaf: Fr }> {
    try {
      const portal = await this.getInstance();
      const from = this.client.getAddress();

      const l2TokenAddr = await portal.methods
        .get_l2_token_unconstrained(EthAddress.fromString(l1TokenAddr))
        .simulate();

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
    } catch (error) {
      throw createBridgeError(
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
  async getL2Token(l1TokenAddr: string): Promise<AztecAddress> {
    try {
      const portal = await this.getInstance();
      const result = await portal.methods
        .get_l2_token_unconstrained(EthAddress.fromString(l1TokenAddr))
        .simulate();
      return AztecAddress.fromBigInt(result);
    } catch (error) {
      throw createL2Error(
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
  async getL1Token(l2TokenAddr: string): Promise<EthAddress> {
    try {
      const portal = await this.getInstance();
      const result = await portal.methods
        .get_l1_token_unconstrained(AztecAddress.fromString(l2TokenAddr))
        .simulate();
      return EthAddress.fromString(
        `0x${result.inner.toString(16).padStart(40, '0')}`,
      );
    } catch (error) {
      throw createL2Error(
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
  async isRegisteredByL1Address(l1TokenAddr: string): Promise<boolean> {
    try {
      const portal = await this.getInstance();
      return await portal.methods
        .is_registered_l1_unconstrained(EthAddress.fromString(l1TokenAddr))
        .simulate();
    } catch (error) {
      throw createL2Error(
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
  async isRegisteredByL2Address(l2TokenAddr: string): Promise<boolean> {
    try {
      const portal = await this.getInstance();
      return await portal.methods
        .is_registered_l2_unconstrained(AztecAddress.fromString(l2TokenAddr))
        .simulate();
    } catch (error) {
      throw createL2Error(
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
  private async getL1ToL2MessageLeafIndex(
    l1ToL2Message: string,
  ): Promise<number> {
    try {
      const node = this.client.getNode();
      const wit = await node.getL1ToL2MessageMembershipWitness(
        'latest',
        Fr.fromHexString(l1ToL2Message),
      );
      if (!wit) {
        throw createL2Error(
          ErrorCode.BRIDGE_MESSAGE,
          `No membership witness found for L1ToL2Message ${l1ToL2Message}`,
          { l1ToL2Message },
        );
      }
      const [messageIndex] = wit;
      return Number(messageIndex);
    } catch (error) {
      if (isTurnstileError(error)) {
        throw error;
      }
      throw createL2Error(
        ErrorCode.BRIDGE_MESSAGE,
        `Failed to get L1ToL2Message leaf index for ${l1ToL2Message}`,
        { l1ToL2Message },
        error,
      );
    }
  }

  /**
   * Gets the leaf of an L2ToL1Message
   * @param l1TokenAddr The L1 token address
   * @param l1RecipientAddr The L1 recipient address
   * @param amount The amount being withdrawn
   * @returns The leaf of the L2ToL1Message
   */
  private async getL2ToL1MessageLeaf(
    l1TokenAddr: string,
    l1RecipientAddr: string,
    amount: bigint,
  ): Promise<Fr> {
    try {
      const l1PortalAddr = await this.getL1Portal();
      const node = this.client.getNode();

      // Using this to get the L1 Chain ID
      const nodeInfo = await node.getNodeInfo();

      const encoded = this.encodeWithdrawData(
        l1TokenAddr,
        l1RecipientAddr,
        amount,
      );
      const content = Fr.fromBuffer(
        Buffer.from(encoded.replace(/^0x/, ''), 'hex'),
      );

      // The leaf is the hash of (L2Actor, L1Actor, content)
      // https://docs.aztec.network/reference/developer_references/smart_contract_reference/portals/data_structures#l2tol1message
      const leafData = [
        // L2Actor
        this.portalAddr.toBuffer(), // Sender (Aztec Portal)
        new Fr(1).toBuffer(), // Aztec version
        // L1Actor
        l1PortalAddr.toBuffer32(), // Recipient (L1 Portal)
        new Fr(nodeInfo.l1ChainId).toBuffer(),
        // Content
        content.toBuffer(),
      ];

      // Concatenate all buffers
      const combinedBuffer = Buffer.concat(leafData);
      return Fr.fromBuffer(combinedBuffer);
    } catch (error) {
      throw createBridgeError(
        ErrorCode.BRIDGE_MESSAGE,
        `Failed to get L2ToL1Message leaf for token ${l1TokenAddr} to recipient ${l1RecipientAddr}`,
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
   * Encode the withdraw data used for the L2 to L1 withdraw message
   * @param l1TokenAddr The L1 token address
   * @param l1RecipientAddr The L1 recipient address
   * @param amount The amount to withdraw
   */
  private encodeWithdrawData(
    l1TokenAddr: string,
    l1RecipientAddr: string,
    amount: bigint,
  ): string {
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

    // Encode the function data
    const functionSignature = 'withdraw(address,address,uint256)';
    const encodedParams = [
      l1TokenAddr.padStart(64, '0'),
      l1RecipientAddr.padStart(64, '0'),
      amount.toString(16).padStart(64, '0'),
    ].join('');

    return `0x${Buffer.from(functionSignature).toString('hex')}${encodedParams}`;
  }

  static async registerShieldGateway(client: IL2Client) {
    const instance = await getContractInstanceFromDeployParams(
      ShieldGatewayContractArtifact,
      {
        salt: L2_CONTRACT_DEPLOYMENT_SALT,
        deployer: AztecAddress.ZERO,
        publicKeys: PublicKeys.default(),
      },
    );
    await client
      .getWallet()
      .registerContract({ instance, artifact: ShieldGatewayContractArtifact });

    return instance;
  }

  static async registerPortal(
    client: IL2Client,
    l1Portal: EthAddress,
    tokenContractClassId: Fr,
    shieldGateway: AztecAddress,
  ) {
    const instance = await getContractInstanceFromDeployParams(
      PortalContractArtifact,
      {
        constructorArtifact: 'constructor',
        constructorArgs: [l1Portal, tokenContractClassId, shieldGateway],
        salt: L2_CONTRACT_DEPLOYMENT_SALT,
        deployer: AztecAddress.ZERO,
        publicKeys: PublicKeys.default(),
      },
    );
    await client
      .getWallet()
      .registerContract({ instance, artifact: PortalContractArtifact });

    return instance;
  }

  static async register(
    client: IL2Client,
    l1Portal: EthAddress,
    tokenContractClassId: Fr,
    shieldGateway: AztecAddress,
  ) {
    await L2Portal.registerShieldGateway(client);
    const instance = await L2Portal.registerPortal(
      client,
      l1Portal,
      tokenContractClassId,
      shieldGateway,
    );
    return new L2Portal(instance.address, client);
  }

  /**
   * Creates a new L2Portal from an address
   * @param address The portal address
   * @param client The L2 client
   * @param register Whether to register the portal
   * @param l1Portal The L1 portal address (required if register is true)
   * @param tokenContractClassId The token contract class ID (required if register is true)
   * @param shieldGateway The shield gateway address (required if register is true)
   * @returns The portal
   */
  static async fromAddress(
    address: AztecAddress,
    client: IL2Client,
    register = true,
    l1Portal?: EthAddress,
    tokenContractClassId?: Fr,
    shieldGateway?: AztecAddress,
  ): Promise<L2Portal> {
    try {
      if (register) {
        if (!l1Portal || !tokenContractClassId || !shieldGateway) {
          throw createL2Error(
            ErrorCode.L2_CONTRACT_INTERACTION,
            'Missing required parameters for portal registration: l1Portal, tokenContractClassId, and shieldGateway are required when register is true',
            { portalAddress: address.toString() },
          );
        }
        await L2Portal.register(
          client,
          l1Portal,
          tokenContractClassId,
          shieldGateway,
        );
      }
      return new L2Portal(address, client);
    } catch (error) {
      throw createL2Error(
        ErrorCode.L2_CONTRACT_INTERACTION,
        `Failed to create portal from address ${address}`,
        { portalAddress: address.toString() },
        error,
      );
    }
  }

  static async deployShieldGateway(
    client: IL2Client,
  ): Promise<ShieldGatewayContract> {
    console.debug('Deploying Shield Gateway...');
    const shieldGateway = await ShieldGatewayContract.deploy(client.getWallet())
      .send({
        universalDeploy: true,
        contractAddressSalt: L2_CONTRACT_DEPLOYMENT_SALT,
        fee: client.getFeeOpts(),
      })
      .deployed();

    console.debug(
      'Shield Gateway deployed at',
      shieldGateway.address.toString(),
    );

    return shieldGateway;
  }

  /**
   * Deploys a new portal contract
   * @param client The L2 client
   * @param l1PortalAddress The L1 portal address
   * @param tokenContractClassId The token contract class ID
   * @param shieldGateway The shield gateway address
   * @returns The portal
   */
  static async deploy(
    client: IL2Client,
    l1PortalAddress: EthAddress,
    tokenContractClassId: Fr,
    shieldGateway?: ShieldGatewayContract,
  ): Promise<{ portal: PortalContract; shieldGateway: ShieldGatewayContract }> {
    try {
      const wallet = client.getWallet();

      if (!shieldGateway) {
        // biome-ignore lint/style/noParameterAssign: Only assigning if not provided
        shieldGateway = await L2Portal.deployShieldGateway(client);
      }

      console.debug('Deploying L2 Portal...');
      const portal = await PortalContract.deploy(
        wallet,
        l1PortalAddress,
        tokenContractClassId,
        shieldGateway.address,
      )
        .send({
          universalDeploy: true,
          contractAddressSalt: L2_CONTRACT_DEPLOYMENT_SALT,
          fee: client.getFeeOpts(),
        })
        .deployed();
      console.debug(`Portal deployed at ${portal.address.toString()}`);

      return {
        portal,
        shieldGateway,
      };
    } catch (error) {
      throw createL2Error(
        ErrorCode.L2_DEPLOYMENT,
        `Failed to deploy portal with L1 portal address ${l1PortalAddress}`,
        { l1PortalAddress: l1PortalAddress.toString() },
        error,
      );
    }
  }
}
