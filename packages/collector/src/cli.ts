import { resolve } from 'node:path';
import { program } from 'commander';
import { config } from 'dotenv';
import { L1Collector } from './collectors/l1.js';
import { L2Collector } from './collectors/l2.js';
import { getNetworkConfig } from './config/networks.js';
import { logger } from './utils/logger.js';

// Load environment variables from the collector package's .env file
const envPath = resolve(process.cwd(), process.cwd().endsWith('collector') ? '.env' : 'packages/collector/.env');
config({ path: envPath });

interface CLIOptions {
  l1DryRun?: boolean;
  l2DryRun?: boolean;
  fromBlock?: string;
  toBlock?: string;
  verbose?: boolean;
  network?: string;
  forceL1StartBlock?: string;
  forceL2StartBlock?: string;
  apiClientUrl?: string;
}

program
  .name('collector-cli')
  .description('Run L1/L2 collectors in dry-run mode')
  .version('1.0.0')
  .option('--l1-dry-run', 'Run L1 collector in dry-run mode')
  .option('--l2-dry-run', 'Run L2 collector in dry-run mode')
  .option('--from-block <number>', 'Starting block number')
  .option('--to-block <number>', 'Ending block number')
  .option('--network <name>', 'Network to use (e.g., sepolia)')
  .option('--force-l1-start-block <number>', 'Force L1 collector to start from this block (backfill mode)')
  .option('--force-l2-start-block <number>', 'Force L2 collector to start from this block (backfill mode)')
  .option('-u, --url <url>', 'Aztec Artifacts API URL')
  .option('-v, --verbose', 'Verbose output')
  .parse();

const options = program.opts<CLIOptions>();

async function runL1DryRun(fromBlock?: number, toBlock?: number): Promise<void> {
  console.log('\n🔍 Running L1 Collector Dry-Run');
  console.log('==============================');

  const config = await getNetworkConfig();

  console.log(`Network: ${config.name}`);
  console.log(`L1 RPC: ${config.l1.rpcUrl}`);
  console.log(`Portal Address: ${config.l1.portalAddress}`);
  console.log(`L1 Allow List Address: ${config.l1.allowListAddress}`);

  const l1Collector = new L1Collector({
    rpcUrl: config.l1.rpcUrl,
    portalAddress: config.l1.portalAddress as `0x${string}`,
    inboxAddress: config.l1.inboxAddress as `0x${string}`,
    allowListAddress: config.l1.allowListAddress as `0x${string}`,
    startBlock: config.l1.startBlock,
    chunkSize: config.l1.chunkSize,
    network: config.l1.network,
  });

  try {
    const startBlock = fromBlock || config.l1.startBlock;
    const endBlock = toBlock || startBlock + 100; // Default to 100 blocks

    console.log(`\n📦 Scanning blocks ${startBlock} to ${endBlock}...`);

    const startTime = Date.now();
    const registrations = await l1Collector.getL1TokenRegistrations(startBlock, endBlock);
    const duration = Date.now() - startTime;

    console.log(`✅ L1 dry-run scan completed in ${duration}ms`);

    if (registrations.length > 0) {
      console.log(`\n🪙 Found ${registrations.length} L1 token registration(s):`);
      console.log(JSON.stringify(registrations, null, 2));
    } else {
      console.log('\n📭 No L1 token registrations found in the specified block range');
    }
  } catch (error) {
    console.error('\n❌ L1 collector error:');
    logger.error(error, 'L1 collector error');
    throw error;
  }
}

async function runL2DryRun(fromBlock?: number, toBlock?: number): Promise<void> {
  console.log('\n🔍 Running L2 Collector Dry-Run');
  console.log('==============================');

  const config = await getNetworkConfig();

  console.log(`Network: ${config.name}`);
  console.log(`L2 Node: ${config.l2.nodeUrl}`);
  console.log(`Portal Address: ${config.l2.portalAddress}`);

  const l2Collector = new L2Collector({
    nodeUrl: config.l2.nodeUrl,
    portalAddress: config.l2.portalAddress,
    startBlock: config.l2.startBlock,
    chunkSize: config.l2.chunkSize,
    l1RpcUrl: config.l1.rpcUrl,
    network: config.name,
    artifactsApiUrl: options.apiClientUrl,
  });

  try {
    const startBlock = fromBlock || config.l2.startBlock;
    const endBlock = toBlock || startBlock + 10; // Smaller range for L2

    console.log(`\n📦 Scanning blocks ${startBlock} to ${endBlock}...`);

    const startTime = Date.now();
    const registrations = await l2Collector.getL2TokenRegistrations(startBlock, endBlock);
    const duration = Date.now() - startTime;

    console.log(`✅ L2 dry-run scan completed in ${duration}ms`);

    if (registrations.length > 0) {
      console.log(`\n🌉 Found ${registrations.length} L2 token registration(s):`);
      console.log(JSON.stringify(registrations, null, 2));
    } else {
      console.log('\n📭 No L2 token registrations found in the specified block range');
    }
  } catch (error) {
    console.error('\n❌ L2 collector error:');
    logger.error(error, 'L2 collector error');
    throw error;
  }
}

async function main(): Promise<void> {
  console.log('🚀 Turnstile Portal Collector CLI');
  console.log('=================================');

  try {
    if (options.network) {
      process.env.NETWORK = options.network;
    } else if (!process.env.NETWORK) {
      console.log(`\nUsing NETWORK from environment: ${process.env.NETWORK || 'not set'}`);
    }

    // Set force start block environment variables if provided
    if (options.forceL1StartBlock) {
      process.env.FORCE_L1_START_BLOCK = options.forceL1StartBlock;
      console.log(`\n🔄 Force L1 start block set to: ${options.forceL1StartBlock}`);
    }
    if (options.forceL2StartBlock) {
      process.env.FORCE_L2_START_BLOCK = options.forceL2StartBlock;
      console.log(`\n🔄 Force L2 start block set to: ${options.forceL2StartBlock}`);
    }

    const fromBlock = options.fromBlock
      ? Number.parseInt(options.fromBlock, 10)
      : options.forceL1StartBlock
        ? Number.parseInt(options.forceL1StartBlock, 10)
        : options.forceL2StartBlock
          ? Number.parseInt(options.forceL2StartBlock, 10)
          : undefined;
    const toBlock = options.toBlock ? Number.parseInt(options.toBlock, 10) : undefined;

    if (options.verbose) {
      console.log('\n📊 Configuration:');
      const config = await getNetworkConfig();
      console.log(JSON.stringify(config, null, 2));
    }

    if (options.l1DryRun) {
      await runL1DryRun(fromBlock, toBlock);
    }

    if (options.l2DryRun) {
      await runL2DryRun(fromBlock, toBlock);
    }

    if (!options.l1DryRun && !options.l2DryRun) {
      console.log('\nNo dry-run options specified. Exiting.');
      program.help();
    }

    console.log('\n🎉 Dry-run completed successfully!');
  } catch (error) {
    console.error('\n💥 Fatal error:');
    logger.error(error, 'Fatal error in CLI');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⚠️ Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️ Received SIGTERM, shutting down...');
  process.exit(0);
});

main().catch((error) => {
  console.error('Unhandled error:');
  logger.error(error, 'Unhandled error in CLI');
  process.exit(1);
});
