import { AztecAddress, EthAddress, Fr, type LogFilter } from '@aztec/aztec.js';

import type { GetPublicLogsResponse } from '@aztec/stdlib/interfaces/client';
import type { LogId } from '@aztec/stdlib/logs';
import { PortalContract } from '@turnstile-portal/aztec-artifacts';
import { decodePublicAztecEvents } from './decode-aztec-events.js';
import { logger } from './logger.js';

export interface RegisterEvent {
  logId: LogId;
  ethToken: EthAddress;
  aztecToken: AztecAddress;
  blockNumber: number;
  txIndex: number;
  logIndex: number;
}

/**
 * Extracts and decodes Register events from Aztec L2 logs
 * @param logs - Raw logs from Aztec node
 * @returns Array of decoded Register events with properly typed addresses
 */
export async function extractRegisterEvents(logs: GetPublicLogsResponse['logs']): Promise<RegisterEvent[]> {
  // Filter logs for Register events by checking the event selector
  const registerLogs = logs.filter((log) => {
    const emittedFields = log.log.getEmittedFields();
    const lastField = emittedFields[emittedFields.length - 1];
    return lastField !== undefined && PortalContract.events.Register.eventSelector.toField().equals(lastField);
  });

  if (registerLogs.length === 0) {
    return [];
  }

  // Decode the events using the Portal contract ABI
  const decodedEvents = await decodePublicAztecEvents<{
    eth_token: { inner: bigint };
    aztec_token: AztecAddress;
  }>(PortalContract.events.Register, registerLogs);

  // Transform decoded events into our clean interface
  return decodedEvents.map((event, index) => {
    const log = registerLogs[index];
    if (!log || !log.id) {
      throw new Error('Log is missing id');
    }

    return {
      logId: log.id,
      ethToken: EthAddress.fromField(new Fr(event.eth_token.inner)),
      aztecToken: event.aztec_token,
      blockNumber: log.id.blockNumber,
      txIndex: log.id.txIndex,
      logIndex: log.id.logIndex,
    };
  });
}

/**
 * Scans for Register events in a given block range
 * @param nodeClient - Aztec node client
 * @param portalAddress - Portal contract address on L2
 * @param fromBlock - Starting block number
 * @param toBlock - Ending block number
 * @returns Array of decoded Register events
 */
export async function scanForRegisterEvents(
  nodeClient: { getPublicLogs: (filter: LogFilter) => Promise<GetPublicLogsResponse> },
  portalAddress: string,
  fromBlock: number,
  toBlock: number,
): Promise<RegisterEvent[]> {
  const filter: LogFilter = {
    fromBlock,
    toBlock,
    contractAddress: AztecAddress.fromString(portalAddress),
  };

  logger.debug({ fromBlock, toBlock, contractAddress: portalAddress }, 'Calling Aztec node getPublicLogs with filter');

  const response = await nodeClient.getPublicLogs(filter);

  logger.debug(`Aztec node returned ${response.logs.length} total logs for portal contract`);

  const registerEvents = await extractRegisterEvents(response.logs);

  logger.debug(`Filtered to ${registerEvents.length} Register events`);

  return registerEvents;
}
