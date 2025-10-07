import { ERC20TokenPortalABI } from '@turnstile-portal/l1-artifacts-abi';
import { InboxAbi } from '@aztec/l1-artifacts';
import {
  encodeFunctionData,
  parseEventLogs,
  type Address,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
} from 'viem';
import { createError, ErrorCode } from '../errors.js';
import type { Hex as TurnstileHex } from '../types.js';
import { poll } from '../utils/poll.js';

const DEPOSIT_FUNCTION_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'l2Recipient', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

export type PrepareDepositParams = {
  l1PublicClient: PublicClient;
  portalAddress: Address;
  tokenAddress: Address;
  amount: bigint;
  l2Recipient: TurnstileHex;
};

export type PreparedDeposit = {
  /** Encoded calldata to submit to the ERC20 token portal. */
  calldata: Hex;
  /** Transaction request that can be handed to viem wallet clients. */
  request: { to: Address; data: Hex; value: bigint };
  /** Indicates whether the token is already registered with the portal. */
  tokenRegistered: boolean;
};

export async function prepareDeposit({
  l1PublicClient,
  portalAddress,
  tokenAddress,
  amount,
  l2Recipient,
}: PrepareDepositParams): Promise<PreparedDeposit> {
  if (amount <= 0n) {
    throw createError(ErrorCode.VALIDATION_AMOUNT, 'Deposit amount must be greater than zero', {
      amount: amount.toString(),
    });
  }

  const calldata = encodeFunctionData({
    abi: DEPOSIT_FUNCTION_ABI,
    functionName: 'deposit',
    args: [tokenAddress, l2Recipient as Hex, amount],
  });

  let tokenRegistered = false;
  try {
    tokenRegistered = await l1PublicClient.readContract({
      address: portalAddress,
      abi: ERC20TokenPortalABI,
      functionName: 'registered',
      args: [tokenAddress],
    });
  } catch (error) {
    throw createError(
      ErrorCode.L1_CONTRACT_INTERACTION,
      `Failed to query registration status for token ${tokenAddress}`,
      { portalAddress, tokenAddress },
      error,
    );
  }

  return {
    calldata,
    request: { to: portalAddress, data: calldata, value: 0n },
    tokenRegistered,
  };
}

export type DepositReceipt = {
  messageHash: TurnstileHex;
  messageIndex: bigint;
  l2BlockNumber: number;
};

export function parseDepositReceipt(receipt: TransactionReceipt): DepositReceipt {
  const depositLogs = parseEventLogs({
    abi: ERC20TokenPortalABI,
    eventName: 'Deposit',
    logs: receipt.logs,
  });

  if (!depositLogs.length || !depositLogs[0]?.args) {
    throw createError(
      ErrorCode.L1_LOG_PARSING,
      `No Deposit event found in receipt for transaction ${receipt.transactionHash}`,
      { transactionHash: receipt.transactionHash },
    );
  }

  const messageLogs = parseEventLogs({
    abi: InboxAbi,
    eventName: 'MessageSent',
    logs: receipt.logs,
  });

  if (!messageLogs.length || !messageLogs[0]?.args) {
    throw createError(
      ErrorCode.L1_LOG_PARSING,
      `No MessageSent event found in receipt for transaction ${receipt.transactionHash}`,
      { transactionHash: receipt.transactionHash },
    );
  }

  const depositLog = depositLogs[0];
  const messageLog = messageLogs[0];

  return {
    messageHash: depositLog.args.leaf as TurnstileHex,
    messageIndex: depositLog.args.index,
    l2BlockNumber: Number(messageLog.args?.l2BlockNumber ?? 0),
  };
}

export type FinalizeDepositParams<Status> = {
  /** Client capable of retrieving message status from an Aztec node or PXE. */
  messageClient: {
    getL1ToL2MessageStatus: (messageHash: TurnstileHex) => Promise<Status>;
  };
  /** Hash of the L1-to-L2 message emitted from the deposit transaction. */
  messageHash: TurnstileHex;
  /** Function that determines if the returned status represents a finalized deposit. */
  isFinalized: (status: Status) => boolean;
  /** Optional timeout in milliseconds. Defaults to 10 minutes. */
  timeoutMs?: number;
  /** Optional polling interval in milliseconds. Defaults to 5 seconds. */
  pollIntervalMs?: number;
};

export async function finalizeDeposit<Status>({
  messageClient,
  messageHash,
  isFinalized,
  timeoutMs = 10 * 60 * 1000,
  pollIntervalMs = 5_000,
}: FinalizeDepositParams<Status>): Promise<Status> {
  try {
    return await poll({
      action: () => messageClient.getL1ToL2MessageStatus(messageHash),
      check: (status) => isFinalized(status),
      timeoutMs,
      intervalMs: pollIntervalMs,
      onTimeout: () =>
        createError(ErrorCode.BRIDGE_MESSAGE, `Timed out waiting for message ${messageHash} to finalize`, {
          messageHash,
          timeoutMs,
        }),
    });
  } catch (error) {
    throw createError(
      ErrorCode.BRIDGE_MESSAGE,
      `Failed to finalize deposit for message ${messageHash}`,
      { messageHash },
      error,
    );
  }
}
