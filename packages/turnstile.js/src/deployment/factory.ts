import { AztecAddress, type AztecNode, EthAddress, Fr, type Wallet } from '@aztec/aztec.js';
import { type Address, createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { createError, ErrorCode } from '../errors.js';
import { L1AllowList } from '../l1/allowList.js';
import { type IL1Client, L1Client } from '../l1/client.js';
import { L1Portal } from '../l1/portal.js';
import { L1Token } from '../l1/token.js';
import { type IL2Client, L2Client } from '../l2/client.js';
import { L2Portal } from '../l2/portal.js';
import { L2Token } from '../l2/token.js';
import { loadConfig } from './config.js';
import type { ConfigSource, DeploymentDataToken, TokenInfo, TurnstileConfig } from './types.js';

// Map of L2 client address (as string) to a map of addresses (as strings) registered in its PXE during this session
const registeredInPXE = new Map<string, Set<string>>();

/**
 * Factory class for creating Turnstile objects with configuration
 */
export class TurnstileFactory {
  private config: TurnstileConfig;

  /**
   * Creates a new TurnstileFactory
   * @param config The Turnstile configuration
   */
  constructor(config: TurnstileConfig) {
    this.config = config;
  }

  private isRegistered(l2Client: IL2Client, address: AztecAddress): boolean {
    const clientKey = l2Client.getAddress().toString();
    const addressKey = address.toString();
    const clientSet = registeredInPXE.get(clientKey);
    if (!clientSet) {
      return false;
    }
    return clientSet.has(addressKey);
  }

  private setRegistered(l2Client: IL2Client, address: AztecAddress) {
    const clientKey = l2Client.getAddress().toString();
    const addressKey = address.toString();
    let clientSet = registeredInPXE.get(clientKey);
    if (!clientSet) {
      clientSet = new Set<string>();
      registeredInPXE.set(clientKey, clientSet);
    }
    clientSet.add(addressKey);
  }

  /**
   * Creates a TurnstileFactory from a configuration source
   * @param source The configuration source (network name or URL)
   * @param customTokens Optional custom token configurations
   * @returns The TurnstileFactory
   */
  static async fromConfig(
    source: ConfigSource,
    customTokens?: Record<string, DeploymentDataToken>,
  ): Promise<TurnstileFactory> {
    const config = await loadConfig(source, customTokens);
    return new TurnstileFactory(config);
  }

  /**
   * Creates an L1 client with the configured RPC endpoint
   * @param privateKey The private key for the wallet (hex string with 0x prefix)
   * @param customRpcUrl Optional custom RPC URL to override configuration
   * @returns The L1 client instance for blockchain interactions
   */
  createL1Client(privateKey: string, customRpcUrl?: string): IL1Client {
    const rpcUrl = customRpcUrl || this.config.network.rpc.l1;

    const publicClient = createPublicClient({
      chain: sepolia, // TODO: Make this configurable based on l1ChainId
      transport: http(rpcUrl),
    });

    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: sepolia, // TODO: Make this configurable based on l1ChainId
      transport: http(rpcUrl),
    });

    return new L1Client(publicClient, walletClient);
  }

  /**
   * Creates an L2 client with the configured RPC endpoint
   * @param node The AztecNode instance for L2 blockchain communication
   * @param wallet The Aztec wallet instance for transaction signing
   * @returns The L2 client instance for Aztec network interactions
   */
  createL2Client(node: AztecNode, wallet: Wallet): IL2Client {
    return new L2Client(node, wallet);
  }

  /**
   * Creates an L1 portal using the configured address
   * @param l1Client The L1 client
   * @returns The L1 portal
   */
  createL1Portal(l1Client: IL1Client): L1Portal {
    const portalAddress = this.config.network.deployment.l1Portal as Address;
    return new L1Portal(portalAddress, l1Client);
  }

  /**
   * Creates an L1 allow list using the configured address
   * @param l1Client The L1 client
   * @param approverL1Client Optional approver L1 client
   * @returns The L1 allow list
   */
  createL1AllowList(l1Client: IL1Client, approverL1Client?: IL1Client): L1AllowList {
    const allowListAddress = this.config.network.deployment.l1AllowList as Address;
    return new L1AllowList(allowListAddress, l1Client, approverL1Client);
  }

  /**
   * Creates an L1 token using the configured address or custom token info
   * @param l1Client The L1 client instance for blockchain interactions
   * @param tokenSymbol The token symbol to look up in configuration
   * @param customTokenInfo Optional custom token information to override configuration
   * @returns The L1 token instance
   * @throws {TurnstileError} With ErrorCode.CONFIG_MISSING_PARAMETER if token not found in configuration
   */
  createL1Token(l1Client: IL1Client, tokenSymbol: string, customTokenInfo?: DeploymentDataToken): L1Token {
    let tokenAddress: string;

    if (customTokenInfo) {
      tokenAddress = customTokenInfo.l1Address;
    } else {
      const token = this.config.network.deployment.tokens[tokenSymbol];
      if (!token) {
        throw createError(ErrorCode.CONFIG_MISSING_PARAMETER, `Token ${tokenSymbol} not found in configuration`, {
          tokenSymbol,
          availableTokens: Object.keys(this.config.network.deployment.tokens),
        });
      }
      tokenAddress = token.l1Address;
    }

    return new L1Token(tokenAddress as Address, l1Client);
  }

  /**
   * Creates an L2 portal using the configured address
   * @param l2Client The L2 client
   * @returns The L2 portal
   */
  async createL2Portal(l2Client: IL2Client, l1Client?: IL1Client): Promise<L2Portal> {
    const portalAddress = AztecAddress.fromString(this.config.network.deployment.aztecPortal);

    console.debug(
      `Creating L2 portal at ${portalAddress.toString()} for L2 client address ${l2Client.getAddress().toString()} and L1 client ${l1Client?.getAddress().toString()}`,
    );

    // If we've already registered this portal in the PXE, skip registration
    if (!this.isRegistered(l2Client, portalAddress)) {
      // Register the portal in the PXE
      const l1Portal = EthAddress.fromString(this.config.network.deployment.l1Portal);
      const tokenContractClassId = Fr.fromString(this.config.network.deployment.aztecTokenContractClassID);
      const shieldGateway = AztecAddress.fromString(this.config.network.deployment.aztecShieldGateway);

      const l2Portal = await L2Portal.register(
        l2Client,
        portalAddress,
        l1Portal,
        tokenContractClassId,
        shieldGateway,
        l1Client,
      );
      this.setRegistered(l2Client, portalAddress);
      return l2Portal;
    }
    return new L2Portal(portalAddress, l2Client, l1Client);
  }

  /**
   * Creates an L2 token using the configured address or custom token info
   * @param l2Client The L2 client instance for Aztec network interactions
   * @param tokenInfo The token information containing L1 and L2 addresses and metadata
   * @returns The L2 token instance
   * @throws {TurnstileError} With ErrorCode.CONFIG_MISSING_PARAMETER if token not found in configuration
   */
  async createL2Token(l2Client: IL2Client, tokenInfo: TokenInfo): Promise<L2Token> {
    const tokenAddress = AztecAddress.fromString(tokenInfo.l2Address);
    if (!this.isRegistered(l2Client, tokenAddress)) {
      // Register the token in the PXE
      const l2Token = await L2Token.register(
        l2Client,
        tokenAddress,
        AztecAddress.fromString(this.config.network.deployment.aztecPortal),
        tokenInfo.name,
        tokenInfo.symbol,
        tokenInfo.decimals,
      );
      this.setRegistered(l2Client, tokenAddress);
      return l2Token;
    }
    return L2Token.fromAddress(tokenAddress, l2Client);
  }

  /**
   * Gets the token information for a given symbol
   * @param tokenSymbol The token symbol to look up in configuration
   * @returns The token information containing L1 and L2 addresses
   * @throws {TurnstileError} With ErrorCode.CONFIG_MISSING_PARAMETER if token not found in configuration
   */
  getTokenInfo(tokenSymbol: string): DeploymentDataToken {
    // Check custom tokens first
    if (this.config.customTokens?.[tokenSymbol]) {
      return this.config.customTokens[tokenSymbol];
    }

    // Check configured tokens
    const token = this.config.network.deployment.tokens[tokenSymbol];
    if (!token) {
      throw createError(ErrorCode.CONFIG_MISSING_PARAMETER, `Token ${tokenSymbol} not found in configuration`, {
        tokenSymbol,
        availableTokens: Object.keys(this.config.network.deployment.tokens),
      });
    }

    return token;
  }

  /**
   * Gets all available token symbols
   * @returns Array of token symbols
   */
  getAvailableTokens(): string[] {
    const configuredTokens = Object.keys(this.config.network.deployment.tokens);
    const customTokens = this.config.customTokens ? Object.keys(this.config.customTokens) : [];

    return [...new Set([...configuredTokens, ...customTokens])];
  }

  /**
   * Gets the network configuration
   * @returns The network configuration
   */
  getNetworkConfig() {
    return this.config.network;
  }

  /**
   * Gets the deployment data
   * @returns The deployment data
   */
  getDeploymentData() {
    return this.config.network.deployment;
  }
}
