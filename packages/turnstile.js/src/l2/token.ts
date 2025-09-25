import {
  AztecAddress,
  Capsule,
  Contract,
  ContractFunctionInteraction,
  computeAuthWitMessageHash,
  computeInnerAuthWitHashFromAction,
  type DeployOptions,
  Fr,
  getContractInstanceFromInstantiationParams,
  type IntentInnerHash,
  ProtocolContractAddress,
  readFieldCompressedString,
  type SendMethodOptions,
  type SentTx,
} from '@aztec/aztec.js';
import { type ABIParameterVisibility, type FunctionAbi, FunctionType } from '@aztec/stdlib/abi';
import { PublicKeys } from '@aztec/stdlib/keys';
import { TokenContract, TokenContractArtifact } from '@turnstile-portal/aztec-artifacts';
import { createError, ErrorCode, ErrorFactories, isTurnstileError } from '../errors.js';
import type { IL2Client } from './client.js';
import { L2_CONTRACT_DEPLOYMENT_SALT, VP_SLOT } from './constants.js';

/**
 * Interface for L2 token operations
 */
export interface IL2Token {
  /**
   * Gets the token address
   * @returns The token address
   */
  getAddress(): AztecAddress;

  /**
   * Gets the token symbol
   * @returns The token symbol
   */
  getSymbol(): Promise<string>;

  /**
   * Gets the token name
   * @returns The token name
   */
  getName(): Promise<string>;

  /**
   * Gets the token decimals
   * @returns The token decimals
   */
  getDecimals(): Promise<number>;

  /**
   * Gets the public balance of an account
   * @param address The address to check
   * @returns The token balance
   */
  balanceOfPublic(address: AztecAddress): Promise<bigint>;

  /**
   * Gets the private balance of an account
   * @param address The address to check
   * @returns The token balance
   */
  balanceOfPrivate(address: AztecAddress): Promise<bigint>;

  /**
   * Transfers tokens publicly to an account
   * @param to The recipient address
   * @param amount The amount to transfer
   * @returns The transaction
   */
  transferPublic(to: AztecAddress, amount: bigint, options: SendMethodOptions): Promise<SentTx>;

  /**
   * Transfers tokens privately to an account
   * @param to The recipient address
   * @param amount The amount to transfer
   * @param verifiedID The verified ID of the recipient
   * @returns The transaction
   */
  transferPrivate(
    to: AztecAddress,
    amount: bigint,
    verifiedID: Fr[] & { length: 5 },
    options: SendMethodOptions,
  ): Promise<SentTx>;

  /**
   * Shields tokens (converts public to private)
   * @param amount The amount to shield
   * @returns The transaction
   */
  shield(amount: bigint, options: SendMethodOptions): Promise<SentTx>;

  /**
   * Unshields tokens (converts private to public)
   * @param amount The amount to unshield
   * @returns The transaction
   */
  unshield(amount: bigint, options: SendMethodOptions): Promise<SentTx>;

  /**
   * Creates an action for burning tokens (used for withdrawals)
   * @param from The address to burn tokens from
   * @param amount The amount to burn
   * @returns The burn action and nonce
   */
  createBurnAction(from: AztecAddress, amount: bigint): Promise<{ action: ContractFunctionInteraction; nonce: Fr }>;

  /**
   * Creates a public authwit action for burning tokens (used for withdrawals)
   * @param from The address to burn tokens from
   * @param amount The amount to burn
   * @returns The burn action and nonce
   */
  createPublicBurnAuthwitAction(
    from: AztecAddress,
    amount: bigint,
  ): Promise<{ action: ContractFunctionInteraction; nonce: Fr }>;
}

/**
 * Implementation of L2Token for Aztec tokens
 */
export class L2Token implements IL2Token {
  private client: IL2Client;
  private token: TokenContract;
  private portal: AztecAddress | undefined;

  /**
   * Creates a new L2Token
   * @param token The token contract
   * @param client The L2 client
   */
  constructor(token: TokenContract, client: IL2Client) {
    this.token = token;
    this.client = client;
  }

  /**
   * Gets the token address
   * @returns The token address
   */
  getAddress(): AztecAddress {
    return this.token.address;
  }

  /**
   * Gets the underlying TokenContract instance
   *
   * @returns The TokenContract instance for direct contract interactions
   */
  getContract(): TokenContract {
    return this.token;
  }

