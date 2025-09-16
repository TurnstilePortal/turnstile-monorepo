import { L1Collector } from '../collectors/l1.js';
import { L2Collector } from '../collectors/l2.js';
import { storeL1TokenAllowListEvents, storeL1TokenRegistrations, storeL2TokenRegistrations } from '../db.js';
import { logger } from '../utils/logger.js';
import { BlockProgressService } from './block-progress.js';

export interface CollectorServiceConfig {
  l1: ConstructorParameters<typeof L1Collector>[0];
  l2: ConstructorParameters<typeof L2Collector>[0];
  pollingInterval?: number;
}

interface ResolvedCollectorServiceConfig {
  l1: ConstructorParameters<typeof L1Collector>[0] & {
    startBlock: number;
    chunkSize: number;
  };
  l2: ConstructorParameters<typeof L2Collector>[0] & {
    startBlock: number;
    chunkSize: number;
  };
  pollingInterval: number;
}

export class CollectorService {
  private l1Collector: L1Collector;
  private l2Collector: L2Collector;
  private blockProgress = new BlockProgressService();
  private pollingInterval: number;
  private config: ResolvedCollectorServiceConfig;
  private forceL1StartBlock?: number;
  private forceL2StartBlock?: number;
  private isBackfillMode = false;

  constructor(config: CollectorServiceConfig) {
    this.config = {
      l1: {
        ...config.l1,
        startBlock: config.l1.startBlock ?? 0,
        chunkSize: config.l1.chunkSize ?? 1000,
      },
      l2: {
        ...config.l2,
        startBlock: config.l2.startBlock ?? 1,
        chunkSize: config.l2.chunkSize ?? 100,
        l1RpcUrl: config.l1.rpcUrl,
        network: config.l1.network,
      },
      pollingInterval: config.pollingInterval ?? 30000,
    };
    this.l1Collector = new L1Collector(this.config.l1);
    this.l2Collector = new L2Collector(this.config.l2);
    this.pollingInterval = this.config.pollingInterval;

    // Check for force start block environment variables
    const forceL1 = process.env.FORCE_L1_START_BLOCK;
    const forceL2 = process.env.FORCE_L2_START_BLOCK;

    if (forceL1) {
      this.forceL1StartBlock = Number.parseInt(forceL1, 10);
      if (Number.isNaN(this.forceL1StartBlock)) {
        throw new Error(`Invalid FORCE_L1_START_BLOCK value: ${forceL1}`);
      }
      logger.info(`Backfill mode enabled for L1: forcing start from block ${this.forceL1StartBlock}`);
      this.isBackfillMode = true;
    }

    if (forceL2) {
      this.forceL2StartBlock = Number.parseInt(forceL2, 10);
      if (Number.isNaN(this.forceL2StartBlock)) {
        throw new Error(`Invalid FORCE_L2_START_BLOCK value: ${forceL2}`);
      }
      logger.info(`Backfill mode enabled for L2: forcing start from block ${this.forceL2StartBlock}`);
      this.isBackfillMode = true;
    }

    if (this.isBackfillMode) {
      logger.info('Running in backfill mode - will exit when caught up with blockchain');
    }
  }

  async start() {
    logger.info('Starting CollectorService...');

    // Main polling loop
    while (true) {
      try {
        // Fetch and store L1 and L2 registrations
        const isCaughtUp = await this.poll();

        // In backfill mode, exit when caught up
        if (this.isBackfillMode && isCaughtUp) {
          logger.info('Backfill complete - caught up with blockchain. Exiting.');
          process.exit(0);
        }

        // Only wait if we're caught up with both chains
        if (isCaughtUp) {
          logger.info(`Caught up with both chains. Waiting ${this.pollingInterval}ms before next poll...`);
          await new Promise((resolve) => setTimeout(resolve, this.pollingInterval));
        } else {
          logger.info('Still catching up, polling again immediately...');
        }
      } catch (error) {
        logger.error(error, 'CollectorService encountered an error');
        // Always wait after an error to avoid rapid retry loops
        await new Promise((resolve) => setTimeout(resolve, this.pollingInterval));
      }
    }
  }

