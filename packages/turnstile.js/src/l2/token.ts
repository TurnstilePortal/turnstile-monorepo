import {
  Fr,
  type AztecAddress,
  type ContractFunctionInteraction,
  type SentTx,
} from '@aztec/aztec.js';
import { TokenContract } from '@turnstile-portal/aztec-artifacts';
import { readFieldCompressedString } from '@aztec/aztec.js';
import { ErrorCode, createL2Error } from '../errors.js';
import type { L2Client } from './client.js';

// Constants
const VP_SLOT = Fr.fromHexString('0x1dfeed');
const CONTRACT_ADDRESS_SALT = Fr.fromHexString('0x9876543210');

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
  transferPublic(to: AztecAddress, amount: bigint): Promise<SentTx>;

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
  ): Promise<SentTx>;

  /**
   * Shields tokens (converts public to private)
   * @param amount The amount to shield
   * @returns The transaction
   */
  shield(amount: bigint): Promise<SentTx>;

  /**
   * Unshields tokens (converts private to public)
   * @param amount The amount to unshield
   * @returns The transaction
   */
  unshield(amount: bigint): Promise<SentTx>;

  /**
   * Creates an action for burning tokens (used for withdrawals)
   * @param from The address to burn tokens from
   * @param amount The amount to burn
   * @returns The burn action and nonce
   */
  createBurnAction(
    from: AztecAddress,
    amount: bigint,
  ): Promise<{ action: ContractFunctionInteraction; nonce: Fr }>;
}

/**
 * Implementation of L2Token for Aztec tokens
 */
export class L2Token implements IL2Token {
  private client: L2Client;
  private token: TokenContract;

  /**
   * Creates a new L2Token
   * @param token The token contract
   * @param client The L2 client
   */
  constructor(token: TokenContract, client: L2Client) {
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
   * Gets the token symbol
   * @returns The token symbol
   */
  async getSymbol(): Promise<string> {
    try {
      const symbol = await this.token.methods.public_get_symbol().simulate();
      return readFieldCompressedString(symbol);
    } catch (error) {
      throw createL2Error(
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
      const name = await this.token.methods.public_get_name().simulate();
      return readFieldCompressedString(name);
    } catch (error) {
      throw createL2Error(
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
      return Number(await this.token.methods.public_get_decimals().simulate());
    } catch (error) {
      throw createL2Error(
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
      return await this.token.methods.balance_of_public(address).simulate();
    } catch (error) {
      throw createL2Error(
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
      return await this.token.methods.balance_of_private(address).simulate();
    } catch (error) {
      throw createL2Error(
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
   * @returns The transaction
   */
  async transferPublic(to: AztecAddress, amount: bigint): Promise<SentTx> {
    try {
      const from = this.client.getAddress();
      return this.token.methods
        .transfer_public_to_public(
          from,
          to,
          amount,
          Fr.ZERO, // nonce
        )
        .send();
    } catch (error) {
      throw createL2Error(
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
   * @returns The transaction
   */
  async transferPrivate(
    to: AztecAddress,
    amount: bigint,
    verifiedID: Fr[] & { length: 5 },
  ): Promise<SentTx> {
    try {
      const from = this.client.getAddress();
      const wallet = this.client.getWallet();

      // Get the shield gateway address
      const shieldGatewayAddr = await this.getShieldGatewayAddress();

      // Store the verified ID in the wallet
      wallet.storeCapsule(shieldGatewayAddr, VP_SLOT, verifiedID);

      return this.token.methods
        .transfer_private_to_private(
          from,
          to,
          amount,
          Fr.ZERO, // nonce
        )
        .send();
    } catch (error) {
      throw createL2Error(
        ErrorCode.L2_TOKEN_OPERATION,
        `Failed to transfer ${amount} tokens privately to ${to} for token ${this.token.address}`,
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
   * Shields tokens (converts public to private)
   * @param amount The amount to shield
   * @returns The transaction
   */
  async shield(amount: bigint): Promise<SentTx> {
    try {
      const address = this.client.getAddress();
      return this.token.methods.shield(address, amount, Fr.ZERO).send();
    } catch (error) {
      throw createL2Error(
        ErrorCode.L2_SHIELD_OPERATION,
        `Failed to shield ${amount} tokens for token ${this.token.address}`,
        {
          tokenAddress: this.token.address.toString(),
          amount: amount.toString(),
        },
        error,
      );
    }
  }

  /**
   * Unshields tokens (converts private to public)
   * @param amount The amount to unshield
   * @returns The transaction
   */
  async unshield(amount: bigint): Promise<SentTx> {
    try {
      const address = this.client.getAddress();
      return this.token.methods.unshield(address, amount, Fr.ZERO).send();
    } catch (error) {
      throw createL2Error(
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
      throw createL2Error(
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
   * Gets the shield gateway address
   * @returns The shield gateway address
   */
  private async getShieldGatewayAddress(): Promise<AztecAddress> {
    try {
      return await this.token.methods.get_shield_gateway_public().simulate();
    } catch (error) {
      throw createL2Error(
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
  static async fromAddress(
    address: AztecAddress,
    client: L2Client,
  ): Promise<L2Token> {
    try {
      const token = await TokenContract.at(address, client.getWallet());
      return new L2Token(token, client);
    } catch (error) {
      throw createL2Error(
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
   * @returns The token
   */
  static async deploy(
    client: L2Client,
    portalAddr: AztecAddress,
    name: string,
    symbol: string,
    decimals: number,
  ): Promise<L2Token> {
    try {
      const wallet = client.getWallet();
      const token = await TokenContract.deploy(
        wallet,
        portalAddr,
        name,
        symbol,
        decimals,
      )
        .send({
          universalDeploy: true,
          contractAddressSalt: CONTRACT_ADDRESS_SALT,
        })
        .deployed();

      return new L2Token(token, client);
    } catch (error) {
      throw createL2Error(
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
}