  /**
   * Gets the portal address associated with this token
   *
   * The portal address is retrieved from the token contract and cached
   * for subsequent calls to avoid repeated contract queries.
   *
   * @returns Promise resolving to the portal address
   */
  async getPortal(): Promise<AztecAddress> {
    if (!this.portal) {
      const simulationResult = await this.token.methods.get_portal().simulate({ from: this.client.getAddress() });
      if (typeof simulationResult === 'bigint') {
        this.portal = AztecAddress.fromBigInt(simulationResult);
      } else {
        this.portal = AztecAddress.fromString(simulationResult.toString());
      }
    }
    return this.portal;
  }

  /**
   * Gets the token symbol
   * @returns The token symbol
   */
  async getSymbol(): Promise<string> {
    try {
      const symbol = await this.token.methods.symbol().simulate({ from: this.client.getAddress() });
      return readFieldCompressedString(symbol);
    } catch (error) {
      throw createError(
        ErrorCode.L2_TOKEN_OPERATION,
        `Failed to get symbol for token ${this.token.address}`,
        { tokenAddress: this.token.address.toString() },
        error,
      );
    }
  }

  /**
   * Gets the token name
   * @returns The token name
   */
  async getName(): Promise<string> {
    try {
      const name = await this.token.methods.name().simulate({ from: this.client.getAddress() });
      return readFieldCompressedString(name);
    } catch (error) {
      throw createError(
        ErrorCode.L2_TOKEN_OPERATION,
        `Failed to get name for token ${this.token.address}`,
        { tokenAddress: this.token.address.toString() },
        error,
      );
    }
  }

  /**
   * Gets the token decimals
   * @returns The token decimals
   */
  async getDecimals(): Promise<number> {
    try {
      return Number(await this.token.methods.decimals().simulate({ from: this.client.getAddress() }));
    } catch (error) {
      throw createError(
        ErrorCode.L2_TOKEN_OPERATION,
        `Failed to get decimals for token ${this.token.address}`,
        { tokenAddress: this.token.address.toString() },
        error,
      );
    }
  }

  /**
   * Gets the public balance of an account
   * @param address The address to check
   * @returns The token balance
   */
  async balanceOfPublic(address: AztecAddress): Promise<bigint> {
    try {
      return await this.token.methods.balance_of_public(address).simulate({ from: this.client.getAddress() });
    } catch (error) {
      throw createError(
        ErrorCode.L2_INSUFFICIENT_BALANCE,
        `Failed to get public balance for token ${this.token.address} for address ${address}`,
        {
          tokenAddress: this.token.address.toString(),
          userAddress: address.toString(),
          balanceType: 'public',
        },
        error,
      );
    }
  }

  /**
   * Gets the private balance of an account
   * @param address The address to check
   * @returns The token balance
   */
  async balanceOfPrivate(address: AztecAddress): Promise<bigint> {
    try {
      return await this.token.methods.balance_of_private(address).simulate({ from: this.client.getAddress() });
    } catch (error) {
      throw createError(
        ErrorCode.L2_INSUFFICIENT_BALANCE,
        `Failed to get private balance for token ${this.token.address} for address ${address}`,
        {
          tokenAddress: this.token.address.toString(),
          userAddress: address.toString(),
          balanceType: 'private',
        },
        error,
      );
    }
  }

  /**
   * Transfers tokens publicly to an account
   * @param to The recipient address
   * @param amount The amount to transfer
   * @param options Transaction options
   * @returns The transaction
   */
  async transferPublic(to: AztecAddress, amount: bigint, options: SendMethodOptions): Promise<SentTx> {
    try {
      const from = this.client.getAddress();
      return this.token.methods
        .transfer_public_to_public(
          from,
          to,
          amount,
          Fr.ZERO, // nonce
        )
        .send(options);
    } catch (error) {
      throw createError(
        ErrorCode.L2_TOKEN_OPERATION,
        `Failed to transfer ${amount} tokens publicly to ${to} for token ${this.token.address}`,
        {
          tokenAddress: this.token.address.toString(),
          amount: amount.toString(),
          recipient: to.toString(),
        },
        error,
      );
    }
  }

