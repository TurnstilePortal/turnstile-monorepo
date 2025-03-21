import {
  encodeFunctionData,
  parseEventLogs,
  type Address,
  type TransactionReceipt,
  type TransactionRequest,
  type Hash,
} from 'viem';
import { SiblingPath } from '@aztec/aztec.js';
import { ErrorCode, createL1Error } from '../errors.js';
import { validateWallet } from '../validator.js';
import { IL1Client } from './client.js';

/**
 * Interface for L1 portal operations
 */
export interface IL1Portal {
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
   * @returns The transaction receipt
   */
  setL2Portal(
    l2Portal: `0x${string}`
  ): Promise<TransactionReceipt>;

  /**
   * Deposits tokens to L2
   * @param tokenAddr The token address
   * @param l2RecipientAddr The L2 recipient address
   * @param amount The amount to deposit
   * @returns The deposit result
   */
  deposit(
    tokenAddr: Address,
    l2RecipientAddr: string,
    amount: bigint
  ): Promise<{
    txHash: Hash;
    messageHash: `0x${string}`;
    messageIndex: bigint;
  }>;

  /**
   * Registers a token with the portal
   * @param tokenAddr The token address
   * @returns The registration result
   */
  register(
    tokenAddr: Address
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
   * @returns The transaction hash
   */
  withdraw(
    leaf: `0x${string}`,
    l2BlockNumber: bigint,
    leafIndex: bigint,
    siblingPath: SiblingPath<number>
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
 * Implementation of IL1Portal for the token portal contract
 */
export class L1Portal implements IL1Portal {
  private address: Address;
  private client: IL1Client;
  private rollupAddress?: Address;

  /**
   * Creates a new L1Portal
   * @param address The portal address
   * @param client The L1 client
   * @param rollupAddress The rollup address (optional)
   */
  constructor(address: Address, client: IL1Client, rollupAddress?: Address) {
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
      throw createL1Error(
        ErrorCode.L1_CONTRACT_INTERACTION,
        `Failed to get L2 portal address from ${this.address}`,
        { portalAddress: this.address },
        error
      );
    }
  }

  /**
   * Sets the L2 portal address
   * @param l2Portal The L2 portal address
   * @param options Transaction options
   * @returns The transaction receipt
   */
  async setL2Portal(
    l2Portal: `0x${string}`
  ): Promise<TransactionReceipt> {
    try {
      const walletClient = this.client.getWalletClient();

      validateWallet(walletClient, 'Cannot set L2 portal: No account connected to wallet');

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
        account: walletClient.account!,
        chain: walletClient.chain || null,
      });

      return await this.client.getPublicClient().waitForTransactionReceipt({ hash });
    } catch (error) {
      throw createL1Error(
        ErrorCode.L1_CONTRACT_INTERACTION,
        `Failed to set L2 portal to ${l2Portal}`,
        { portalAddress: this.address, l2Portal },
        error
      );
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
    amount: bigint
  ): Promise<{
    txHash: Hash;
    messageHash: `0x${string}`;
    messageIndex: bigint;
  }> {
    try {
      const walletClient = this.client.getWalletClient();

      validateWallet(walletClient, 'Cannot deposit: No account connected to wallet');

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
        account: walletClient.account!,
        chain: walletClient.chain || null,
      });

      const receipt = await this.client.getPublicClient().waitForTransactionReceipt({ hash });

      // Parse the deposit log
      const depositLog = this.parseDepositLog(receipt);

      return {
        txHash: hash,
        messageHash: depositLog.hash,
        messageIndex: depositLog.index,
      };
    } catch (error) {
      throw createL1Error(
        ErrorCode.L1_TOKEN_OPERATION,
        `Failed to deposit ${amount} of token ${tokenAddr} to ${l2RecipientAddr}`,
        {
          portalAddress: this.address,
          tokenAddress: tokenAddr,
          l2RecipientAddress: l2RecipientAddr,
          amount: amount.toString()
        },
        error
      );
    }
  }

  /**
   * Registers a token with the portal
   * @param tokenAddr The token address
   * @param options Transaction options
   * @returns The registration result
   */
  async register(
    tokenAddr: Address
  ): Promise<{
    txHash: Hash;
    messageHash: `0x${string}`;
    messageIndex: bigint;
  }> {
    try {
      const walletClient = this.client.getWalletClient();

      validateWallet(walletClient, 'Cannot register token: No account connected to wallet');

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
        account: walletClient.account!,
        chain: walletClient.chain || null,
      });

      const receipt = await this.client.getPublicClient().waitForTransactionReceipt({ hash });

      // Parse the register log
      const registerLog = this.parseRegisterLog(receipt);

      return {
        txHash: hash,
        messageHash: registerLog.hash,
        messageIndex: registerLog.index,
      };
    } catch (error) {
      throw createL1Error(
        ErrorCode.BRIDGE_REGISTER,
        `Failed to register token ${tokenAddr}`,
        { portalAddress: this.address, tokenAddress: tokenAddr },
        error
      );
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
    siblingPath: SiblingPath<number>
  ): Promise<Hash> {
    try {
      const walletClient = this.client.getWalletClient();

      validateWallet(walletClient, 'Cannot withdraw: No account connected to wallet');

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
        account: walletClient.account!,
        chain: walletClient.chain || null,
      });

      return hash;
    } catch (error) {
      throw createL1Error(
        ErrorCode.BRIDGE_WITHDRAW,
        `Failed to withdraw with leaf ${leaf}`,
        {
          portalAddress: this.address,
          leaf,
          l2BlockNumber: l2BlockNumber.toString(),
          leafIndex: leafIndex.toString()
        },
        error
      );
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
      throw createL1Error(
        ErrorCode.BRIDGE_MESSAGE,
        `Failed to check if block ${l2BlockNumber} is available on L1`,
        {
          portalAddress: this.address,
          l2BlockNumber: l2BlockNumber.toString(),
          rollupAddress: this.rollupAddress
        },
        error
      );
    }
  }

  /**
   * Checks if a block becomes available on L1 within a timeout period
   * @param l2BlockNumber The L2 block number
   * @param checkFn Function to check if block is available
   * @param timeProvider Function to get current time
   * @param sleep Function to wait for a time interval
   * @param timeoutSeconds The timeout in seconds
   * @param intervalSeconds The polling interval in seconds
   * @returns Promise that resolves to true if block becomes available, false if timeout occurs
   */
  async checkBlockAvailabilityWithTimeout(
    l2BlockNumber: bigint,
    checkFn: (blockNumber: bigint) => Promise<boolean>,
    timeProvider: () => number = Date.now,
    sleep: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
    timeoutSeconds = 60,
    intervalSeconds = 5
  ): Promise<boolean> {
    const startTime = timeProvider();
    const timeoutMs = timeoutSeconds * 1000;
    const intervalMs = intervalSeconds * 1000;

    while (timeProvider() - startTime < timeoutMs) {
      // Check if block is available
      if (await checkFn(l2BlockNumber)) {
        return true;
      }

      // Wait for next interval
      await sleep(intervalMs);
    }

    // Timeout occurred
    return false;
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
    const blockAvailable = await this.checkBlockAvailabilityWithTimeout(
      l2BlockNumber,
      (blockNum) => this.isBlockAvailableOnL1(blockNum),
      Date.now,
      (ms) => new Promise(resolve => setTimeout(resolve, ms)),
      timeoutSeconds,
      intervalSeconds
    );

    if (!blockAvailable) {
      throw createL1Error(
        ErrorCode.L1_TIMEOUT,
        `Timeout waiting for block ${l2BlockNumber} to be available on L1`,
        {
          portalAddress: this.address,
          l2BlockNumber: l2BlockNumber.toString(),
          timeoutSeconds,
          intervalSeconds
        }
      );
    }
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
      throw createL1Error(
        ErrorCode.L1_CONTRACT_INTERACTION,
        `Failed to get rollup address from ${this.address}`,
        { portalAddress: this.address },
        error
      );
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
      throw createL1Error(
        ErrorCode.L1_LOG_PARSING,
        `No Deposit logs found in receipt for transaction: ${receipt.transactionHash}`,
        { transactionHash: receipt.transactionHash }
      );
    }

    const log = logs[0];
    if (!log || !log.args) {
      throw createL1Error(
        ErrorCode.L1_LOG_PARSING,
        `Failed to parse Deposit log in receipt for transaction: ${receipt.transactionHash}`,
        { transactionHash: receipt.transactionHash }
      );
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
      throw createL1Error(
        ErrorCode.L1_LOG_PARSING,
        `No Registered logs found in receipt for transaction: ${receipt.transactionHash}`,
        { transactionHash: receipt.transactionHash }
      );
    }

    const log = logs[0];
    if (!log || !log.args) {
      throw createL1Error(
        ErrorCode.L1_LOG_PARSING,
        `Failed to parse Registered log in receipt for transaction: ${receipt.transactionHash}`,
        { transactionHash: receipt.transactionHash }
      );
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
      throw createL1Error(
        ErrorCode.L1_LOG_PARSING,
        `No MessageSent logs found in receipt for transaction: ${receipt.transactionHash}`,
        { transactionHash: receipt.transactionHash }
      );
    }

    const log = logs[0];
    if (!log || !log.args) {
      throw createL1Error(
        ErrorCode.L1_LOG_PARSING,
        `Failed to parse MessageSent log in receipt for transaction: ${receipt.transactionHash}`,
        { transactionHash: receipt.transactionHash }
      );
    }

    return {
      l2BlockNumber: log.args.l2BlockNumber,
      index: log.args.index,
      hash: log.args.hash,
    };
  }
}
