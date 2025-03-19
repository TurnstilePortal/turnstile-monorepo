import {
  encodeFunctionData,
  parseEventLogs,
  type Address,
  type TransactionReceipt,
  type TransactionRequest,
  type Hash,
} from 'viem';
import { SiblingPath } from '@aztec/aztec.js';
import { L1Error } from '../errors.js';
import { L1Client } from './client.js';

/**
 * Interface for L1 portal operations
 */
export interface L1Portal {
  /**
   * Gets the portal address
   * @returns The portal address
   */
  getAddress(): Address;

  /**
   * Gets the L2 portal address
   * @returns The L2 portal address
   */
  getL2Portal(): Promise<`0x${string}`>;

  /**
   * Sets the L2 portal address
   * @param l2Portal The L2 portal address
   * @param options Transaction options
   * @returns The transaction receipt
   */
  setL2Portal(
    l2Portal: `0x${string}`,
    options?: Omit<TransactionRequest, 'to' | 'data'>
  ): Promise<TransactionReceipt>;

  /**
   * Deposits tokens to L2
   * @param tokenAddr The token address
   * @param l2RecipientAddr The L2 recipient address
   * @param amount The amount to deposit
   * @param options Transaction options
   * @returns The deposit result
   */
  deposit(
    tokenAddr: Address,
    l2RecipientAddr: string,
    amount: bigint,
    options?: Omit<TransactionRequest, 'to' | 'data'>
  ): Promise<{
    txHash: Hash;
    messageHash: `0x${string}`;
    messageIndex: bigint;
  }>;

  /**
   * Registers a token with the portal
   * @param tokenAddr The token address
   * @param options Transaction options
   * @returns The registration result
   */
  register(
    tokenAddr: Address,
    options?: Omit<TransactionRequest, 'to' | 'data'>
  ): Promise<{
    txHash: Hash;
    messageHash: `0x${string}`;
    messageIndex: bigint;
  }>;

  /**
   * Withdraws tokens from L2
   * @param leaf The L2 to L1 message leaf
   * @param l2BlockNumber The L2 block number
   * @param leafIndex The leaf index
   * @param siblingPath The sibling path
   * @param options Transaction options
   * @returns The transaction hash
   */
  withdraw(
    leaf: `0x${string}`,
    l2BlockNumber: bigint,
    leafIndex: bigint,
    siblingPath: SiblingPath<number>,
    options?: Omit<TransactionRequest, 'to' | 'data'>
  ): Promise<Hash>;

  /**
   * Checks if a block is available on L1
   * @param l2BlockNumber The L2 block number
   * @returns True if the block is available on L1
   */
  isBlockAvailableOnL1(l2BlockNumber: bigint): Promise<boolean>;

  /**
   * Waits for a block to be available on L1
   * @param l2BlockNumber The L2 block number
   * @param timeoutSeconds The timeout in seconds
   * @param intervalSeconds The polling interval in seconds
   */
  waitForBlockOnL1(
    l2BlockNumber: bigint,
    timeoutSeconds?: number,
    intervalSeconds?: number
  ): Promise<void>;
}

/**
 * Implementation of L1Portal for the token portal contract
 */
export class L1TokenPortal implements L1Portal {
  private address: Address;
  private client: L1Client;
  private rollupAddress?: Address;

  /**
   * Creates a new L1TokenPortal
   * @param address The portal address
   * @param client The L1 client
   * @param rollupAddress The rollup address (optional)
   */
  constructor(address: Address, client: L1Client, rollupAddress?: Address) {
    this.address = address;
    this.client = client;
    this.rollupAddress = rollupAddress;
  }

  /**
   * Gets the portal address
   * @returns The portal address
   */
  getAddress(): Address {
    return this.address;
  }

  /**
   * Gets the L2 portal address
   * @returns The L2 portal address
   */
  async getL2Portal(): Promise<`0x${string}`> {
    try {
      const publicClient = this.client.getPublicClient();

      // Define the ABI for the l2Portal function
      const abi = [{
        name: 'l2Portal',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'bytes32' }]
      }] as const;