  /**
   * Transfers tokens privately to an account
   * @param to The recipient address
   * @param amount The amount to transfer
   * @param verifiedID The verified ID of the recipient
   * @param options Transaction options
   * @returns The transaction
   */
  async transferPrivate(
    to: AztecAddress,
    amount: bigint,
    verifiedID: (Fr[] & { length: 5 }) | undefined,
    options: SendMethodOptions,
  ): Promise<SentTx> {
    try {
      const from = this.client.getAddress();

      // Get the shield gateway address
      const shieldGatewayAddr = await this.getShieldGatewayAddress();

      // Create function interaction
      const interaction = this.token.methods.transfer_private_to_private(
        from,
        to,
        amount,
        Fr.ZERO, // nonce
      );

      if (verifiedID) {
        console.debug(`Adding verified ID capsule for gateway ${shieldGatewayAddr.toString()}`);
        interaction.with({
          capsules: [new Capsule(shieldGatewayAddr, VP_SLOT, verifiedID)],
        });
      } else {
        console.warn('No verified ID provided for private transfer. This might cause the transaction to fail.');
      }
      return interaction.send(options);
    } catch (error) {
      if (isTurnstileError(error)) {
        // If this is already a TurnstileError, just rethrow it
        throw error;
      }

      const recipientStr = to ? to.toString() : 'null';
      throw createError(
        ErrorCode.L2_TOKEN_OPERATION,
        `Failed to transfer ${amount} tokens privately to ${recipientStr} for token ${this.token.address}`,
        {
          tokenAddress: this.token.address.toString(),
          amount: amount.toString(),
          recipient: recipientStr,
        },
        error,
      );
    }
  }

  /**
   * Shields tokens (converts public to private)
   * @param amount The amount to shield
   * @param options Transaction options
   * @returns The transaction
   */
  async shield(amount: bigint, options: SendMethodOptions): Promise<SentTx> {
    try {
      const address = this.client.getAddress();
      return this.token.methods.shield(address, amount, Fr.ZERO).send(options);
    } catch (error) {
      throw ErrorFactories.shieldError('shield', amount.toString(), this.token.address.toString(), error);
    }
  }

  /**
   * Unshields tokens (converts private to public)
   * @param amount The amount to unshield
   * @param options Transaction options
   * @returns The transaction
   */
  async unshield(amount: bigint, options: SendMethodOptions): Promise<SentTx> {
    try {
      const address = this.client.getAddress();
      return this.token.methods.unshield(address, amount, Fr.ZERO).send(options);
    } catch (error) {
      throw createError(
        ErrorCode.L2_UNSHIELD_OPERATION,
        `Failed to unshield ${amount} tokens for token ${this.token.address}`,
        {
          tokenAddress: this.token.address.toString(),
          amount: amount.toString(),
        },
        error,
      );
    }
  }

  /**
   * Creates an action for burning tokens (used for withdrawals)
   * @param from The address to burn tokens from
   * @param amount The amount to burn
   * @returns The burn action and nonce
   */
  async createBurnAction(
    from: AztecAddress,
    amount: bigint,
  ): Promise<{ action: ContractFunctionInteraction; nonce: Fr }> {
    try {
      const nonce = Fr.random();
      const action = await this.token.methods.burn_public(from, amount, nonce);
      return { action, nonce };
    } catch (error) {
      throw createError(
        ErrorCode.L2_BURN_OPERATION,
        `Failed to burn ${amount} tokens from ${from} for token ${this.token.address}`,
        {
          tokenAddress: this.token.address.toString(),
          amount: amount.toString(),
          userAddress: from.toString(),
        },
        error,
      );
    }
  }

  /**
   * Creates a public authwit action for burning tokens (used for withdrawals)
   * @param from The address to burn tokens from
   * @param amount The amount to burn
   * @returns The public authwit action for the burn, the original burn intent, and nonce
   */
  async createPublicBurnAuthwitAction(
    from: AztecAddress,
    amount: bigint,
  ): Promise<{
    action: ContractFunctionInteraction;
    intent: IntentInnerHash;
    nonce: Fr;
  }> {
    try {
      const { action, nonce } = await this.createBurnAction(from, amount);
      const caller = await this.getPortal();
      const innerHash = await computeInnerAuthWitHashFromAction(caller, action);
      const intent: IntentInnerHash = {
        consumer: this.token.address,
        innerHash,
      };

      const intentMetadata = {
        chainId: this.client.getWallet().getChainId(),
        version: this.client.getWallet().getVersion(),
      };

      const messageHash = await computeAuthWitMessageHash(intent, intentMetadata);

      const authWitAction = new ContractFunctionInteraction(
        this.client.getWallet(),
        ProtocolContractAddress.AuthRegistry,
        getSetAuthorizedAbi(),
        [messageHash, true],
      );

      return {
        action: authWitAction,
        intent,
        nonce,
      };
    } catch (error) {
      throw createError(
        ErrorCode.L2_BURN_OPERATION,
        `Failed to burn ${amount} tokens from ${from} for token ${this.token.address}`,
        {
          tokenAddress: this.token.address.toString(),
          amount: amount.toString(),
          userAddress: from.toString(),
        },
        error,
      );
    }
  }

