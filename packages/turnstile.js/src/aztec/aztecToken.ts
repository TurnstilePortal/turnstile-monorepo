import { Fr } from '@aztec/aztec.js';
import type {
  AuthWitness,
  AztecAddress,
  ContractFunctionInteraction,
  Wallet,
} from '@aztec/aztec.js';
import {
  ShieldGatewayContract,
  TokenContract,
} from '@turnstile-portal/aztec-artifacts';
import { fieldCompressedStringToString } from './utils.js';

/**
 * The Aztec Token contract.
 */
export const AztecTokenContract = TokenContract;

/**
 * The salt used for Aztec Token deployment.
 */
export const TURNSTILE_AZTEC_TOKEN_DEPLOYMENT_SALT =
  Fr.fromHexString('0x9876543210');

/**
 * The slot used for the verifiable presentation in the Shield Gateway Contract.
 */
export const VP_SLOT = Fr.fromHexString('0x1dfeed');
export const BIN_AMOUNT = 1_000_000_000n;

/**
 * Class representing an Aztec Token.
 */
export class AztecToken {
  token: TokenContract;
  wallet: Wallet;
  private _addressCache: Map<string, AztecAddress> = new Map();

  /**
   * Creates an instance of AztecToken.
   * @param {TokenContract} token - The token contract instance.
   */
  constructor(token: TokenContract) {
    this.token = token;
    this.wallet = token.wallet;
  }

  /**
   * Deploys a new Aztec Token contract.
   * @param {Wallet} wallet - The wallet to deploy the contract.
   * @param {AztecAddress} portalAddr - The address of the portal.
   * @param {string} name - The name of the token.
   * @param {string} symbol - The symbol of the token.
   * @param {number} decimals - The number of decimals for the token.
   * @returns {Promise<AztecToken>} - A promise that resolves to an instance of AztecToken.
   */
  static async deploy(
    wallet: Wallet,
    portalAddr: AztecAddress,
    name: string,
    symbol: string,
    decimals: number,
  ) {
    const token = await TokenContract.deploy(
      wallet,
      portalAddr,
      name,
      symbol,
      decimals,
    )
      .send({
        universalDeploy: true,
        contractAddressSalt: TURNSTILE_AZTEC_TOKEN_DEPLOYMENT_SALT,
      })
      .deployed();
    return new AztecToken(token);
  }

  /**
   * Gets an existing Aztec Token contract.
   * @param {AztecAddress} tokenAddr - The address of the token contract.
   * @param {Wallet} wallet - The wallet to interact with the contract.
   * @returns {Promise<AztecToken>} - A promise that resolves to an instance of AztecToken.
   */
  static async getToken(tokenAddr: AztecAddress, wallet: Wallet) {
    const token = await TokenContract.at(tokenAddr, wallet);
    return new AztecToken(token);
  }

  /**
   * Gets the address of the token contract.
   * @returns {string} - The address of the token contract.
   */
  address() {
    return this.token.address.toString();
  }

  /**
   * Gets the *public* balance of an account.
   * @param {AztecAddress} address - The address of the account.
   * @returns {Promise<bigint>} - A promise that resolves to the balance of the account.
   */
  async balanceOfPublic(address: AztecAddress) {
    return await this.token.methods.balance_of_public(address).simulate();
  }

  /**
   * Gets the *private* balance of an account.
   * @param {AztecAddress} address - The address of the account.
   * @returns {Promise<bigint>} - A promise that resolves to the balance of the account.
   */
  async balanceOfPrivate(address: AztecAddress) {
    return await this.token.methods.balance_of_private(address).simulate();
  }

  /**
   * Gets the total number of shielded tokens.
   * @returns {Promise<bigint>} - A promise that resolves to the total number of shielded tokens.
   */
  async shieldedSupply() {
    return await this.token.methods.shielded_supply().simulate();
  }

  /**
   * Gets the symbol of the token.
   * @returns {Promise<string>} - A promise that resolves to the symbol of the token.
   */
  async symbol() {
    const symbol = await this.token.methods.public_get_symbol().simulate();
    return fieldCompressedStringToString(symbol.value);
  }

  /**
   * Gets the name of the token.
   * @returns {Promise<string>} - A promise that resolves to the name of the token.
   */
  async name() {
    const name = await this.token.methods.public_get_name().simulate();
    return fieldCompressedStringToString(name.value);
  }

  /**
   * Transfers tokens to an account.
   * @param {AztecAddress} to - The address of the account to transfer tokens to.
   * @param {bigint} amount - The amount of tokens to transfer.
   * @returns {Promise<TransactionReceipt>} - A promise that resolves to the transaction receipt.
   */
  async transferPublic(to: AztecAddress, amount: bigint) {
    return this.token.methods
      .transfer_public_to_public(
        this.wallet.getAddress(), // from
        to,
        amount,
        Fr.ZERO, // nonce
      )
      .send();
  }