      return await publicClient.readContract({
        address: this.address,
        abi,
        functionName: 'l2Portal',
      }) as `0x${string}`;
    } catch (error) {
      throw new L1Error(`Failed to get L2 portal address from ${this.address}`, error);
    }
  }

  /**
   * Sets the L2 portal address
   * @param l2Portal The L2 portal address
   * @param options Transaction options
   * @returns The transaction receipt
   */
  async setL2Portal(
    l2Portal: `0x${string}`,
    options?: Omit<TransactionRequest, 'to' | 'data'>
  ): Promise<TransactionReceipt> {
    try {
      const walletClient = this.client.getWalletClient();

      if (!walletClient.account) {
        throw new L1Error('No account connected to wallet client');
      }

      // Define the ABI for the setL2Portal function
      const abi = [{
        name: 'setL2Portal',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'l2Portal', type: 'bytes32' }
        ],
        outputs: []
      }] as const;

      // Execute the transaction
      const hash = await walletClient.writeContract({
        address: this.address,
        abi,
        functionName: 'setL2Portal',
        args: [l2Portal],
        account: walletClient.account,
        chain: walletClient.chain || null,
      });

      return await this.client.getPublicClient().waitForTransactionReceipt({ hash });
    } catch (error) {
      throw new L1Error(`Failed to set L2 portal to ${l2Portal}`, error);
    }
  }

  /**
   * Deposits tokens to L2
   * @param tokenAddr The token address
   * @param l2RecipientAddr The L2 recipient address
   * @param amount The amount to deposit
   * @param options Transaction options
   * @returns The deposit result
   */
  async deposit(
    tokenAddr: Address,
    l2RecipientAddr: string,
    amount: bigint,
    options?: Omit<TransactionRequest, 'to' | 'data'>
  ): Promise<{
    txHash: Hash;
    messageHash: `0x${string}`;
    messageIndex: bigint;
  }> {
    try {
      const walletClient = this.client.getWalletClient();

      if (!walletClient.account) {
        throw new L1Error('No account connected to wallet client');
      }

      // Encode the deposit data
      const encodedData = this.encodeDepositData(tokenAddr, l2RecipientAddr, amount);

      // Define the ABI for the deposit function
      const abi = [{
        name: 'deposit',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: '_data', type: 'bytes' }
        ],
        outputs: [{ name: 'key', type: 'bytes32' }]
      }] as const;

      // Execute the transaction
      const hash = await walletClient.writeContract({
        address: this.address,
        abi,
        functionName: 'deposit',
        args: [encodedData],
        account: walletClient.account,
        chain: walletClient.chain || null,
      });

      const receipt = await this.client.getPublicClient().waitForTransactionReceipt({ hash });

      // Parse the deposit log
      const depositLog = this.parseDepositLog(receipt);

      // Parse the message sent log
      const messageSentLog = this.parseMessageSentLog(receipt);

      return {
        txHash: hash,
        messageHash: depositLog.hash,
        messageIndex: depositLog.index,
      };
    } catch (error) {
      throw new L1Error(`Failed to deposit ${amount} of token ${tokenAddr} to ${l2RecipientAddr}`, error);
    }
  }

  /**
   * Registers a token with the portal
   * @param tokenAddr The token address
   * @param options Transaction options
   * @returns The registration result
   */
  async register(
    tokenAddr: Address,
    options?: Omit<TransactionRequest, 'to' | 'data'>
  ): Promise<{
    txHash: Hash;
    messageHash: `0x${string}`;
    messageIndex: bigint;
  }> {
    try {
      const walletClient = this.client.getWalletClient();

      if (!walletClient.account) {
        throw new L1Error('No account connected to wallet client');
      }

      // Define the ABI for the register function
      const abi = [{
        name: 'register',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'token', type: 'address' }
        ],
        outputs: [{ name: 'key', type: 'bytes32' }]
      }] as const;

      // Execute the transaction
      const hash = await walletClient.writeContract({
        address: this.address,
        abi,
        functionName: 'register',
        args: [tokenAddr],
        account: walletClient.account,
        chain: walletClient.chain || null,
      });

      const receipt = await this.client.getPublicClient().waitForTransactionReceipt({ hash });

      // Parse the register log
      const registerLog = this.parseRegisterLog(receipt);

      // Parse the message sent log
      const messageSentLog = this.parseMessageSentLog(receipt);

      return {
        txHash: hash,
        messageHash: registerLog.hash,
        messageIndex: registerLog.index,
      };
    } catch (error) {
      throw new L1Error(`Failed to register token ${tokenAddr}`, error);
    }
  }

  /**
   * Withdraws tokens from L2
   * @param leaf The L2 to L1 message leaf
   * @param l2BlockNumber The L2 block number
   * @param leafIndex The leaf index
   * @param siblingPath The sibling path
   * @param options Transaction options
   * @returns The transaction hash
   */
  async withdraw(
    leaf: `0x${string}`,
    l2BlockNumber: bigint,
    leafIndex: bigint,
    siblingPath: SiblingPath<number>,
    options?: Omit<TransactionRequest, 'to' | 'data'>
  ): Promise<Hash> {
    try {
      const walletClient = this.client.getWalletClient();

      if (!walletClient.account) {
        throw new L1Error('No account connected to wallet client');
      }

      // Convert sibling path to hex strings
      const siblingPathHex = siblingPath
        .toBufferArray()
        .map((buf: Buffer) => `0x${buf.toString('hex')}`) as readonly `0x${string}`[];

      // Define the ABI for the withdraw function
      const abi = [{
        name: 'withdraw',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'leaf', type: 'bytes32' },
          { name: 'l2BlockNumber', type: 'uint256' },
          { name: 'leafIndex', type: 'uint256' },
          { name: 'siblingPath', type: 'bytes32[]' }
        ],
        outputs: []
      }] as const;

      // Execute the transaction
      const hash = await walletClient.writeContract({
        address: this.address,
        abi,
        functionName: 'withdraw',
        args: [leaf, l2BlockNumber, leafIndex, siblingPathHex],
        account: walletClient.account,
        chain: walletClient.chain || null,
      });

      return hash;
    } catch (error) {
      throw new L1Error(`Failed to withdraw with leaf ${leaf}`, error);
    }
  }

  /**
   * Checks if a block is available on L1
   * @param l2BlockNumber The L2 block number
   * @returns True if the block is available on L1
   */
  async isBlockAvailableOnL1(l2BlockNumber: bigint): Promise<boolean> {
    try {
      const rollupAddress = await this.getRollupAddress();
      const publicClient = this.client.getPublicClient();

      // Define the ABI for the getChainTips function
      const abi = [{
        name: 'getChainTips',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [
          {
            type: 'tuple',
            components: [
              { name: 'provenL2BlockNumber', type: 'uint256' },
              { name: 'provenL2BlockHash', type: 'bytes32' },
              { name: 'finalizedL2BlockNumber', type: 'uint256' },
              { name: 'finalizedL2BlockHash', type: 'bytes32' }
            ]
          }
        ]
      }] as const;

      const chainTips = await publicClient.readContract({
        address: rollupAddress,
        abi,
        functionName: 'getChainTips',
      }) as { provenL2BlockNumber: bigint };

      return l2BlockNumber <= chainTips.provenL2BlockNumber;
    } catch (error) {
      throw new L1Error(`Failed to check if block ${l2BlockNumber} is available on L1`, error);
    }
  }

  /**
   * Waits for a block to be available on L1
   * @param l2BlockNumber The L2 block number
   * @param timeoutSeconds The timeout in seconds
   * @param intervalSeconds The polling interval in seconds
   */
  async waitForBlockOnL1(
    l2BlockNumber: bigint,
    timeoutSeconds = 60,
    intervalSeconds = 5
  ): Promise<void> {
    const startTime = Date.now();
    const timeoutMs = timeoutSeconds * 1000;
    const intervalMs = intervalSeconds * 1000;

    while (Date.now() - startTime < timeoutMs) {
      if (await this.isBlockAvailableOnL1(l2BlockNumber)) {
        return;
      }

      // Wait for the next interval
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    throw new L1Error(`Timeout waiting for block ${l2BlockNumber} to be available on L1`);
  }

  /**
   * Gets the rollup address
   * @returns The rollup address
   */
  private async getRollupAddress(): Promise<Address> {
    if (this.rollupAddress) {
      return this.rollupAddress;
    }

    try {
      const publicClient = this.client.getPublicClient();

      // Define the ABI for the aztecRollup function
      const abi = [{
        name: 'aztecRollup',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'address' }]
      }] as const;

      this.rollupAddress = await publicClient.readContract({
        address: this.address,
        abi,
        functionName: 'aztecRollup',
      }) as Address;

      return this.rollupAddress;
    } catch (error) {
      throw new L1Error(`Failed to get rollup address from ${this.address}`, error);
    }
  }

  /**
   * Encodes the deposit data
   * @param tokenAddr The token address
   * @param l2RecipientAddr The L2 recipient address
   * @param amount The amount to deposit
   * @returns The encoded deposit data
   */
  private encodeDepositData(
    tokenAddr: string,
    l2RecipientAddr: string,
    amount: bigint
  ): `0x${string}` {
    // Define the ABI for the deposit function
    const abi = [{
      name: 'deposit',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'token', type: 'address' },
        { name: 'l2Recipient', type: 'bytes32' },
        { name: 'amount', type: 'uint256' }
      ],
      outputs: []
    }] as const;

    // Encode the function data
    return encodeFunctionData({
      abi,
      functionName: 'deposit',
      args: [tokenAddr as Address, l2RecipientAddr as `0x${string}`, amount],
    });
  }

  /**
   * Parses the deposit log from a transaction receipt
   * @param receipt The transaction receipt
   * @returns The deposit log
   */
  private parseDepositLog(receipt: TransactionReceipt): {
    token: Address;
    sender: Address;
    hash: `0x${string}`;
    index: bigint;
  } {
    // Define the ABI for the Deposit event
    const abi = [{
      name: 'Deposit',
      type: 'event',
      inputs: [
        { name: 'token', type: 'address', indexed: true },
        { name: 'sender', type: 'address', indexed: true },
        { name: 'leaf', type: 'bytes32', indexed: false },
        { name: 'index', type: 'uint256', indexed: false }
      ]
    }] as const;

    // Parse the logs
    const logs = parseEventLogs({
      abi,
      eventName: 'Deposit',
      logs: receipt.logs,
    });

    if (logs.length === 0) {
      throw new L1Error(`No Deposit logs found in receipt for transaction: ${receipt.transactionHash}`);
    }

    const log = logs[0];
    if (!log || !log.args) {
      throw new L1Error(`Failed to parse Deposit log in receipt for transaction: ${receipt.transactionHash}`);
    }

    return {
      token: log.args.token,
      sender: log.args.sender,
      hash: log.args.leaf,
      index: log.args.index,
    };
  }

  /**
   * Parses the register log from a transaction receipt
   * @param receipt The transaction receipt
   * @returns The register log
   */
  private parseRegisterLog(receipt: TransactionReceipt): {
    token: Address;
    hash: `0x${string}`;
    index: bigint;
  } {
    // Define the ABI for the Registered event
    const abi = [{
      name: 'Registered',
      type: 'event',
      inputs: [
        { name: 'token', type: 'address', indexed: true },
        { name: 'leaf', type: 'bytes32', indexed: false },
        { name: 'index', type: 'uint256', indexed: false }
      ]
    }] as const;

    // Parse the logs
    const logs = parseEventLogs({
      abi,
      eventName: 'Registered',
      logs: receipt.logs,
    });

    if (logs.length === 0) {
      throw new L1Error(`No Registered logs found in receipt for transaction: ${receipt.transactionHash}`);
    }

    const log = logs[0];
    if (!log || !log.args) {
      throw new L1Error(`Failed to parse Registered log in receipt for transaction: ${receipt.transactionHash}`);
    }

    return {
      token: log.args.token,
      hash: log.args.leaf,
      index: log.args.index,
    };
  }

  /**
   * Parses the message sent log from a transaction receipt
   * @param receipt The transaction receipt
   * @returns The message sent log
   */
  private parseMessageSentLog(receipt: TransactionReceipt): {
    l2BlockNumber: bigint;
    index: bigint;
    hash: `0x${string}`;
  } {
    // Define the ABI for the MessageSent event
    const abi = [{
      name: 'MessageSent',
      type: 'event',
      inputs: [
        { name: 'l2BlockNumber', type: 'uint256', indexed: false },
        { name: 'index', type: 'uint256', indexed: false },
        { name: 'hash', type: 'bytes32', indexed: false }
      ]
    }] as const;

    // Parse the logs
    const logs = parseEventLogs({
      abi,
      eventName: 'MessageSent',
      logs: receipt.logs,
    });

    if (logs.length === 0) {
      throw new L1Error(`No MessageSent logs found in receipt for transaction: ${receipt.transactionHash}`);
    }

    const log = logs[0];
    if (!log || !log.args) {
      throw new L1Error(`Failed to parse MessageSent log in receipt for transaction: ${receipt.transactionHash}`);
    }

    return {
      l2BlockNumber: log.args.l2BlockNumber,
      index: log.args.index,
      hash: log.args.hash,
    };
  }
}