  /**
   * Gets the shield gateway address from the token contract
   *
   * The shield gateway is responsible for authorizing private transfers
   * to different addresses. This method retrieves the gateway address
   * configured in the token contract.
   *
   * @returns Promise resolving to the shield gateway address
   * @throws {TurnstileError} If unable to retrieve the shield gateway address
   */
  private async getShieldGatewayAddress(): Promise<AztecAddress> {
    try {
      return await this.token.methods.get_shield_gateway_public().simulate({ from: this.client.getAddress() });
    } catch (error) {
      throw createError(
        ErrorCode.L2_CONTRACT_INTERACTION,
        `Failed to get shield gateway address for token ${this.token.address}`,
        { tokenAddress: this.token.address.toString() },
        error,
      );
    }
  }

  /**
   * Creates a new L2Token from an address
   * @param address The token address
   * @param client The L2 client
   * @returns The token
   */
  static async fromAddress(address: AztecAddress, client: IL2Client): Promise<L2Token> {
    try {
      const token = await TokenContract.at(address, client.getWallet());
      return new L2Token(token, client);
    } catch (error) {
      throw createError(
        ErrorCode.L2_CONTRACT_INTERACTION,
        `Failed to create token from address ${address}`,
        { tokenAddress: address.toString() },
        error,
      );
    }
  }

  /**
   * Deploys a new token contract
   * @param client The L2 client
   * @param portalAddr The portal address
   * @param name The token name
   * @param symbol The token symbol
   * @param decimals The token decimals
   * @param deployOptions The deployment options
   * @returns The token
   */
  static async deploy(
    client: IL2Client,
    portalAddr: AztecAddress,
    name: string,
    symbol: string,
    decimals: number,
    deployOptions: Partial<DeployOptions> = {},
  ): Promise<L2Token> {
    try {
      const wallet = client.getWallet();

      const options: DeployOptions = {
        from: client.getAddress(),
        universalDeploy: true,
        contractAddressSalt: L2_CONTRACT_DEPLOYMENT_SALT,
        fee: client.getFeeOpts(),
        ...deployOptions,
      };

      const tokenContract = await Contract.deploy(
        wallet,
        TokenContractArtifact,
        [name, symbol, decimals, portalAddr /* minter */, AztecAddress.ZERO /* upgrade_authority */],
        'constructor_with_minter',
      )
        .send(options)
        .deployed();

      const token = await TokenContract.at(tokenContract.address, wallet);

      return new L2Token(token, client);
    } catch (error) {
      throw createError(
        ErrorCode.L2_DEPLOYMENT,
        `Failed to deploy token with name ${name} and symbol ${symbol}`,
        {
          tokenName: name,
          tokenSymbol: symbol,
          decimals,
        },
        error,
      );
    }
  }

  static async register(
    client: IL2Client,
    tokenAddress: AztecAddress,
    portalAddress: AztecAddress,
    name: string,
    symbol: string,
    decimals: number,
  ): Promise<L2Token> {
    const instance = await getContractInstanceFromInstantiationParams(TokenContractArtifact, {
      constructorArtifact: 'constructor_with_minter',
      constructorArgs: [name, symbol, decimals, portalAddress, AztecAddress.ZERO /* upgrade_authority */],
      salt: L2_CONTRACT_DEPLOYMENT_SALT,
      deployer: AztecAddress.ZERO,
      publicKeys: PublicKeys.default(),
    });

    if (!instance.address.equals(tokenAddress)) {
      throw createError(
        ErrorCode.L2_GENERAL,
        `Token address mismatch: ${instance.address.toString()} !== ${tokenAddress.toString()}`,
        {
          instanceAddress: instance.address.toString(),
          tokenAddress: tokenAddress.toString(),
        },
      );
    }
    console.debug(`Registering Token in PXE: ${tokenAddress.toString()}`);
    await client.getWallet().registerContract({ instance, artifact: TokenContractArtifact });

    return L2Token.fromAddress(tokenAddress, client);
  }
}

function getSetAuthorizedAbi(): FunctionAbi {
  return {
    name: 'set_authorized',
    isInitializer: false,
    functionType: FunctionType.PUBLIC,
    isInternal: true,
    isStatic: false,
    parameters: [
      {
        name: 'message_hash',
        type: { kind: 'field' },
        visibility: 'private' as ABIParameterVisibility,
      },
      {
        name: 'authorize',
        type: { kind: 'boolean' },
        visibility: 'private' as ABIParameterVisibility,
      },
    ],
    returnTypes: [],
    errorTypes: {},
  };
}
