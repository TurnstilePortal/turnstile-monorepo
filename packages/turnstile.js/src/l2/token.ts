import {
  Fr,
  type AztecAddress,
  type ContractFunctionInteraction,
  type SentTx,
} from '@aztec/aztec.js';
import { TokenContract } from '@turnstile-portal/aztec-artifacts';
import { readFieldCompressedString } from '@aztec/aztec.js';
import { L2Error } from '../errors.js';
import {
  l2TokenErrorMessage,
  l2BalanceErrorMessage,
  l2TransferErrorMessage,
  shieldOperationErrorMessage,
  burnErrorMessage,
  tokenFromAddressErrorMessage,
  tokenDeployErrorMessage,
} from '../utils.js';
import type { L2Client } from './client.js';

/**
 * Interface for L2 token operations
 */
export interface L2Token {
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
export class L2TokenImpl implements L2Token {
  private client: L2Client;
  private token: TokenContract;

  /**
   * Creates a new L2TokenImpl
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
      throw new L2Error(
        l2TokenErrorMessage('get symbol', this.token.address),
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
      throw new L2Error(
        l2TokenErrorMessage('get name', this.token.address),
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
      throw new L2Error(
        l2TokenErrorMessage('get decimals', this.token.address),
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
      throw new L2Error(
        l2BalanceErrorMessage(address, this.token.address, 'public'),
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
      throw new L2Error(
        l2BalanceErrorMessage(address, this.token.address, 'private'),
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
      throw new L2Error(
        l2TransferErrorMessage(amount, to, this.token.address, 'publicly'),
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
      wallet.storeCapsule(
        shieldGatewayAddr,
        Fr.fromHexString('0x1dfeed'), // VP_SLOT
        verifiedID,
      );

      return this.token.methods
        .transfer_private_to_private(
          from,
          to,
          amount,
          Fr.ZERO, // nonce
        )
        .send();
    } catch (error) {
      throw new L2Error(
        l2TransferErrorMessage(amount, to, this.token.address, 'privately'),
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
      throw new L2Error(
        shieldOperationErrorMessage('shield', amount, this.token.address),
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
      throw new L2Error(
        shieldOperationErrorMessage('unshield', amount, this.token.address),
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
      throw new L2Error(
        burnErrorMessage(amount, from, this.token.address),
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
      throw new L2Error(
        l2TokenErrorMessage('get shield gateway address', this.token.address),
        error,
      );
    }
  }

  /**
   * Creates a new L2TokenImpl from an address
   * @param address The token address
   * @param client The L2 client
   * @returns The token
   */
  static async fromAddress(
    address: AztecAddress,
    client: L2Client,
  ): Promise<L2TokenImpl> {
    try {
      const token = await TokenContract.at(address, client.getWallet());
      return new L2TokenImpl(token, client);
    } catch (error) {
      throw new L2Error(tokenFromAddressErrorMessage(address), error);
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
  ): Promise<L2TokenImpl> {
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
          contractAddressSalt: Fr.fromHexString('0x9876543210'),
        })
        .deployed();

      return new L2TokenImpl(token, client);
    } catch (error) {
      throw new L2Error(tokenDeployErrorMessage(name, symbol), error);
    }
  }
}
