import { normalizeL1Address, normalizeL2Address } from '../utils/address.js';

// L2 Portal events (from Aztec)
export interface L1RegisteredEvent {
  tokenAddress: string;
  leaf: string;
  index: bigint;
  blockNumber: number;
  transactionHash: string;
}

export interface L2RegisterEvent {
  ethToken: string;
  aztecToken: string;
  blockNumber: number;
  transactionHash: string;
}

// Ethereum log structure from ethers.js
export interface EthereumLog {
  args: {
    token: string;
    leaf: string;
    index: bigint;
  };
  blockNumber: number;
  transactionHash: string;
}

// Aztec log structure (flexible format based on Portal contract)
export interface AztecLog {
  data?: string[];
  fields?: string[];
  eth_token?: string;
  aztec_token?: string;
  blockNumber?: number;
  block_number?: number;
  txHash?: string;
  transaction_hash?: string;
  transactionHash?: string;
}

/**
 * Decode L1 Registered event from ERC20TokenPortal
 */
export function decodeL1RegisteredEvent(log: EthereumLog): L1RegisteredEvent {
  try {
    return {
      tokenAddress: normalizeL1Address(log.args.token),
      leaf: log.args.leaf,
      index: log.args.index,
      blockNumber: Number(log.blockNumber),
      transactionHash: log.transactionHash,
    };
  } catch (error) {
    throw new Error(`Failed to decode L1 Registered event: ${error}`);
  }
}

/**
 * Decode L2 Register event from Aztec Portal
 */
export function decodeL2RegisterEvent(log: AztecLog): L2RegisterEvent {
  try {
    // Aztec log structure may vary - this is based on the Portal contract
    // The Register event contains: { eth_token: EthAddress, aztec_token: AztecAddress }

    // Extract data from log fields (structure may need adjustment based on actual Aztec log format)
    const ethToken = log.data?.[0] || log.fields?.[0] || log.eth_token;
    const aztecToken = log.data?.[1] || log.fields?.[1] || log.aztec_token;
    const blockNumber = log.blockNumber || log.block_number;
    const transactionHash = log.txHash || log.transaction_hash || log.transactionHash;

    if (!ethToken || !aztecToken) {
      throw new Error('Missing required fields in L2 Register event');
    }

    if (!blockNumber) {
      throw new Error('Missing block number in L2 Register event');
    }

    if (!transactionHash) {
      throw new Error('Missing transaction hash in L2 Register event');
    }

    return {
      ethToken: normalizeL1Address(ethToken),
      aztecToken: normalizeL2Address(aztecToken),
      blockNumber: Number(blockNumber),
      transactionHash,
    };
  } catch (error) {
    throw new Error(`Failed to decode L2 Register event: ${error}`);
  }
}

/**
 * Validate L1 event structure
 */
export function isValidL1RegisteredEvent(log: unknown): log is EthereumLog {
  const l = log as Partial<EthereumLog>;
  return !!(l?.args?.token && l.args.leaf && l.args.index !== undefined && l.blockNumber && l.transactionHash);
}

/**
 * Validate L2 event structure
 */
export function isValidL2RegisterEvent(log: unknown): log is AztecLog {
  const l = log as Partial<AztecLog>;
  const ethToken = l?.data?.[0] || l?.fields?.[0] || l?.eth_token;
  const aztecToken = l?.data?.[1] || l?.fields?.[1] || l?.aztec_token;
  const blockNumber = l?.blockNumber || l?.block_number;
  const txHash = l?.txHash || l?.transaction_hash || l?.transactionHash;

  return !!(ethToken && aztecToken && blockNumber && txHash);
}

// Event type constants for job processing
export const EventTypes = {
  L1_REGISTERED: 'l1_registered',
  L2_REGISTER: 'l2_register',
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];

// Generic event interface
export interface DecodedEvent {
  type: EventType;
  data: L1RegisteredEvent | L2RegisterEvent;
  raw: EthereumLog | AztecLog;
}