  public async poll(): Promise<boolean> {
    logger.debug('Polling for new data...');

    const [lastScannedL1Block, lastScannedL2Block] = await Promise.all([
      this.blockProgress.getLastScannedBlock('L1'),
      this.blockProgress.getLastScannedBlock('L2'),
    ]);

    // Use forced start blocks if provided, otherwise use normal logic
    let fromL1Block: number;
    if (this.forceL1StartBlock !== undefined) {
      fromL1Block = this.forceL1StartBlock;
      // Clear the force after first use to continue normally
      this.forceL1StartBlock = undefined;
      logger.info(`Using forced L1 start block: ${fromL1Block}`);
    } else {
      // Use the configured start block if we haven't scanned any blocks yet
      fromL1Block =
        lastScannedL1Block === 0 && this.config.l1.startBlock ? this.config.l1.startBlock : lastScannedL1Block + 1;
    }

    let fromL2Block: number;
    if (this.forceL2StartBlock !== undefined) {
      fromL2Block = this.forceL2StartBlock;
      // Clear the force after first use to continue normally
      this.forceL2StartBlock = undefined;
      logger.info(`Using forced L2 start block: ${fromL2Block}`);
    } else {
      // L2: Start from lastScannedBlock (not +1) to re-scan the last block and catch any events that may have been missed
      fromL2Block = lastScannedL2Block === 0 ? this.config.l2.startBlock || 1 : lastScannedL2Block;
    }

    const [currentL1Block, currentL2Block] = await Promise.all([
      this.l1Collector.getBlockNumber(),
      this.l2Collector.getBlockNumber(),
    ]);

    const toL1Block = Math.min(fromL1Block + this.config.l1.chunkSize - 1, currentL1Block);
    const toL2Block = Math.min(fromL2Block + this.config.l2.chunkSize - 1, currentL2Block);

    // Track if each chain is caught up
    let l1CaughtUp = fromL1Block > currentL1Block;
    let l2CaughtUp = fromL2Block > currentL2Block;

    // Skip if we're already caught up
    if (l1CaughtUp && l2CaughtUp) {
      logger.debug(`Already caught up - L1: ${currentL1Block}, L2: ${currentL2Block}`);
      return true;
    }

    // Process L1 if there are blocks to scan
    if (!l1CaughtUp) {
      logger.info(`Scanning L1 blocks ${fromL1Block} to ${toL1Block} (current: ${currentL1Block})`);

      // Fetch both allowlist events and registrations in parallel
      const [l1AllowListEvents, l1Registrations] = await Promise.all([
        this.l1Collector.getL1TokenAllowListEvents(fromL1Block, toL1Block),
        this.l1Collector.getL1TokenRegistrations(fromL1Block, toL1Block),
      ]);

      // Store allowlist events first (proposals and resolutions)
      if (l1AllowListEvents.length > 0) {
        logger.info(`Found ${l1AllowListEvents.length} L1 token allowlist events`);
        await storeL1TokenAllowListEvents(l1AllowListEvents);
      }

      // Then store registrations (which have more complete token data)
      if (l1Registrations.length > 0) {
        logger.info(`Found ${l1Registrations.length} L1 token registrations`);
        await storeL1TokenRegistrations(l1Registrations);
      }

      await this.blockProgress.updateLastScannedBlock('L1', toL1Block);

      // Check if L1 is now caught up after this scan
      l1CaughtUp = toL1Block >= currentL1Block;
    }

    // Process L2 if there are blocks to scan
    if (!l2CaughtUp) {
      const isRescanning = fromL2Block === lastScannedL2Block && lastScannedL2Block > 0;
      logger.info(`Scanning L2 blocks ${fromL2Block} to ${toL2Block} (current: ${currentL2Block})`);
      const l2Registrations = await this.l2Collector.getL2TokenRegistrations(fromL2Block, toL2Block);

      if (l2Registrations.length > 0) {
        if (isRescanning) {
          logger.warn(`Found ${l2Registrations.length} L2 token registrations on RESCAN of block ${fromL2Block}`);
        } else {
          logger.info(`Found ${l2Registrations.length} L2 token registrations`);
        }
        await storeL2TokenRegistrations(l2Registrations);
      }

      await this.blockProgress.updateLastScannedBlock('L2', toL2Block);

      // Check if L2 is now caught up after this scan
      l2CaughtUp = toL2Block >= currentL2Block;
    }

    logger.debug(`Polling complete. L1 caught up: ${l1CaughtUp}, L2 caught up: ${l2CaughtUp}`);

    // Return true only if both chains are caught up
    return l1CaughtUp && l2CaughtUp;
  }
}
