import { AztecAddress, type AztecNode, createAztecNodeClient } from '@aztec/aztec.js';
import type { NewToken } from '@turnstile-portal/api-common/schema';
import { createPublicClient, http } from 'viem';
import { anvil, mainnet, sepolia } from 'viem/chains';
import { getDatabase } from '../db.js';
import { ContractRegistryService } from '../services/contract-registry.js';
import { MetadataService } from '../services/metadata.js';
import { normalizeL1Address, normalizeL2Address } from '../utils/address.js';
import { logger } from '../utils/logger.js';
import { scanForRegisterEvents } from '../utils/portal-events.js';

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

export interface L2CollectorConfig {
  nodeUrl: string;
  portalAddress: string;
  startBlock?: number;
  chunkSize?: number;
  l1RpcUrl: string;
  network: string;
  artifactsApiUrl?: string;
}

export class L2Collector {
  private aztecNode: AztecNode;
  private config: Required<L2CollectorConfig>;
  private metadataService: MetadataService;
  private contractRegistryService: ContractRegistryService;

  constructor(config: L2CollectorConfig) {
    this.config = {
      startBlock: 1,
      chunkSize: 100,
      artifactsApiUrl: '',
      ...config,
    };

    this.aztecNode = createAztecNodeClient(this.config.nodeUrl);

    // Create L1 client for metadata service
    const chain = getChainByNetwork(this.config.network);
    const l1Client = createPublicClient({
      chain,
      transport: http(this.config.l1RpcUrl),
    });

    this.metadataService = new MetadataService(l1Client, getDatabase());
    this.contractRegistryService = new ContractRegistryService(config.artifactsApiUrl);
  }

  async getL2TokenRegistrations(fromBlock: number, toBlock: number): Promise<Partial<NewToken>[]> {
    logger.debug(`Scanning L2 blocks ${fromBlock} to ${toBlock} for Register events`);
    logger.debug(`  Portal address: ${this.config.portalAddress}`);
    logger.debug(`  Node URL: ${this.config.nodeUrl}`);

    const events = await scanForRegisterEvents(this.aztecNode, this.config.portalAddress, fromBlock, toBlock);
    logger.debug(`  Raw events returned: ${events.length}`);

    if (events.length === 0) {
      logger.debug(`  No Register events found in L2 blocks ${fromBlock}-${toBlock}`);
    } else {
      logger.debug(
        `  Found ${events.length} Register event(s) at blocks: ${events.map((e) => e.blockNumber).join(', ')}`,
      );
    }

    const registrations: Partial<NewToken>[] = [];

    for (const event of events) {
      const block = await this.aztecNode.getBlock(event.blockNumber);
      if (!block) {
        throw new Error(`L2 Block ${event.blockNumber} not found`);
      }
      const txEffect = block.body.txEffects[event.txIndex];
      if (!txEffect) {
        throw new Error(`L2 Tx index ${event.txIndex} not found in block ${event.blockNumber}`);
      }
      const txHash = txEffect.txHash;

      // TODO: Figure out how to get fee payer & msg sender.
      // getTxByHash doesn't work because it only return the tx for non-mined txs.
      // const tx = await this.aztecNode.getTxByHash(txHash);

      // if (!tx) {
      //   throw new Error(`L2 Tx ${txHash.toString()} not found`);
      // }
      // const publicInputs = tx.data.forPublic;
      // if (!publicInputs) {
      //   throw new Error(`L2 Tx ${txHash.toString()} has no public data`);
      // }
      // const msgSender = publicInputs.publicTeardownCallRequest.msgSender;

      const l1Address = normalizeL1Address(event.ethToken.toString());
      const l2Address = normalizeL2Address(event.aztecToken.toString());

      logger.debug(
        `  Processing registration: L1=${l1Address}, L2=${l2Address}, Block=${event.blockNumber}, TxIndex=${event.txIndex}`,
      );

      // Ensure token metadata exists before storing L2 registration
      await this.metadataService.ensureTokenMetadata(l1Address);

      // Get token metadata for contract instance creation
      const metadata = await this.metadataService.getTokenMetadata(l1Address);

      if (metadata) {
        // Store contract instance for this token
        try {
          await this.contractRegistryService.storeTokenInstance(
            AztecAddress.fromString(l2Address),
            AztecAddress.fromString(this.config.portalAddress),
            metadata,
          );
        } catch (error) {
          logger.warn({ error, l1Address, l2Address }, 'Failed to store contract instance for token registration');
          // Continue processing even if contract instance storage fails
        }
      } else {
        logger.warn({ l1Address, l2Address }, 'Token metadata not available, skipping contract instance creation');
      }

      registrations.push({
        l1Address,
        l2Address,
        l2RegistrationBlock: event.blockNumber,
        l2RegistrationTxIndex: event.txIndex,
        l2RegistrationLogIndex: event.logIndex,
        l2RegistrationTx: txHash.toString(),
      });
    }

    if (registrations.length > 0) {
      logger.debug(`Found ${registrations.length} L2 token registration(s)`);
    }

    return registrations;
  }

  async getBlockNumber(): Promise<number> {
    return this.aztecNode.getBlockNumber();
  }
}
