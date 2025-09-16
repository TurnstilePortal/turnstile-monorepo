import { InboxAbi } from '@aztec/l1-artifacts/InboxAbi';
import type { NewToken } from '@turnstile-portal/api-common/schema';
import { IAllowListABI, ITokenPortalABI } from '@turnstile-portal/l1-artifacts-abi';
import { createPublicClient, getAbiItem, http, type PublicClient } from 'viem';
import { anvil, mainnet, sepolia } from 'viem/chains';
import { getDatabase } from '../db.js';
import { MetadataService } from '../services/metadata.js';
import { normalizeL1Address } from '../utils/address.js';
import { allowListStatusNumberToString } from '../utils/l1.js';
import { logger } from '../utils/logger.js';

const MESSAGE_SENT_EVENT = getAbiItem({ abi: InboxAbi, name: 'MessageSent' });
const REGISTERED_EVENT = getAbiItem({ abi: ITokenPortalABI, name: 'Registered' });
const ALLOW_LIST_STATUS_UPDATED_EVENT = getAbiItem({ abi: IAllowListABI, name: 'StatusUpdated' });

// Helper function to get chain by network name
function getChainByNetwork(network: string) {
  switch (network) {
    case 'mainnet':
      return mainnet;
    case 'sepolia':
    case 'testnet':
      return sepolia;
    case 'sandbox':
      return anvil;
    default:
      logger.warn(`Unknown network "${network}", using undefined`);
      return undefined;
  }
}

export interface L1CollectorConfig {
  rpcUrl: string;
  portalAddress: `0x${string}`;
  allowListAddress: `0x${string}`;
  inboxAddress: `0x${string}`;
  startBlock?: number;
  chunkSize?: number;
  network: string;
}

export class L1Collector {
  private publicClient: PublicClient;
  private config: Required<L1CollectorConfig>;
  private metadataService: MetadataService;

  constructor(config: L1CollectorConfig) {
    this.config = {
      startBlock: 0,
      chunkSize: 1000,
      ...config,
    };

    const chain = getChainByNetwork(this.config.network);
    this.publicClient = createPublicClient({
      chain,
      transport: http(this.config.rpcUrl),
    });

    this.metadataService = new MetadataService(this.publicClient, getDatabase());
  }

  async getL1TokenAllowListEvents(fromBlock: number, toBlock: number): Promise<NewToken[]> {
    logger.debug(`Scanning L1 blocks ${fromBlock} to ${toBlock} for Proposed events`);

    const allowListLogs = await this.publicClient.getLogs({
      address: this.config.allowListAddress,
      event: ALLOW_LIST_STATUS_UPDATED_EVENT,
      fromBlock: BigInt(fromBlock),
      toBlock: BigInt(toBlock),
    });

    const allowListTokens: NewToken[] = [];

    for (const log of allowListLogs) {
      if (log.eventName !== 'StatusUpdated' || !log.args.addr || !log.args.status) {
        logger.warn(
          { transactionHash: log.transactionHash, args: log.args },
          'Skipping invalid allowList StatusUpdated log',
        );
        continue;
      }

      const statusStr = allowListStatusNumberToString(Number(log.args.status));
      const isResolution = statusStr === 'ACCEPTED' || statusStr === 'REJECTED';

      const l1Address = normalizeL1Address(log.args.addr);
      await this.metadataService.ensureTokenMetadata(l1Address);

      const proposer = !isResolution
        ? await this.publicClient.getTransactionReceipt({ hash: log.transactionHash }).then((r) => r.from)
        : undefined;
      const approver = isResolution
        ? await this.publicClient.getTransactionReceipt({ hash: log.transactionHash }).then((r) => r.from)
        : undefined;

      const token: NewToken = {
        l1AllowListStatus: statusStr,
        l1AllowListProposalTx: isResolution ? undefined : log.transactionHash,
        l1AllowListProposer: proposer,
        l1AllowListResolutionTx: isResolution ? log.transactionHash : undefined,
        l1AllowListApprover: approver,
        l1Address,
      };

      allowListTokens.push(token);
    }

    return allowListTokens;
  }

  async getL1TokenRegistrations(fromBlock: number, toBlock: number): Promise<NewToken[]> {
    logger.debug(`Scanning L1 blocks ${fromBlock} to ${toBlock} for Registered events`);

    const portalLogsPromise = this.publicClient.getLogs({
      address: this.config.portalAddress,
      event: REGISTERED_EVENT,
      fromBlock: BigInt(fromBlock),
      toBlock: BigInt(toBlock),
    });

    const inboxLogsPromise = this.publicClient.getLogs({
      address: this.config.inboxAddress,
      event: MESSAGE_SENT_EVENT,
      fromBlock: BigInt(fromBlock),
      toBlock: BigInt(toBlock),
    });

    const [portalLogs, inboxLogs] = await Promise.all([portalLogsPromise, inboxLogsPromise]);

    const inboxLogsByTxHash = new Map<string, (typeof inboxLogs)[0]>();
    for (const inboxLog of inboxLogs) {
      inboxLogsByTxHash.set(inboxLog.transactionHash, inboxLog);
    }

    const registrations: NewToken[] = [];

    for (const portalLog of portalLogs) {
      const correlatedInboxLog = inboxLogsByTxHash.get(portalLog.transactionHash);

      if (!correlatedInboxLog) {
        logger.warn(`No correlated inbox log found for portal registration in tx ${portalLog.transactionHash}`);
        continue;
      }

      if (portalLog.eventName !== 'Registered' || !portalLog.args.token) {
        continue;
      }

      const tokenAddress = portalLog.args.token;
      const l1Address = normalizeL1Address(tokenAddress);
      await this.metadataService.ensureTokenMetadata(l1Address);

      const reg: NewToken = {
        l1Address,
        l1RegistrationBlock: Number(portalLog.blockNumber),
        l1RegistrationTx: portalLog.transactionHash,
        l1RegistrationSubmitter: await this.publicClient
          .getTransactionReceipt({ hash: portalLog.transactionHash })
          .then((r) => r.from),
        l2RegistrationAvailableBlock: Number(correlatedInboxLog.args.l2BlockNumber),
      };

      registrations.push(reg);
    }

    return registrations;
  }

  async getBlockNumber(): Promise<number> {
    return Number(await this.publicClient.getBlockNumber());
  }
}
