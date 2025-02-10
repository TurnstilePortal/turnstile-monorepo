import {
  decodeFunctionData,
  encodeFunctionData,
  formatUnits,
  getContract,
  parseEventLogs,
} from 'viem';
import type {
  Account,
  Address,
  Chain,
  Client,
  Hex,
  Transport,
  TransactionReceipt,
  WalletClient,
  PublicClient,
  GetContractReturnType,
} from 'viem';

import { SiblingPath, retryUntil } from '@aztec/aztec.js';

import { InboxAbi } from '@aztec/l1-artifacts';
import { ITokenPortalABI } from '@turnstile-portal/l1-artifacts-abi';
import { getERC20Contract } from './l1Token.js';
import { AztecRollup } from '../l1/l1AztecRollup.js';

/**
 * TokenPortal contract instance type
 */
export type L1TokenPortalContract = GetContractReturnType<
  typeof ITokenPortalABI,
  Client,
  Address
>;

/**
 * ABI item for the deposit function
 *
 * TokenPortal.deposit() expects an encoded byte blob with the deposit info.
 * The function prototype: deposit(bytes calldata _data) external returns(bytes32 key)
 * ERC20TokenPortal.sol:_decodeDeposit() shows the expected format of the encoded data:
 * abi.encodeWithSignature("deposit(address,bytes32,uint256)", token, l2Recipient, amount)"
 */
const DEPOSIT_ABI_ITEM = {
  inputs: [
    { name: 'token', type: 'address' },
    { name: 'l2Recipient', type: 'bytes32' },
    { name: 'amount', type: 'uint256' },
  ],
  name: 'deposit',
  stateMutability: 'nonpayable',
  type: 'function',
};

/**
 * L1 Token Portal class
 */
export class L1TokenPortal {
  wc: WalletClient<Transport, Chain, Account>;
  pc: PublicClient;
  portalAddr: Address;
  portal: L1TokenPortalContract | undefined;
  rollup: AztecRollup | undefined;
  allowListAddr: Address | undefined;
  aztecRegistryAddr: Address | undefined;

  /**
   * Constructor
   * @param portalAddr Token portal contract address
   * @param wc Wallet client instance
   * @param pc Public client instance
   */
  constructor(
    portalAddr: Address,
    wc: WalletClient<Transport, Chain, Account>,
    pc: PublicClient,
    rollupAddr?: Address,
  ) {
    this.wc = wc;
    this.pc = pc;
    this.portalAddr = portalAddr;
    if (rollupAddr) {
      this.rollup = new AztecRollup(pc, rollupAddr);
    }
  }

  /**
   * Get the TokenPortal contract instance
   * @returns TokenPortal contract instance
   */
  async tokenPortal(): Promise<L1TokenPortalContract> {
    if (!this.portal) {
      this.portal = await getContract({
        address: this.portalAddr,
        abi: ITokenPortalABI,
        client: { public: this.pc, wallet: this.wc },
      });
    }
    return this.portal;
  }

  /**
   * Get the AztecRollup instance
   */
  async aztecRollup(): Promise<AztecRollup> {
    if (!this.rollup) {
      const portal = await this.tokenPortal();
      const rollupAddr = await portal.read.aztecRollup();
      this.rollup = new AztecRollup(this.pc, rollupAddr);
    }
    return this.rollup;
  }