  /**
   * Transfers tokens privately to an account.
   * @param {AztecAddress} to - The address of the account to transfer tokens to.
   * @param {bigint} amount - The amount of tokens to transfer.
   * @param {Fr[]} verifiedID - The verified ID of the account.
   * @returns {Promise<TransactionReceipt>} - A promise that resolves to the transaction receipt.
   */
  async transferPrivate(
    to: AztecAddress,
    amount: bigint,
    verifiedID: Fr[] & { length: 5 },
  ) {
    this.wallet.storeCapsule(
      await this.getShieldGatewayAddress(),
      VP_SLOT,
      verifiedID,
    );
    return this.token.methods
      .transfer_private_to_private(
        this.wallet.getAddress(), // from,
        to,
        amount,
        Fr.ZERO, // nonce
      )
      .send();
  }

  /**
   * Generates an `action` for use in a burn AuthWitness. Used when withdrawing tokens from the L2 chain.
   * @param {AztecAddress} from - The account to burn tokens from.
   * @param {bigint} amount - The amount of tokens to burn.
   * @returns {{ action: ContractFunctionInteraction, nonce: Fr }} - The action and nonce.
   * @example const { action, nonce } = token.burnAuthWitAction(from, amount);
   * @example // Set the public AuthWitness for the caller to allow the burn action
   * @example await wallet.setPublicAuthWit({ caller: portalAddr, action }, true).send().wait();
   */
  async burnAuthWitAction(
    from: AztecAddress,
    amount: bigint,
  ): Promise<{ action: ContractFunctionInteraction; nonce: Fr }> {
    const nonce = Fr.random();
    const action = await this.token.methods.burn_public(from, amount, nonce);
    return { action, nonce };
  }

  /**
   * Shield tokens.
   * @param {bigint} amount - The amount of tokens to shield.
   * @returns {{ tx: TransactionReceipt, nonce: Fr }} - The transaction receipt and shield nonce.
   * @example const tx = await token.shield(amount);
   * @example const receipt = await tx.wait();
   */
  async shield(amount: bigint) {
    return this.token.methods
      .shield(this.wallet.getAddress(), amount, Fr.ZERO)
      .send();
  }

  /**
   * Unshield tokens.
   * @param {bigint} amount - The amount of tokens to unshield.
   * @param {Fr} nonce - The nonce of the shield.
   * @returns {Promise<SentTx>} - A promise that resolves to the transaction receipt.
   * @example const tx = await token.unshield(amount, nonce);
   * @example const receipt = await tx.wait();
   */
  async unshield(amount: bigint) {
    return this.token.methods
      .unshield(this.wallet.getAddress(), amount, Fr.ZERO)
      .send();
  }

  /**
   * Creates an AuthWitness for a private transfer.
   * @param {AztecAddress} from - The address of the account to transfer tokens from.
   * @param {AztecAddress} to - The address of the account to transfer tokens to.
   * @param {bigint} amount - The amount of tokens to transfer.
   * @returns {Promise<{ authWitness: AuthWitness, nonce: Fr }>} - A promise that resolves to the AuthWitness and nonce.
   */
  async createAuthWitnessForPrivateTransfer(
    to: AztecAddress,
    amount: bigint,
  ): Promise<{ authWitness: AuthWitness; nonce: Fr }> {
    const nonce = Fr.random();

    const from = this.wallet.getAddress();
    const action = await this.token.methods.transfer_private_to_private(
      from,
      to,
      amount,
      nonce,
    );

    const shieldGatewayAddr = await this.getShieldGatewayAddress();
    const authWitness = await this.wallet.createAuthWit({
      caller: shieldGatewayAddr,
      action,
    });

    return { authWitness, nonce };
  }

  /**
   * Gets the shield gateway address.
   * @returns {Promise<AztecAddress>} - A promise that resolves to the shield gateway address.
   */
  async getShieldGatewayAddress(): Promise<AztecAddress> {
    if (this._addressCache.has('shieldGateway')) {
      // biome-ignore lint/style/noNonNullAssertion: We just checked if the key exists
      return this._addressCache.get('shieldGateway')!;
    }
    const shieldGateway = await this.token.methods
      .get_shield_gateway_public()
      .simulate();
    this._addressCache.set('shieldGateway', shieldGateway);
    return shieldGateway;
  }

  /**
   * Gets the shield gateway contract instance.
   * @returns {Promise<ShieldGatewayContract>} - A promise that resolves to the shield gateway contract instance.
   */
  async getShieldGateway(): Promise<ShieldGatewayContract> {
    const shieldGatewayAddr = await this.getShieldGatewayAddress();
    return ShieldGatewayContract.at(shieldGatewayAddr, this.wallet);
  }
}