  /**
   * Set the L2 portal address in the L1 portal
   * @param l2Portal L2 portal address
   * @returns TransactionReceipt
   */
  async setL2Portal(l2Portal: Hex): Promise<TransactionReceipt> {
    const portal = await this.tokenPortal();
    console.debug(`Setting L2 portal to ${l2Portal}`);
    const hash = await portal.write.setL2Portal([l2Portal], {
      account: this.wc.account,
      chain: this.wc.chain,
    });
    console.debug(`setL2Portal(${l2Portal}) tx hash:`, hash);
    const receipt = await this.pc.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') {
      throw new Error(`setL2Portal() failed: ${receipt}`);
    }
    return receipt;
  }

  /**
   * Deposit tokens to Aztec
   * @param tokenAddr ERC20 contract address
   * @param l2RecipientAddr L2 recipient address
   * @param amount Amount to deposit
   * @returns Transaction receipt
   */
  async deposit(
    tokenAddr: Address,
    l2RecipientAddr: string,
    amount: bigint,
  ): Promise<TransactionReceipt> {
    const portal = await this.tokenPortal();
    const token = await getERC20Contract(tokenAddr, this.pc);
    const symbol = await token.read.symbol();
    const amountFmt = formatUnits(amount, await token.read.decimals());
    console.debug(
      `Depositing ${amount} (${amountFmt}) ${token.address} (${symbol}) to Aztec for recipient ${l2RecipientAddr}`,
    );

    const encoded = L1TokenPortal.encodeDepositData(
      tokenAddr,
      l2RecipientAddr,
      amount,
    );

    const hash = await portal.write.deposit([encoded], {
      account: this.wc.account,
      chain: this.wc.chain,
    });
    console.debug(`deposit(${encoded}) tx hash:`, hash);
    const receipt = await this.pc.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') {
      throw new Error(`deposit() failed: ${receipt}`);
    }

    return receipt;
  }

  /**
   * Register token with the portal
   * @param tokenAddr ERC20 contract address
   * @returns Transaction receipt
   */
  async register(tokenAddr: Address): Promise<TransactionReceipt> {
    const portal = await this.tokenPortal();
    console.debug(`Registering token ${tokenAddr} with portal`);
    const hash = await portal.write.register([tokenAddr], {
      account: this.wc.account,
      chain: this.wc.chain,
    });
    console.debug(`register(${tokenAddr}) tx hash:`, hash);
    const receipt = await this.pc.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') {
      throw new Error(`register() failed: ${receipt}`);
    }

    return receipt;
  }

  /**
   * Withdraw tokens from the portal
   * @param leaf L2ToL1 leaf (aka message hash), returned from AztecTokenPortal.withdrawPublic()
   * @param l2BlockNumber L2 block number of the message
   * @param leafIndex Leaf index of the message, returned from node.getL2ToL1MessageMembershipWitness()
   * @param siblingPath Sibling path, also returned from node.getL2ToL1MessageMembershipWitness()
   * @returns Transaction hash
   */
  async withdraw(
    leaf: `0x${string}`,
    l2BlockNumber: bigint,
    leafIndex: bigint,
    siblingPath: SiblingPath<number>,
  ) {
    const portal = await this.tokenPortal();
    console.debug(
      `Withdrawing from portal with msgHash ${leaf}, l2BlockNumber ${l2BlockNumber}, leafIndex ${leafIndex}, siblingPath ${siblingPath}`,
    );

    const siblingPathHex = siblingPath
      .toBufferArray()
      .map(
        (buf: Buffer) => `0x${buf.toString('hex')}`,
      ) as readonly `0x${string}`[];

    const tx = await portal.write.withdraw(
      [leaf, l2BlockNumber, leafIndex, siblingPathHex],
      { account: this.wc.account, chain: this.wc.chain },
    );
    console.debug(`withdraw() tx hash:`, tx);
    return tx;
  }

  /**
   * Get the allowList address
   * @returns AllowList address
   */
  async allowList(): Promise<Address> {
    if (!this.allowListAddr) {
      const portal = await this.tokenPortal();
      this.allowListAddr = await portal.read.allowList();
    }
    return this.allowListAddr;
  }

  /**
   * Get the Aztec registry address
   * @returns Aztec registry address
   */
  async aztecRegistry(): Promise<Address> {
    if (!this.aztecRegistryAddr) {
      const portal = await this.tokenPortal();
      this.aztecRegistryAddr = await portal.read.aztecRegistry();
    }
    return this.aztecRegistryAddr;
  }

  /**
   * Check if messages are available for the given L2 block number
   * @param l2BlockNumber L2 block number
   * @returns True if messages for the block are available, false otherwise
   */
  async aztecBlockAvailableOnL1(l2BlockNumber: bigint) {
    const rollup = await this.aztecRollup();
    const { provenL2BlockNumber } = await rollup.getChainTips();

    return l2BlockNumber <= provenL2BlockNumber;
  }

  /**
   * Wait for the given Aztec block to be proven on L1
   * @param l2BlockNumber L2 block number
   * @param timeoutSeconds Timeout in seconds
   * @param intervalSeconds Polling interval in seconds
   */
  async waitForAztecBlockOnL1(
    l2BlockNumber: bigint,
    timeoutSeconds = 60,
    intervalSeconds = 5,
  ) {
    await retryUntil(
      () => this.aztecBlockAvailableOnL1(l2BlockNumber),
      `Waiting for Aztec block ${l2BlockNumber} to be proven on L1`,
      timeoutSeconds,
      intervalSeconds,
    );
  }

  /**
   * Parse the Deposit log from a transaction receipt
   * @param receipt Transaction receipt
   * @returns Deposit log
   * @throws Error if no Deposit logs are found
   * @throws Error if multiple Deposit logs are found
   * @throws Error if the log cannot be parsed
   */
  static parseDepositLog(receipt: TransactionReceipt) {
    const logs = parseEventLogs({
      abi: ITokenPortalABI,
      eventName: 'Deposit',
      logs: receipt.logs,
    });

    if (logs.length === 0) {
      throw new Error(
        `No Deposit logs found in receipt for transaction: ${receipt.transactionHash}`,
      );
    } else if (logs.length > 1) {
      console.warn(
        `Multiple Deposit logs found in receipt for transaction: ${receipt.transactionHash}. Only returning the first one.`,
      );
    }
    const log = logs[0];
  
    if (!log) {
      throw new Error(
        `Failed to parse Deposit log in receipt for transaction: ${receipt.transactionHash}`,
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
   * Parse the Register log from a transaction receipt
   * @param receipt Transaction receipt
   * @returns Register log
   * @throws Error if no Register logs are found
   * @throws Error if multiple Register logs are found
   * @throws Error if the log cannot be parsed
   */
  static parseRegisterLog(receipt: TransactionReceipt) {
    const logs = parseEventLogs({
      abi: ITokenPortalABI,
      eventName: 'Registered',
      logs: receipt.logs,
    });
    if (logs.length === 0) {
      throw new Error(
        `No Registered logs found in receipt for transaction: ${receipt.transactionHash}`,
      );
    } else if (logs.length > 1) {
      console.warn(
        `Multiple Registered logs found in receipt for transaction: ${receipt.transactionHash}. Only returning the first one.`,
      );
    }

    const log = logs[0];
    if (!log) {
      throw new Error(
        `Failed to parse Registered log in receipt for transaction: ${receipt.transactionHash}`,
      );
    }

    return {
      token: log.args.token,
      hash: log.args.leaf,
      index: log.args.index,
    };
  }

  /**
   * Parse the MessageSent log from a transaction receipt.
   * This is used to get the L2 block number and message index for the deposit.
   * The message is emitted by the Aztec Inbox contract.
   *
   * @param receipt Transaction receipt
   * @returns MessageSent log
   * @throws Error if no MessageSent logs are found
   * @throws Error if multiple MessageSent logs are found
   * @throws Error if the log cannot be parsed
   */
  static parseMessageSentLog(receipt: TransactionReceipt) {
    const logs = parseEventLogs({
      abi: InboxAbi,
      eventName: 'MessageSent',
      logs: receipt.logs,
    });
    if (logs.length === 0) {
      throw new Error(
        `No MessageSent logs found in receipt for transaction: ${receipt.transactionHash}`,
      );
    } else if (logs.length > 1) {
      console.warn(
        `Multiple MessageSent logs found in receipt for transaction: ${receipt.transactionHash}. Only returning the first one.`,
      );
    }
    
    const log = logs[0];
    if (!log) {
      throw new Error(
        `Failed to parse MessageSent log in receipt for transaction: ${receipt.transactionHash}`,
      );
    }

    return {
      l2BlockNumber: log.args.l2BlockNumber,
      index: log.args.index,
      hash: log.args.hash,
    };
  }

  /**
   * Encode the deposit data for the deposit function
   * @param tokenAddr ERC20 contract address
   * @param l2RecipientAddr L2 recipient address
   * @param amount Amount to deposit
   * @returns Encoded deposit data
   */
  static encodeDepositData(
    tokenAddr: string,
    l2RecipientAddr: string,
    amount: bigint,
  ) {
    const args = [tokenAddr, l2RecipientAddr, amount];

    const encoded = encodeFunctionData({
      abi: [DEPOSIT_ABI_ITEM],
      functionName: 'deposit',
      args,
    });

    return encoded;
  }

  /**
   * Decode the deposit data from the encoded data
   * @param encoded Encoded deposit data
   * @returns Decoded deposit data
   */
  static decodeDepositData(encoded: `0x${string}`): {
    token: string;
    l2Recipient: string;
    amount: bigint;
  } {
    const decoded = decodeFunctionData({
      abi: [DEPOSIT_ABI_ITEM],
      data: encoded,
    });
    if (decoded.functionName != 'deposit' || !decoded.args) {
      throw new Error(`Failed to decode deposit data: ${encoded}`);
    }

    return {
      token: decoded.args[0] as string,
      l2Recipient: decoded.args[1] as string,
      amount: BigInt(decoded.args[2] as string),
    };
  }
}
